"""
Experience and seniority extractor.
Parses date ranges from resume experience sections, calculates total Years of Experience,
and extracts job titles to determine seniority level.
"""
import re
from datetime import datetime


# Date patterns to match various formats like "Jan 2021", "January 2021", "2021"
DATE_PATTERN = (
    r"(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\s+\d{4}|\d{4})"
)
DATE_RANGE_PATTERN = (
    rf"({DATE_PATTERN})\s*[-–—to]+\s*({DATE_PATTERN}|[Pp]resent|[Cc]urrent|[Nn]ow)"
)

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9,
    "september": 9, "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

SENIORITY_KEYWORDS = {
    "intern": 1, "trainee": 1, "apprentice": 1,
    "junior": 2, "jr": 2, "associate": 2, "entry level": 2,
    "mid": 3, "intermediate": 3,
    "senior": 4, "sr": 4,
    "lead": 5, "staff": 5, "team lead": 5,
    "principal": 6, "architect": 6,
    "director": 7, "head of": 7, "engineering manager": 7,
    "vp": 8, "vice president": 8, "cto": 9, "ceo": 9,
}

SENIORITY_LABELS = {
    0: "unknown", 1: "intern", 2: "junior", 3: "mid-level",
    4: "senior", 5: "lead/staff", 6: "principal/architect",
    7: "director", 8: "vp", 9: "c-level",
}


def _parse_date(date_str: str) -> datetime | None:
    """Parse a date string into a datetime object."""
    date_str = date_str.strip()

    if date_str.lower() in ("present", "current", "now"):
        return datetime.now()

    # Try "Month Year" format (e.g., "Jan 2021", "January 2021")
    parts = date_str.split()
    if len(parts) == 2:
        month_str = parts[0].lower().rstrip(".")
        year_str = parts[1]
        if month_str in MONTH_MAP and year_str.isdigit():
            return datetime(int(year_str), MONTH_MAP[month_str], 1)

    # Try "Year" only (e.g., "2021")
    if date_str.isdigit() and len(date_str) == 4:
        return datetime(int(date_str), 1, 1)

    return None


def extract_experience(experience_text: str) -> dict:
    """
    Extract structured experience data from the experience section text.

    Returns:
        dict with keys:
            - total_yoe: float (total years of experience)
            - roles: list of dicts with start, end, duration_months, duration_years
            - max_seniority: int (highest seniority level detected)
            - seniority_label: str (human-readable seniority label)
    """
    if not experience_text or not experience_text.strip():
        return {
            "total_yoe": 0.0,
            "roles": [],
            "max_seniority": 0,
            "seniority_label": "unknown",
        }

    # Find all date ranges in the text
    ranges = re.findall(DATE_RANGE_PATTERN, experience_text, re.IGNORECASE)

    total_months = 0
    roles = []

    for start_str, end_str in ranges:
        start_date = _parse_date(start_str)
        end_date = _parse_date(end_str)

        if start_date and end_date and end_date >= start_date:
            months = ((end_date.year - start_date.year) * 12
                      + (end_date.month - start_date.month))
            months = max(months, 1)  # Minimum 1 month
            total_months += months
            roles.append({
                "start": start_str.strip(),
                "end": end_str.strip(),
                "duration_months": months,
                "duration_years": round(months / 12, 1),
            })

    # Detect highest seniority from job title keywords
    max_seniority = 0
    text_lower = experience_text.lower()
    for keyword, level in SENIORITY_KEYWORDS.items():
        if keyword in text_lower:
            max_seniority = max(max_seniority, level)

    return {
        "total_yoe": round(total_months / 12, 1),
        "roles": roles,
        "max_seniority": max_seniority,
        "seniority_label": SENIORITY_LABELS.get(max_seniority, "unknown"),
    }


def extract_jd_yoe_requirement(jd_text: str) -> float | None:
    """
    Extract the minimum years of experience requirement from a job description.
    Returns None if no requirement is found.
    """
    patterns = [
        r"(\d+)\+?\s*(?:years?|yrs?)[\s\w]*(?:of\s+)?(?:experience|exp)",
        r"(?:minimum|at\s+least|min)\s+(\d+)\s*(?:years?|yrs?)",
        r"(\d+)\s*-\s*\d+\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)",
    ]

    for pattern in patterns:
        match = re.search(pattern, jd_text, re.IGNORECASE)
        if match:
            return float(match.group(1))

    return None
