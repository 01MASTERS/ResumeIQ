import fitz  # PyMuPDF
import docx

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text() + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {str(e)}")

def extract_text(file_path: str, ext: str) -> str:
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    else:
        raise ValueError("Unsupported file type for extraction")