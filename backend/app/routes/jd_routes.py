from fastapi import APIRouter
from app.schemas.jd_schema import JobDescriptionRequest, JobDescriptionResponse

router = APIRouter()

@router.post("/job-description", response_model=JobDescriptionResponse)
async def submit_job_description(request: JobDescriptionRequest):
    return JobDescriptionResponse(received_jd=request.job_description)
