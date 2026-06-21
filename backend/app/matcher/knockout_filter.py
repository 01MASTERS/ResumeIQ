"""
Knockout (pre-screening) filter.
Checks mandatory requirements from the job description before full scoring.
Candidates that fail knockout are still scored but marked as Disqualified.
"""
import re


def extract_knockout_criteria(jd_text: str) -> dict:
    """
    Extract hard requirements from job description text.

    Returns:
        dict with keys:
            - min_yoe: float | None
            - required_degree: str | None
            - mandatory_skills: list[str]
    """
    criteria = {
        "min_yoe": None,
        "required_degree": None,
        "mandatory_skills": [],
    }

    # --- Minimum Years of Experience ---
    yoe_patterns = [
        r"(\d+)\+?\s*(?:years?|yrs?)[\s\w]*(?:of\s+)?(?:experience|exp)",
        r"(?:minimum|at\s+least|min)\s+(\d+)\s*(?:years?|yrs?)",
    ]
    for pattern in yoe_patterns:
        match = re.search(pattern, jd_text, re.IGNORECASE)
        if match:
            criteria["min_yoe"] = float(match.group(1))
            break

    # --- Degree Requirement ---
    degree_patterns = [
        r"((?:bachelor'?s?|b\.?s\.?|b\.?e\.?|b\.?tech)"
        r"(?:\s+degree)?\s+(?:in\s+)?[\w\s]{3,40}?)(?:\.|,|;|\n|$)",
        r"((?:master'?s?|m\.?s\.?|m\.?tech|mba)"
        r"(?:\s+degree)?\s+(?:in\s+)?[\w\s]{3,40}?)(?:\.|,|;|\n|$)",
        r"((?:ph\.?d\.?|doctorate)\s+(?:in\s+)?[\w\s]{3,40}?)(?:\.|,|;|\n|$)",
    ]
    for pattern in degree_patterns:
        match = re.search(pattern, jd_text, re.IGNORECASE)
        if match:
            criteria["required_degree"] = match.group(1).strip().rstrip(".,;")
            break

    return criteria


def apply_knockout(
    candidate_yoe: float,
    resume_text: str,
    knockout_criteria: dict,
) -> dict:
    """
    Apply knockout filters to determine if a candidate meets hard requirements.

    A 30% tolerance is applied to YoE to avoid rejecting borderline candidates.

    Returns:
        dict with keys:
            - passed: bool
            - reasons: list[str] (empty if passed)
    """
    passed = True
    reasons = []

    # --- Check Minimum YoE ---
    min_yoe = knockout_criteria.get("min_yoe")
    if min_yoe is not None and min_yoe > 0:
        # Allow 30% tolerance (e.g., 5 years required → 3.5 years minimum)
        if candidate_yoe < min_yoe * 0.7:
            passed = False
            reasons.append(
                f"Insufficient experience: {candidate_yoe} years "
                f"(requires {min_yoe}+ years)"
            )

    # --- Check Degree Requirement ---
    required_degree = knockout_criteria.get("required_degree")
    if required_degree:
        text_lower = resume_text.lower()
        degree_indicators = [
            "bachelor", "master", "b.s", "b.e", "b.tech", "b.sc",
            "m.s", "m.tech", "m.sc", "mba", "ph.d", "phd",
            "degree", "university", "college", "institute",
        ]
        degree_found = any(indicator in text_lower for indicator in degree_indicators)
        if not degree_found:
            # Only flag as a warning, not an automatic disqualification
            reasons.append(
                f"No formal degree evidence found (JD mentions: {required_degree})"
            )

    return {
        "passed": passed,
        "reasons": reasons,
    }
