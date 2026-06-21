from pydantic import BaseModel, Field


class JobDescriptionRequest(BaseModel):
    job_description: str = Field(..., min_length=1, strip_whitespace=True)


class JobDescriptionResponse(BaseModel):
    received_jd: str


# --- JSON Resume Input Schemas ---

class JsonResumeEntry(BaseModel):
    """A single candidate resume submitted as JSON text."""
    candidate_name: str = Field(..., min_length=1, description="Name of the candidate")
    resume_text: str = Field(..., min_length=1, description="Full resume text content")


class JsonAnalysisRequest(BaseModel):
    """Request body for analyzing resumes via JSON input (no file upload)."""
    job_description: str = Field(
        ..., min_length=1, strip_whitespace=True,
        description="The full job description to match against",
    )
    resumes: list[JsonResumeEntry] = Field(
        ..., min_length=1,
        description="List of candidate resumes as text",
    )
