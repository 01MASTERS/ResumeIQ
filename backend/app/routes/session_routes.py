"""
Session-based API routes for the new staged processing pipeline.

Endpoints:
  POST /sessions               — Create session + precompute JD data
  POST /sessions/{id}/resumes  — Upload files + trigger BG preprocessing
  GET  /sessions/{id}/status   — Real progress polling
  POST /sessions/{id}/analyze  — Lean analysis: LLM only (NLP already done)
"""

import os
import time
import shutil
import logging
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db, SessionLocal
from app.models.analysis import Analysis
from app.models.candidate import Candidate as CandidateModel
from app.parser.text_extractor import extract_text
from app.extractor.skill_extractor import extract_skills
from app.extractor.experience_extractor import extract_jd_yoe_requirement
from app.matcher.knockout_filter import extract_knockout_criteria
from app.matcher.scorer import extract_candidate_name, execute_hybrid_scoring
from app.services.preprocessing_service import (
    preprocess_all_candidates,
    evaluate_candidates_parallel,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIR = "uploads"


# ── Request / Response schemas ───────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    job_description: str


class AnalyzeRequest(BaseModel):
    use_ai: bool = True
    use_ollama: bool = False
    ollama_model: str = ""
    use_custom_weights: bool = False
    weight_skill: int = 0
    weight_keyword: int = 0
    weight_contextual: int = 0
    weight_experience: int = 0
    weight_ai: int = 0


# ── Helpers ──────────────────────────────────────────────────────────────────


def _require_active_session(session_id: int, db: Session) -> Analysis:
    """Load and validate a session — raise 404/410 on missing/expired."""
    analysis = db.query(Analysis).filter(Analysis.id == session_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Session not found.")
    if analysis.status == "expired":
        raise HTTPException(status_code=410, detail="Session has expired.")
    if analysis.expires_at and analysis.expires_at < datetime.utcnow():
        analysis.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Session has expired.")
    return analysis


def _bump_ttl(analysis: Analysis, db: Session, hours: int = 2) -> None:
    """Extend session expiry on every user action."""
    analysis.expires_at = Analysis.default_ttl(hours)
    analysis.updated_at = datetime.utcnow()
    db.commit()


# ── Endpoint 1: Create session ───────────────────────────────────────────────


@router.post("", status_code=201)
async def create_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    """
    Step 1 of the new flow — called immediately when the user submits the JD.

    Eagerly precomputes JD-level data (extract_skills, jd_yoe, knockout)
    so it never needs to be recomputed during /analyze.

    Returns session_id for all subsequent requests.
    """
    if not req.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is required.")

    # Precompute JD-level data — deterministic and fast (~100ms total)
    jd_skills = extract_skills(req.job_description)
    jd_required_yoe = extract_jd_yoe_requirement(req.job_description)
    knockout_criteria = extract_knockout_criteria(req.job_description)

    analysis = Analysis(
        job_description=req.job_description,
        status="created",
        jd_skills=jd_skills,
        jd_required_yoe=jd_required_yoe,
        knockout_criteria=knockout_criteria,
        expires_at=Analysis.default_ttl(hours=2),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    logger.info(f"[session={analysis.id}] Created — {len(jd_skills)} JD skills extracted")

    return {
        "session_id": analysis.id,
        "status": analysis.status,
        "expires_at": analysis.expires_at.isoformat(),
    }


# ── Endpoint 2: Upload resumes ───────────────────────────────────────────────


@router.post("/{session_id}/resumes", status_code=202)
async def upload_resumes(
    session_id: int,
    files: list[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """
    Step 2 of the new flow — upload files.

    Saves files to disk, extracts raw text + candidate name, inserts
    Candidate rows with status=uploaded, then returns 202 IMMEDIATELY.

    A BackgroundTask is registered to run the deterministic NLP pipeline
    on all candidates concurrently (ThreadPoolExecutor, max_workers=4).
    This runs while the user configures AI settings.
    """
    analysis = _require_active_session(session_id, db)

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    accepted: list[str] = []
    rejected: list[dict] = []

    analysis.status = "uploading"
    db.commit()

    for file in files:
        if not file.filename:
            continue

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            rejected.append({"filename": file.filename, "reason": "Unsupported format (PDF/DOCX only)"})
            await file.close()
            continue

        timestamp = int(time.time() * 1000)
        saved_name = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, saved_name)

        try:
            with open(file_path, "wb") as buf:
                shutil.copyfileobj(file.file, buf)
        except Exception as exc:
            rejected.append({"filename": file.filename, "reason": f"Save failed: {exc}"})
            await file.close()
            continue
        finally:
            await file.close()

        if os.path.getsize(file_path) > MAX_FILE_SIZE:
            os.remove(file_path)
            rejected.append({"filename": file.filename, "reason": "File exceeds 10 MB limit"})
            continue

        try:
            resume_text = extract_text(file_path, ext)
        except Exception as exc:
            if os.path.exists(file_path):
                os.remove(file_path)
            rejected.append({"filename": file.filename, "reason": f"Text extraction failed: {exc}"})
            continue

        candidate_name = extract_candidate_name(resume_text, file.filename)

        db_candidate = CandidateModel(
            analysis_id=session_id,
            candidate_name=candidate_name,
            filename=file.filename,
            resume_text=resume_text,
            status="uploaded",
        )
        db.add(db_candidate)
        accepted.append(file.filename)

    if not accepted:
        analysis.status = "created"  # roll back to allow re-upload
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"message": "No valid files could be processed.", "rejected": rejected},
        )

    analysis.total_candidates = len(accepted)
    analysis.preprocessed_count = 0
    analysis.completed_count = 0
    analysis.failed_count = 0
    db.commit()
    _bump_ttl(analysis, db, hours=4)

    # Register background preprocessing — runs after response is sent
    background_tasks.add_task(preprocess_all_candidates, session_id, SessionLocal)

    logger.info(
        f"[session={session_id}] {len(accepted)} resume(s) accepted, "
        f"{len(rejected)} rejected — BG preprocessing queued"
    )

    return {
        "session_id": session_id,
        "accepted_count": len(accepted),
        "accepted": accepted,
        "rejected": rejected,
    }


# ── Endpoint 3: Status polling ───────────────────────────────────────────────


@router.get("/{session_id}/status")
async def get_session_status(session_id: int, db: Session = Depends(get_db)):
    """
    Real-time progress polling — called every 2s by the frontend.

    Returns O(1) counts from the Analysis counter columns (no COUNT(*)).
    Also returns per-candidate error details for failed resumes.
    """
    analysis = _require_active_session(session_id, db)

    # Pull candidate statuses for the error_details list
    candidates = (
        db.query(CandidateModel)
        .filter(CandidateModel.analysis_id == session_id)
        .all()
    )

    status_counts: dict[str, int] = {}
    error_details: list[dict] = []

    for c in candidates:
        status_counts[c.status] = status_counts.get(c.status, 0) + 1
        if c.status in ("preprocessing_failed", "evaluation_failed") and c.error_message:
            error_details.append(
                {
                    "candidate_id": c.id,
                    "filename": c.filename,
                    "status": c.status,
                    "error": c.error_message,
                }
            )

    ready_to_analyze = analysis.status == "ready" or (
        analysis.total_candidates > 0
        and (analysis.preprocessed_count + analysis.failed_count)
        >= analysis.total_candidates
    )

    return {
        "session_id": session_id,
        "status": analysis.status,
        "expires_at": analysis.expires_at.isoformat() if analysis.expires_at else None,
        "candidates": {
            "total": analysis.total_candidates,
            "uploaded": status_counts.get("uploaded", 0),
            "preprocessing": status_counts.get("preprocessing", 0),
            "preprocessed": status_counts.get("preprocessed", 0),
            "preprocessing_failed": status_counts.get("preprocessing_failed", 0),
            "evaluating": status_counts.get("evaluating", 0),
            "completed": status_counts.get("completed", 0),
            "evaluation_failed": status_counts.get("evaluation_failed", 0),
        },
        "ready_to_analyze": ready_to_analyze,
        "error_details": error_details,
    }


# ── Endpoint 4: Analyze (lean — LLM only) ───────────────────────────────────


@router.post("/{session_id}/analyze")
async def analyze_session(
    session_id: int, req: AnalyzeRequest, db: Session = Depends(get_db)
):
    """
    Step 4 of the new flow — LLM evaluation + scoring only.

    All deterministic NLP was done in the background after upload.
    This endpoint reads preprocessing_data from each candidate,
    runs Gemini/Ollama in parallel (ThreadPoolExecutor, max_workers=3),
    applies scoring weights, ranks candidates, and persists results.

    Race condition guard: returns 409 if preprocessing isn't finished.
    """
    analysis = _require_active_session(session_id, db)

    # ── State machine guard ──────────────────────────────────────────────────
    if analysis.status == "preprocessing":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PREPROCESSING_IN_PROGRESS",
                "message": "Preprocessing is still running. Please wait.",
                "preprocessed": analysis.preprocessed_count,
                "total": analysis.total_candidates,
            },
        )
    if analysis.status not in ("ready", "completed", "uploading"):
        # Allow re-analysis of completed sessions (e.g., different weights)
        if analysis.status not in ("ready", "completed"):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "INVALID_STATE",
                    "message": f"Session cannot be analyzed in state: {analysis.status}",
                },
            )
    # ────────────────────────────────────────────────────────────────────────

    preprocessed_candidates = (
        db.query(CandidateModel)
        .filter(
            CandidateModel.analysis_id == session_id,
            CandidateModel.status.in_(["preprocessed", "completed"]),
        )
        .all()
    )

    if not preprocessed_candidates:
        raise HTTPException(
            status_code=400,
            detail="No preprocessed candidates found. Upload resumes first.",
        )

    # Transition to ANALYZING
    analysis.status = "analyzing"
    db.commit()

    custom_weights = None
    if req.use_custom_weights:
        custom_weights = {
            "skill": req.weight_skill,
            "keyword": req.weight_keyword,
            "contextual": req.weight_contextual,
            "experience": req.weight_experience,
            "ai": req.weight_ai,
        }

    # Step 1: Parallel LLM evaluation
    llm_results = evaluate_candidates_parallel(
        candidates=preprocessed_candidates,
        job_description=analysis.job_description,
        use_ai=req.use_ai,
        use_ollama=req.use_ollama,
        ollama_model=req.ollama_model,
    )

    # Step 2: Score each candidate using cached preprocessing data
    scored: list[dict] = []
    failed_llm_count = 0

    for c in preprocessed_candidates:
        pd = c.preprocessing_data or {}
        parsed_sections = pd.get("parsed_sections", {})
        experience_data = pd.get("experience_data", {"total_yoe": 0, "roles": []})
        skill_context = pd.get("skill_context", {"all_skills": []})
        knockout_result = pd.get("knockout_result", {"passed": True})

        llm_result = llm_results.get(c.id)
        if req.use_ai and llm_result is None:
            failed_llm_count += 1

        metrics = execute_hybrid_scoring(
            resume_skills=skill_context.get("all_skills", []),
            jd_skills=analysis.jd_skills or [],
            jd_text=analysis.job_description,
            resume_text=c.resume_text,
            experience_data=experience_data,
            jd_required_yoe=analysis.jd_required_yoe,
            llm_result=llm_result,
            knockout_result=knockout_result,
            skill_context=skill_context,
            custom_weights=custom_weights,
        )

        # Update candidate record
        c.status = "completed" if (not req.use_ai or llm_result is not None) else "evaluation_failed"
        c.score = metrics["score"]
        c.recommendation = metrics["recommendation"]
        c.candidate_email = pd.get("candidate_email") or c.candidate_email
        c.resume_skills = sorted(skill_context.get("all_skills", []))
        c.matched_skills = metrics["matched_skills"]
        c.missing_skills = metrics["missing_skills"]
        c.score_breakdown = metrics["score_breakdown"]
        c.strengths = metrics["strengths"]
        c.weaknesses = metrics["weaknesses"]
        c.explanation = metrics["explanation"]
        c.years_of_experience = metrics["years_of_experience"]
        c.llm_verdict = metrics["llm_verdict"]
        c.parsed_sections = parsed_sections
        c.evaluated_at = datetime.utcnow()

        scored.append(
            {
                "candidate": c,
                "score": metrics["score"],
                "metrics": metrics,
                "parsed_sections": parsed_sections,
                "candidate_email": c.candidate_email,
            }
        )

    # Step 3: Sort and assign ranks
    scored.sort(key=lambda x: x["score"], reverse=True)
    response_candidates = []
    for idx, item in enumerate(scored):
        c = item["candidate"]
        c.rank = idx + 1
        response_candidates.append(
            {
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
            }
        )

    # Step 4: Persist and finalize
    analysis.status = "completed"
    analysis.completed_count = len([s for s in scored if s["candidate"].status == "completed"])
    _bump_ttl(analysis, db, hours=24)
    db.commit()

    partial = failed_llm_count > 0

    logger.info(
        f"[session={session_id}] Analysis complete — "
        f"{len(response_candidates)} ranked, "
        f"{failed_llm_count} LLM failures"
    )

    return {
        "analysis_id": analysis.id,
        "summary": f"{len(response_candidates)} resumes analyzed"
        + (f" ({failed_llm_count} AI evaluation failed)" if partial else ""),
        "partial_results": partial,
        "ranked_candidates": response_candidates,
    }
