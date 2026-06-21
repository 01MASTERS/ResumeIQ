from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.dialects.mysql import LONGTEXT as LongText
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    job_description = Column(LongText, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidates = relationship("Candidate", back_populates="analysis", cascade="all, delete-orphan")