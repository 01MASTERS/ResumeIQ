import os
import time
import shutil
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.analysis import Analysis
from app.models.candidate import Candidate as CandidateModel
from app.parser.text_extractor import extract_text
from app.parser.section_parser import parse_sections
from app.extractor.skill_extractor import extract_skills, extract_contextual_skills
from app.extractor.experience_extractor import extract_experience, extract_jd_yoe_requirement
from app.extractor.email_extractor import extract_email
from app.matcher.scorer import extract_candidate_name, execute_hybrid_scoring
from app.matcher.knockout_filter import extract_knockout_criteria, apply_knockout
from app.matcher.llm_evaluator import evaluate_candidate
from app.schemas.jd_schema import JsonAnalysisRequest

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024
UPLOAD_DIR = "uploads"


def _run_candidate_pipeline(
    candidate_name: str,
    resume_text: str,
    filename: str,
    job_description: str,
    jd_skills: list[str],
    jd_required_yoe: float | None,
    knockout_criteria: dict,
    use_ai: bool = True,
    custom_weights: dict | None = None,
) -> dict:
    """
    Core candidate evaluation pipeline shared by both file upload and JSON endpoints.

    Steps:
        1. Parse resume into sections
        2. Extract experience data (YoE, titles, seniority)
        3. Run knockout filter
        4. Extract skills with contextual weighting
        5. Call Gemini LLM evaluator
        6. Execute hybrid scoring with all 5 components
    """
    # Step 1: Section parsing & email extraction
    parsed_sections = parse_sections(resume_text)
    candidate_email = extract_email(resume_text)

    # Step 2: Experience extraction
    experience_text = parsed_sections.get("experience", "")
    experience_data = extract_experience(experience_text)

    # Step 3: Knockout filter
    knockout_result = apply_knockout(
        candidate_yoe=experience_data["total_yoe"],
        resume_text=resume_text,
        knockout_criteria=knockout_criteria,
    )

    # Step 4: Contextual skill extraction
    skill_context = extract_contextual_skills(
        parsed_sections=parsed_sections,
        total_roles=experience_data.get("roles"),
    )
    resume_skills = skill_context["all_skills"]

    # Step 5: LLM evaluation (Gemini 2.5 Flash) if enabled
    llm_result = None
    if use_ai:
        llm_result = evaluate_candidate(
            resume_sections=parsed_sections,
            job_description=job_description,
            candidate_name=candidate_name,
        )

    # Step 6: Hybrid scoring
    metrics = execute_hybrid_scoring(
        resume_skills=resume_skills,
        jd_skills=jd_skills,
        jd_text=job_description,
        resume_text=resume_text,
        experience_data=experience_data,
        jd_required_yoe=jd_required_yoe,
        llm_result=llm_result,
        knockout_result=knockout_result,
        skill_context=skill_context,
        custom_weights=custom_weights,
    )

    return {
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "filename": filename,
        "score": metrics["score"],
        "score_breakdown": metrics["score_breakdown"],
        "recommendation": metrics["recommendation"],
        "resume_skills": sorted(resume_skills),
        "matched_skills": metrics["matched_skills"],
        "missing_skills": metrics["missing_skills"],
        "strengths": metrics["strengths"],
        "weaknesses": metrics["weaknesses"],
        "resume_text": resume_text,
        "explanation": metrics["explanation"],
        "years_of_experience": metrics["years_of_experience"],
        "llm_verdict": metrics["llm_verdict"],
        "parsed_sections": parsed_sections,
    }


def _persist_analysis(
    db: Session,
    job_description: str,
    candidates_data: list[dict],
) -> dict:
    """Sort candidates, persist to database, and return the API response."""
    # Sort by score descending
    candidates_data.sort(key=lambda x: x["score"], reverse=True)

    new_analysis = Analysis(job_description=job_description)
    db.add(new_analysis)
    db.flush()

    response_candidates = []
    for idx, c in enumerate(candidates_data):
        rank_val = idx + 1
        db_candidate = CandidateModel(
            analysis_id=new_analysis.id,
            rank=rank_val,
            candidate_name=c["candidate_name"],
            candidate_email=c["candidate_email"],
            filename=c["filename"],
            score=c["score"],
            recommendation=c["recommendation"],
            resume_skills=c["resume_skills"],
            matched_skills=c["matched_skills"],
            missing_skills=c["missing_skills"],
            score_breakdown=c["score_breakdown"],
            strengths=c["strengths"],
            weaknesses=c["weaknesses"],
            resume_text=c["resume_text"],
            explanation=c["explanation"],
            years_of_experience=c.get("years_of_experience"),
            llm_verdict=c.get("llm_verdict"),
            parsed_sections=c.get("parsed_sections"),
        )
        db.add(db_candidate)

        c_out = dict(c)
        c_out["rank"] = rank_val
        response_candidates.append(c_out)

    db.commit()

    return {
        "analysis_id": new_analysis.id,
        "summary": f"{len(response_candidates)} resumes analyzed",
        "ranked_candidates": response_candidates,
    }


# ==============================================================================
# Endpoint 1: File Upload (existing, enhanced)
# ==============================================================================

