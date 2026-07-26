from sqlalchemy import Column, Integer, Float, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.mysql import LONGTEXT as LongText
from sqlalchemy.orm import relationship
from app.database.connection import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )

    # Identity — populated immediately on upload
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=True)
    filename = Column(String(255), nullable=False)
    resume_text = Column(LongText, nullable=False)

    # Per-candidate lifecycle state machine:
    # uploaded → preprocessing → preprocessed → evaluating → completed
    #                         ↘ preprocessing_failed
    #                                            ↘ evaluation_failed
    status = Column(
        String(30),
        nullable=False,
        default="uploaded",
        comment=(
            "uploaded|preprocessing|preprocessed|"
            "preprocessing_failed|evaluating|completed|evaluation_failed"
        ),
    )
    error_message = Column(Text, nullable=True,
                           comment="Last error from preprocessing or LLM evaluation")
    retry_count = Column(Integer, nullable=False, default=0)

    # Preprocessing output — populated by BG task after upload.
    # JSON blob containing: parsed_sections, experience_data,
    # skill_context, knockout_result, candidate_email
    preprocessing_data = Column(JSON, nullable=True)

    # Timestamps
    preprocessed_at = Column(DateTime, nullable=True)
    evaluated_at = Column(DateTime, nullable=True)

    # Final evaluation results — populated by /analyze
    rank = Column(Integer, nullable=True)
    score = Column(Integer, nullable=True)
    recommendation = Column(String(50), nullable=True)
    resume_skills = Column(JSON, nullable=True)
    matched_skills = Column(JSON, nullable=True)
    missing_skills = Column(JSON, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    explanation = Column(LongText, nullable=True)
    years_of_experience = Column(Float, nullable=True)
    llm_verdict = Column(LongText, nullable=True)
    parsed_sections = Column(JSON, nullable=True)

    analysis = relationship("Analysis", back_populates="candidates")