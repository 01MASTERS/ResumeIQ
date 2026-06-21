"""
Section-based resume parser.
Segments raw resume text into structured sections using heuristic header detection.
"""
import re

# Common resume section header patterns (case-insensitive)
SECTION_PATTERNS = {
    "summary": r"(?:professional\s+)?summary|(?:career\s+)?objective|about\s*me|profile(?:\s+summary)?",
    "experience": r"(?:work\s+|professional\s+)?experience|employment(?:\s+history)?|work\s+history",
    "education": r"education(?:al)?(?:\s+background)?|academics?|qualifications",
    "skills": r"(?:technical\s+|core\s+|key\s+)?skills|technologies|competenc(?:ies|y)|tech(?:nical)?\s+stack|tools?\s+(?:and|&)\s+technologies",
    "projects": r"(?:personal\s+|academic\s+|key\s+)?projects|portfolio",
    "certifications": r"certifications?|licen[sc]es?|accreditations?|awards?(?:\s+(?:and|&)\s+certifications?)?",
}


def parse_sections(text: str) -> dict:
    """
    Parse resume text into structured sections.

    Returns a dictionary where keys are section names (e.g., 'experience',
    'education', 'skills') and values are the raw text content of each section.
    Content before the first recognized header is stored under 'header'.
    """
    lines = text.split("\n")
    sections = {}
    current_section = "header"
    current_content = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_content.append("")
            continue

        matched_section = _detect_section_header(stripped)
        if matched_section:
            # Save accumulated content for the previous section
            content = "\n".join(current_content).strip()
            if content:
                sections[current_section] = content
            current_section = matched_section
            current_content = []
        else:
            current_content.append(stripped)

    # Save the last section
    content = "\n".join(current_content).strip()
    if content:
        sections[current_section] = content

    return sections


def _detect_section_header(line: str) -> str | None:
    """
    Check if a line is a section header by matching it against known patterns.
    Returns the canonical section name if matched, else None.
    """
    # Strip common decorators: dashes, colons, equals, underscores, pipes
    clean = re.sub(r"^[\s\-=_|:*#]+|[\s\-=_|:*#]+$", "", line)
    # Remove non-alpha characters for matching
    alpha_only = re.sub(r"[^a-zA-Z\s]", "", clean).strip().lower()

    # Too long to be a header, or too short to be meaningful
    if len(alpha_only) > 50 or len(alpha_only) < 2:
        return None

    for section_name, pattern in SECTION_PATTERNS.items():
        if re.fullmatch(pattern, alpha_only, re.IGNORECASE):
            return section_name

    return None
