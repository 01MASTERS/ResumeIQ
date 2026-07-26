import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import engine, Base, SessionLocal
from app.routes.jd_routes import router as jd_router
from app.routes.resume_routes import router as resume_router
from app.routes.session_routes import router as session_router

logger = logging.getLogger(__name__)


def _cleanup_expired_sessions() -> None:
    """
    Mark stale in-progress sessions as expired on startup.

    Targets sessions that were CREATED/UPLOADING/PREPROCESSING when the
    process last stopped (BackgroundTasks tasks died with the process).
    This prevents orphaned sessions from permanently blocking the "ready"
    state on the status poll.
    """
    db = SessionLocal()
    try:
        from app.models.analysis import Analysis  # local import avoids circular deps at module level

        now = datetime.utcnow()
        # Expire sessions whose TTL has passed and are still mid-pipeline
        stale = (
            db.query(Analysis)
            .filter(
                Analysis.expires_at < now,
                Analysis.status.in_(["created", "uploading", "preprocessing"]),
            )
            .all()
        )
        for a in stale:
            a.status = "expired"
        if stale:
            db.commit()
            logger.info(f"Startup cleanup: marked {len(stale)} expired session(s)")
    except Exception as exc:
        logger.error(f"Startup cleanup failed: {exc}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    os.makedirs("uploads", exist_ok=True)
    _cleanup_expired_sessions()
    yield
    # Shutdown (nothing special needed)


app = FastAPI(title="ResumeIQ — Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"message": "Backend working"}


# New staged-pipeline routes (POST /sessions/*, GET /sessions/*)
app.include_router(session_router)

# Legacy routes — kept for backward compatibility
app.include_router(jd_router)
app.include_router(resume_router)