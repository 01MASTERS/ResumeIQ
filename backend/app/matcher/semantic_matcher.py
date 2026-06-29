from sentence_transformers import SentenceTransformer, util

_model_instance = None

def get_transformer_model():
    global _model_instance
    if _model_instance is None:
        _model_instance = SentenceTransformer('all-MiniLM-L6-v2')
    return _model_instance

def calculate_semantic_similarity(jd_text: str, resume_text: str) -> float:
    if not jd_text.strip() or not resume_text.strip():
        return 0.0
    try:
        model = get_transformer_model()
        jd_embedding = model.encode(jd_text, convert_to_tensor=True)
        resume_embedding = model.encode(resume_text, convert_to_tensor=True)
        similarity = util.cos_sim(jd_embedding, resume_embedding)
        score = float(similarity.item() * 100)
        return max(0.0, min(100.0, score * 1.5))
    except Exception:
        return 0.0