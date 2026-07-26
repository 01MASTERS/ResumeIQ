from sqlalchemy import Column, Integer, Float, String, DateTime, JSON
from sqlalchemy.dialects.mysql import LONGTEXT as LongText
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.database.connection import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    job_description = Column(LongText, nullable=False)

    # Session lifecycle
    status = Column(
        String(20),
        nullable=False,
        default="created",
        comment="created|uploading|preprocessing|ready|analyzing|completed|failed|expired",
    )

    # Cached JD-level preprocessing — computed once at session creation
    jd_skills = Column(JSON, nullable=True,
                       comment="Output of extract_skills(jd) — never recomputed")
    jd_required_yoe = Column(Float, nullable=True,
                             comment="Output of extract_jd_yoe_requirement(jd)")
    knockout_criteria = Column(JSON, nullable=True,
                               comment="Output of extract_knockout_criteria(jd)")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True,
                        comment="Bumped on every user action; used by cleanup job")

    # Aggregate counters for O(1) progress responses (no COUNT(*) needed)
    total_candidates = Column(Integer, nullable=False, default=0)
    preprocessed_count = Column(Integer, nullable=False, default=0)
    completed_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)

    candidates = relationship(
        "Candidate", back_populates="analysis", cascade="all, delete-orphan"
    )

    @staticmethod
    def default_ttl(hours: int = 2) -> datetime:
        """Return an expiry datetime `hours` from now."""
        return datetime.utcnow() + timedelta(hours=hours)