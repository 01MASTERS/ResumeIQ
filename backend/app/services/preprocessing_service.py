"""
Background preprocessing service for ResumeIQ.

Runs all deterministic NLP work (parse_sections, extract_experience,
extract_skills, knockout_filter, extract_email) in a shared ThreadPoolExecutor
so the work happens *during* the AI Config step, not after Analyze is clicked.

Architecture:
- A module-level ThreadPoolExecutor (max_workers=4) is created once at import
  time and reused across all upload requests.
- preprocess_all_candidates() is the BackgroundTask entry point. It fans out
  individual candidate preprocessing to the pool and waits for all to finish.
- Each candidate gets its own DB session (thread-safe).
- Failures are isolated: one bad PDF does not block the remaining candidates.
- Counters on the Analysis row are incremented atomically via UPDATE ... + 1
  so that the /status poll always reads a consistent O(1) value.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.analysis import Analysis
from app.models.candidate import Candidate

logger = logging.getLogger(__name__)

# Module-level pool — created once, reused across all requests.
# 4 workers is the sweet spot for NLP workloads that call into C extensions
# (sentence-transformers, scikit-learn) which release the GIL.
_preprocessing_pool = ThreadPoolExecutor(
    max_workers=4, thread_name_prefix="resumeiq-preproc"
)

# Separate, smaller pool reserved exclusively for Gemini/Ollama LLM calls.
# 3 concurrent calls balances speed vs. Gemini free-tier RPM limits.
_llm_pool = ThreadPoolExecutor(
    max_workers=3, thread_name_prefix="resumeiq-llm"
)


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def preprocess_all_candidates(session_id: int, db_factory) -> None:
    """
    FastAPI BackgroundTask entry point — called once per resume upload.

    Fan out preprocessing of all UPLOADED candidates in this session to the
    thread pool. Block until every future is resolved, then finalize the
    session status to READY.

    Args:
        session_id: The Analysis.id for this upload session.
        db_factory: Callable returning a fresh SQLAlchemy Session
                    (pass SessionLocal from database.connection).
    """
    db: Session = db_factory()
    try:
        analysis = db.query(Analysis).filter(Analysis.id == session_id).first()
        if not analysis:
            logger.warning(f"preprocess_all_candidates: session {session_id} not found")
            return

        # Transition to PREPROCESSING
        analysis.status = "preprocessing"
        db.commit()

        candidate_ids = [
            c.id
            for c in db.query(Candidate)
            .filter(
                Candidate.analysis_id == session_id,
                Candidate.status == "uploaded",
            )
            .all()
        ]
    finally:
        db.close()

    if not candidate_ids:
        _finalize_session_status(session_id, db_factory)
        return

    # Submit all candidates concurrently
    futures = {
        _preprocessing_pool.submit(
            _preprocess_single_candidate, cid, session_id, db_factory
        ): cid
        for cid in candidate_ids
    }

    for future in as_completed(futures):
        cid = futures[future]
        try:
            future.result()
        except Exception as exc:
            # Already handled inside _preprocess_single_candidate; log again
            # in case the exception escaped.
            logger.error(
                f"Preprocessing future for candidate {cid} raised: {exc}"
            )

    _finalize_session_status(session_id, db_factory)


def evaluate_candidates_parallel(
    candidates: list,
    job_description: str,
    use_ai: bool,
    use_ollama: bool,
    ollama_model: str,
) -> dict:
    """
    Run Gemini/Ollama LLM evaluation for all candidates in parallel.

    Returns a dict mapping candidate_id → llm_result (or None on failure).
    Used by the /analyze endpoint after preprocessing is confirmed complete.
    """
    if not use_ai:
        return {c.id: None for c in candidates}

    from app.matcher.llm_evaluator import evaluate_candidate

    futures = {
        _llm_pool.submit(
            evaluate_candidate,
            resume_sections=c.preprocessing_data["parsed_sections"],
            job_description=job_description,
            candidate_name=c.candidate_name,
            use_ollama=use_ollama,
            ollama_model=ollama_model,
        ): c.id
        for c in candidates
        if c.preprocessing_data and c.preprocessing_data.get("parsed_sections")
    }

    results: dict = {}
    for future in as_completed(futures):
        cid = futures[future]
        try:
            results[cid] = future.result()
        except Exception as exc:
            logger.error(f"LLM evaluation failed for candidate {cid}: {exc}")
            results[cid] = None  # graceful degradation — ai_score = 0

    return results


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _preprocess_single_candidate(
    candidate_id: int, session_id: int, db_factory
) -> None:
    """
    Run the full deterministic NLP pipeline for one candidate.

    Each call gets its own DB session so thread safety is guaranteed.
    Updates candidate.status atomically on success or failure.
    Increments the appropriate counter on the parent Analysis row.
    """
    db: Session = db_factory()
    try:
        candidate = (
            db.query(Candidate).filter(Candidate.id == candidate_id).first()
        )
        if not candidate:
            return

        # Mark as in-progress so /status shows "preprocessing"
        candidate.status = "preprocessing"
        db.commit()

        # Load cached JD-level data from the Analysis row (never recomputed)
        analysis = (
            db.query(Analysis).filter(Analysis.id == session_id).first()
        )
        knockout_criteria = analysis.knockout_criteria or {}

        # ── Deterministic NLP pipeline ──────────────────────────────────
        from app.parser.section_parser import parse_sections
        from app.extractor.skill_extractor import extract_contextual_skills
        from app.extractor.experience_extractor import extract_experience
        from app.extractor.email_extractor import extract_email
        from app.matcher.knockout_filter import apply_knockout

        parsed_sections = parse_sections(candidate.resume_text)
        experience_text = parsed_sections.get("experience", "")
        experience_data = extract_experience(experience_text)
        skill_context = extract_contextual_skills(
            parsed_sections=parsed_sections,
            total_roles=experience_data.get("roles"),
        )
        knockout_result = apply_knockout(
            candidate_yoe=experience_data["total_yoe"],
            resume_text=candidate.resume_text,
            knockout_criteria=knockout_criteria,
        )
        candidate_email = extract_email(candidate.resume_text)
        # ────────────────────────────────────────────────────────────────

        # Persist preprocessing output
        candidate.preprocessing_data = {
            "parsed_sections": parsed_sections,
            "experience_data": experience_data,
            "skill_context": skill_context,
            "knockout_result": knockout_result,
            "candidate_email": candidate_email,
        }
        candidate.candidate_email = candidate_email or candidate.candidate_email
        candidate.status = "preprocessed"
        candidate.preprocessed_at = datetime.utcnow()

        # Increment session counter atomically (safe under concurrent writes)
        db.query(Analysis).filter(Analysis.id == session_id).update(
            {"preprocessed_count": Analysis.preprocessed_count + 1},
            synchronize_session=False,
        )
        db.commit()
        logger.info(
            f"[session={session_id}] Candidate {candidate_id} "
            f"({candidate.candidate_name}) preprocessed successfully"
        )

    except Exception as exc:
        logger.error(
            f"[session={session_id}] Preprocessing FAILED for "
            f"candidate {candidate_id}: {exc}",
            exc_info=True,
        )
        try:
            db.rollback()
            db.query(Candidate).filter(Candidate.id == candidate_id).update(
                {
                    "status": "preprocessing_failed",
                    "error_message": str(exc)[:500],
                },
                synchronize_session=False,
            )
            db.query(Analysis).filter(Analysis.id == session_id).update(
                {"failed_count": Analysis.failed_count + 1},
                synchronize_session=False,
            )
            db.commit()
        except Exception as db_exc:
            logger.error(f"Failed to persist error state for candidate {candidate_id}: {db_exc}")
    finally:
        db.close()


def _finalize_session_status(session_id: int, db_factory) -> None:
    """
    Transition the session to READY once all background tasks are done.
    Called after all futures resolve (regardless of individual outcomes).
    """
    db: Session = db_factory()
    try:
        analysis = db.query(Analysis).filter(Analysis.id == session_id).first()
        if not analysis:
            return

        done = analysis.preprocessed_count + analysis.failed_count
        if done >= analysis.total_candidates:
            analysis.status = "ready"
            db.commit()
            logger.info(
                f"[session={session_id}] All preprocessing done — "
                f"status set to READY "
                f"(preprocessed={analysis.preprocessed_count}, "
                f"failed={analysis.failed_count})"
            )
    except Exception as exc:
        logger.error(f"Failed to finalize session {session_id} status: {exc}")
    finally:
        db.close()
