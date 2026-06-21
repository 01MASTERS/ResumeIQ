import sys
import os

sys.path.append(os.getcwd())

from app.extractor.email_extractor import extract_email
from app.routes.resume_routes import _run_candidate_pipeline

print("--- 1. Testing Email Extractor Regex ---")
test_text = "John Doe\njohn.doe.123@gmail.com\nSoftware Engineer"
extracted = extract_email(test_text)
print(f"Extracted Email: {extracted}")

print("\n--- 2. Testing Candidate Pipeline ---")
candidate_data = _run_candidate_pipeline(
    candidate_name="John Doe",
    resume_text=test_text,
    filename="test_resume.pdf",
    job_description="Looking for Python developer.",
    jd_skills=["Python"],
    jd_required_yoe=0,
    knockout_criteria={},
    use_ai="false"
)

print(f"Pipeline Result Email: {candidate_data.get('candidate_email')}")
