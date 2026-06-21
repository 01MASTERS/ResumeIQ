import re

EMAIL_REGEX = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+"
FALLBACK_REGEX = r"([a-zA-Z0-9_.+-]+)\s*@\s*([a-zA-Z0-9-]+)\s*\.\s*([a-zA-Z0-9-.]+)"

def extract_email(text: str) -> str | None:
    """
    Extracts the first valid email address found in the resume text,
    handling potential formatting spaces from PDF extraction.
    """
    match = re.search(EMAIL_REGEX, text)
    if match:
        return match.group(0).lower()
        
    fallback = re.search(FALLBACK_REGEX, text)
    if fallback:
        # Reconstruct the email without spaces
        return f"{fallback.group(1)}@{fallback.group(2)}.{fallback.group(3)}".lower()
        
    return None
