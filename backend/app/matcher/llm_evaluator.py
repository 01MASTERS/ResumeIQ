"""
Gemini LLM Evaluator.
Uses Google Gemini 2.5 Flash for qualitative resume evaluation.
Sends structured resume sections + job description to the model and receives
a scored evaluation with a recruiter-style verdict.
"""
import os
import json
import logging

logger = logging.getLogger(__name__)


def evaluate_candidate(
    resume_sections: dict,
    job_description: str,
    candidate_name: str,
) -> dict:
    """
    Evaluate a candidate using Gemini 2.5 Flash.

    Args:
        resume_sections: Parsed resume sections from section_parser.
        job_description: The full job description text.
        candidate_name: Name of the candidate (for logging).

    Returns:
        dict with keys:
            - impact_score (0-100)
            - domain_relevance_score (0-100)
            - project_complexity_score (0-100)
            - overall_score (0-100)
            - verdict (str)
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set. Skipping LLM evaluation.")
        return _default_result("API key not configured")

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        # Build formatted resume context from parsed sections
        resume_context = _build_resume_context(resume_sections)

        prompt = (
            "You are a senior technical hiring manager with 15 years of recruiting "
            "experience. Evaluate this candidate against the job description below. "
            "Be critical and realistic — evaluate as a real recruiter would.\n\n"
            f"## Job Description\n{job_description}\n\n"
            f"## Candidate Resume\n{resume_context}\n\n"
            "Evaluate the candidate on these criteria and provide integer scores "
            "from 0 to 100:\n\n"
            "1. **impact_score**: Did they describe measurable achievements and "
            "quantified results (e.g., 'reduced latency by 40%', 'grew user base "
            "to 100k')? Or did they only list generic responsibilities? Score higher "
            "for specific, quantified impact.\n\n"
            "2. **domain_relevance_score**: How closely does their background match "
            "the specific industry, tech stack, and domain of the job? Consider both "
            "the technologies used and the business context.\n\n"
            "3. **project_complexity_score**: What is the scale and technical depth "
            "of their work? Did they build large-scale distributed systems, handle "
            "millions of users, or work on small internal tools?\n\n"
            "Also provide:\n\n"
            "4. **overall_score**: Your overall assessment (0-100) as a weighted "
            "combination of the above, factoring in your recruiter intuition about "
            "the candidate's overall fit.\n\n"
            "5. **verdict**: A 2-4 sentence recruiter-style summary explaining why "
            "this candidate is or isn't a good fit. Be specific — reference actual "
            "details from their resume. Do NOT use generic filler phrases.\n\n"
            "Return ONLY valid JSON with exactly these keys: impact_score, "
            "domain_relevance_score, project_complexity_score, overall_score, verdict"
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )

        result = json.loads(response.text)

        # Validate and clamp all scores to 0-100
        for key in [
            "impact_score",
            "domain_relevance_score",
            "project_complexity_score",
            "overall_score",
        ]:
            if key in result:
                result[key] = max(0, min(100, int(result[key])))
            else:
                result[key] = 0

        if "verdict" not in result or not result["verdict"]:
            result["verdict"] = (
                "LLM evaluation completed but no verdict was generated."
            )

        return result

    except Exception as e:
        logger.error(
            f"Gemini LLM evaluation failed for {candidate_name}: {str(e)}"
        )
        return _default_result(f"LLM evaluation error: {str(e)}")


def _build_resume_context(sections: dict) -> str:
    """Build a formatted resume context string from parsed sections."""
    output_parts = []

    # Present sections in a logical reading order
    section_order = [
        "header", "summary", "experience", "projects",
        "skills", "education", "certifications",
    ]

    for section_name in section_order:
        if section_name in sections and sections[section_name].strip():
            display_name = section_name.replace("_", " ").title()
            output_parts.append(
                f"### {display_name}\n{sections[section_name]}"
            )

    # Include any remaining sections not in the predefined order
    for section_name, content in sections.items():
        if section_name not in section_order and content.strip():
            display_name = section_name.replace("_", " ").title()
            output_parts.append(f"### {display_name}\n{content}")

    return "\n\n".join(output_parts) if output_parts else "No structured content available."


def _default_result(reason: str) -> dict:
    """Return a default result when LLM evaluation cannot be performed."""
    return {
        "impact_score": 0,
        "domain_relevance_score": 0,
        "project_complexity_score": 0,
        "overall_score": 0,
        "verdict": f"LLM evaluation unavailable: {reason}",
    }