@router.post("/upload-resume")
async def upload_resumes(
    files: list[UploadFile] = File(...),
    job_description: str = Form(...),
    use_ai: str = Form("true"),
    use_custom_weights: str = Form("false"),
    weight_skill: int = Form(0),
    weight_keyword: int = Form(0),
    weight_contextual: int = Form(0),
    weight_experience: int = Form(0),
    weight_ai: int = Form(0),
    db: Session = Depends(get_db),
):
    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description is required.",
        )
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one resume file is required.",
        )

    # Pre-compute JD-level data (shared across all candidates)
    jd_skills = extract_skills(job_description)
    jd_required_yoe = extract_jd_yoe_requirement(job_description)
    knockout_criteria = extract_knockout_criteria(job_description)

    custom_weights = None
    if use_custom_weights.lower() == "true":
        custom_weights = {
            "skill": weight_skill,
            "keyword": weight_keyword,
            "contextual": weight_contextual,
            "experience": weight_experience,
            "ai": weight_ai
        }

    candidates_data = []
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    for file in files:
        if not file.filename:
            continue

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file.filename}. Only PDF and DOCX are accepted.",
            )

        timestamp = int(time.time() * 1000)
        saved_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save file: {file.filename}",
            )
        finally:
            await file.close()

        if os.path.getsize(file_path) > MAX_FILE_SIZE:
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {file.filename} (max 10MB)",
            )

        try:
            extracted_text = extract_text(file_path, ext)
        except ValueError:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse file: {file.filename}",
            )

        c_name = extract_candidate_name(extracted_text, file.filename)
        candidate_data = _run_candidate_pipeline(
            candidate_name=c_name,
            resume_text=extracted_text,
            filename=file.filename,
            job_description=job_description,
            jd_skills=jd_skills,
            jd_required_yoe=jd_required_yoe,
            knockout_criteria=knockout_criteria,
            use_ai=use_ai.lower() == "true",
            custom_weights=custom_weights,
        )
        candidates_data.append(candidate_data)

    return _persist_analysis(db, job_description, candidates_data)


# ==============================================================================
# Endpoint 2: JSON Input (new)
# ==============================================================================

@router.post("/analyze-json")
async def analyze_json_resumes(
    request: JsonAnalysisRequest,
    db: Session = Depends(get_db),
):
    """
    Analyze resumes submitted as JSON text instead of file uploads.

    Accepts a JSON body with:
        - job_description: str
        - resumes: list of { candidate_name: str, resume_text: str }
    """
    jd_skills = extract_skills(request.job_description)
    jd_required_yoe = extract_jd_yoe_requirement(request.job_description)
    knockout_criteria = extract_knockout_criteria(request.job_description)

    candidates_data = []
    for entry in request.resumes:
        candidate_data = _run_candidate_pipeline(
            candidate_name=entry.candidate_name,
            resume_text=entry.resume_text,
            filename=f"{entry.candidate_name}.json",
            job_description=request.job_description,
            jd_skills=jd_skills,
            jd_required_yoe=jd_required_yoe,
            knockout_criteria=knockout_criteria,
        )
        candidates_data.append(candidate_data)

    return _persist_analysis(db, request.job_description, candidates_data)


# ==============================================================================
# History API Endpoints
# ==============================================================================

@router.get("/analyses")
def get_analyses_history(db: Session = Depends(get_db)):
    results = db.query(Analysis).order_by(Analysis.created_at.desc()).all()
    history_payload = []
    for item in results:
        count = (
            db.query(CandidateModel)
            .filter(CandidateModel.analysis_id == item.id)
            .count()
        )
        history_payload.append({
            "id": item.id,
            "created_at": item.created_at.isoformat(),
            "candidate_count": count,
        })
    return history_payload


@router.get("/analyses/{id}")
def get_historical_analysis_detail(id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    db_candidates = (
        db.query(CandidateModel)
        .filter(CandidateModel.analysis_id == id)
        .order_by(CandidateModel.rank.asc())
        .all()
    )
    candidates_payload = []
    for c in db_candidates:
        candidates_payload.append({
            "rank": c.rank,
            "candidate_name": c.candidate_name,
            "candidate_email": c.candidate_email,
            "filename": c.filename,
            "score": c.score,
            "score_breakdown": c.score_breakdown,
            "recommendation": c.recommendation,
            "resume_skills": c.resume_skills,
            "matched_skills": c.matched_skills,
            "missing_skills": c.missing_skills,
            "strengths": c.strengths,
            "weaknesses": c.weaknesses,
            "resume_text": c.resume_text,
            "explanation": c.explanation,
            "years_of_experience": c.years_of_experience,
            "llm_verdict": c.llm_verdict,
        })

    return {
        "analysis_id": analysis.id,
        "job_description": analysis.job_description,
        "ranked_candidates": candidates_payload,
    }


@router.delete("/analyses/{id}")
def purge_historical_analysis(id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == id).first()
    if not analysis:
        raise HTTPException(
            status_code=404, detail="Analysis not found."
        )
    db.delete(analysis)
    db.commit()
    return {"message": "Analysis deleted successfully."}

from pydantic import BaseModel

class InvitationCandidate(BaseModel):
    name: str
    email: str | None

class InvitationRequest(BaseModel):
    candidates: list[InvitationCandidate]
    subject: str
    message: str

@router.post("/invite-candidates")
async def send_invitations(req: InvitationRequest):
    """
    Dispatches personalized emails to selected candidates via SMTP.
    """
    from app.services.email_service import send_invitation_email
    
    success_count = 0
    errors = []
    
    for c in req.candidates:
        if not c.email:
            errors.append(f"No email found for {c.name}")
            continue
            
        # Dynamically inject the candidate's name into the template if the placeholder exists
        personalized_subject = req.subject.replace("{{name}}", c.name)
        personalized_message = req.message.replace("{{name}}", c.name)
        
        success = send_invitation_email(c.email, personalized_subject, personalized_message)
        if success:
            success_count += 1
        else:
            errors.append(f"Failed to send to {c.email}")
            
    return {
        "message": f"Successfully sent {success_count} invitations.",
        "success_count": success_count,
        "errors": errors
    }