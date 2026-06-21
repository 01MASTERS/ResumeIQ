from sqlalchemy import Column, Integer, Float, String, JSON, ForeignKey
from sqlalchemy.dialects.mysql import LONGTEXT as LongText
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    rank = Column(Integer, nullable=False)
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=True)
    filename = Column(String(255), nullable=False)
    score = Column(Integer, nullable=False)
    recommendation = Column(String(50), nullable=False)
    resume_skills = Column(JSON, nullable=False)
    matched_skills = Column(JSON, nullable=False)
    missing_skills = Column(JSON, nullable=False)
    score_breakdown = Column(JSON, nullable=False)
    strengths = Column(JSON, nullable=False)
    weaknesses = Column(JSON, nullable=False)
    resume_text = Column(LongText, nullable=False)
    explanation = Column(LongText, nullable=False)

    # New columns for enhanced pipeline
    years_of_experience = Column(Float, nullable=True)
    llm_verdict = Column(LongText, nullable=True)
    parsed_sections = Column(JSON, nullable=True)

    analysis = relationship("Analysis", back_populates="candidates")