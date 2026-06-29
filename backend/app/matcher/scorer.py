"""
Hybrid scoring engine.
Combines 5 components: Skill Match (30%), TF-IDF (10%), Semantic (15%),
Experience (15%), and Gemini LLM (30%) for human-like candidate evaluation.
"""


def extract_candidate_name(text: str, filename: str) -> str:
    """Extract candidate name from the first line of resume text."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if lines:
        first_line = lines[0]
        if len(first_line) < 50 and not any(
            char in first_line for char in ["@", "/", "\\", ":"]
        ):
            return first_line
    return filename


def calculate_experience_score(
    candidate_yoe: float,
    jd_required_yoe: float | None,
    candidate_seniority: int,
) -> float:
    """
    Calculate an experience score (0-100) based on YoE and seniority.

    If the JD specifies a YoE requirement, score is based on how closely
    the candidate matches. Otherwise, a general score based on total experience.
    """
    if jd_required_yoe and jd_required_yoe > 0:
        # Ratio-based scoring: 100% if >= 80% match, scaled down below
        ratio = candidate_yoe / jd_required_yoe
        if ratio >= 0.8:
            yoe_score = 100.0
        elif ratio >= 0.5:
            yoe_score = 60.0 + (ratio - 0.5) / 0.3 * 40.0
        else:
            yoe_score = max(0.0, ratio / 0.5 * 60.0)
    else:
        # General scoring: 0 YoE = 30, scales up to 100 at 7+ years
        yoe_score = min(100.0, 30.0 + candidate_yoe * 10.0)

    # Seniority bonus: higher seniority adds up to 10 points
    seniority_bonus = min(10.0, candidate_seniority * 2.0)

    return min(100.0, yoe_score + seniority_bonus)


def generate_insights(
    skill_match: int,
    tfidf: int,
    semantic: int,
    experience_score: int,
    llm_score: int,
    matched: list[str],
    missing: list[str],
    total_jd: int,
    candidate_yoe: float,
    llm_verdict: str,
    knockout_result: dict | None = None,
) -> dict:
    """
    Generate human-readable strengths, weaknesses, and explanation
    from all scoring components.
    """
    strengths = []
    weaknesses = []

    # --- Skill Match Insights ---
    if skill_match >= 75:
        strengths.append("Strong direct technical skill alignment with job requirements")
    elif skill_match >= 40:
        strengths.append("Covers core skill requirements")
    else:
        weaknesses.append("Limited overlap with required technical skills")

    # --- Semantic Insights ---
    if semantic >= 70:
        strengths.append("High conceptual and domain relevance to the role")
    elif semantic < 50:
        weaknesses.append("Resume context differs significantly from job requirements")

    # --- TF-IDF Insights ---
    if tfidf >= 60:
        strengths.append("Resume language closely mirrors job description terminology")

    # --- Experience Insights ---
    if experience_score >= 80:
        strengths.append(f"Relevant experience level ({candidate_yoe} years)")
    elif experience_score >= 50:
        strengths.append(f"Adequate experience ({candidate_yoe} years)")
    elif candidate_yoe > 0:
        weaknesses.append(f"Limited experience ({candidate_yoe} years)")

    # --- LLM Insights ---
    if llm_score >= 70:
        strengths.append("Strong qualitative profile with demonstrated impact")
    elif llm_score >= 40:
        pass  # Neutral — don't flag
    elif llm_score > 0:
        weaknesses.append("Limited evidence of measurable impact or project complexity")

    # --- Missing Skills ---
    for skill in missing[:3]:
        weaknesses.append(f"Missing: {skill}")
    if len(missing) > 3:
        weaknesses.append(f"+ {len(missing) - 3} additional required skills not found")

    # --- Knockout Failures ---
    if knockout_result and not knockout_result.get("passed", True):
        for reason in knockout_result.get("reasons", []):
            weaknesses.append(f"[KNOCKOUT] {reason}")

    # Ensure at least one item in each list
    if not strengths:
        strengths.append("No notable alignment with the position's core competencies")
    if not weaknesses:
        weaknesses.append("No critical gaps identified in foundational profile")

    # --- Build Explanation ---
    explanation_parts = [
        f"Matched {len(matched)} of {total_jd} required skills ({skill_match}% skill match).",
        f"Semantic relevance: {semantic}%. TF-IDF correlation: {tfidf}%.",
        f"Experience: {candidate_yoe} years (score: {experience_score}%).",
    ]
    if llm_score > 0:
        explanation_parts.append(f"AI recruiter assessment: {llm_score}%.")
    if llm_verdict and "unavailable" not in llm_verdict.lower():
        explanation_parts.append(f"Verdict: {llm_verdict}")

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "explanation": " ".join(explanation_parts),
    }


def execute_hybrid_scoring(
    resume_skills: list[str],
    jd_skills: list[str],
    jd_text: str,
    resume_text: str,
    experience_data: dict | None = None,
    jd_required_yoe: float | None = None,
    llm_result: dict | None = None,
    knockout_result: dict | None = None,
    skill_context: dict | None = None,
    custom_weights: dict | None = None,
) -> dict:
    """
    Execute the enhanced 5-component hybrid scoring pipeline.

    Weights:
        - 30% Skill Match (with contextual weighting)
        - 10% TF-IDF Cosine Similarity
        - 15% Semantic Vector Similarity
        - 15% Experience & Seniority Score
        - 30% Gemini LLM Qualitative Score

    Falls back to the original 3-component formula if experience and LLM
    data are not available (graceful degradation).
    """
    from app.matcher.tfidf_matcher import calculate_tfidf_similarity
    from app.matcher.semantic_matcher import calculate_semantic_similarity

    # --- Component 1: Skill Match ---
    if not jd_skills:
        skill_match_score = 0.0
        matched_skills = []
        missing_skills = []
    else:
        res_set = set(resume_skills)
        jd_set = set(jd_skills)
        matched_skills = list(jd_set.intersection(res_set))
        missing_skills = list(jd_set.difference(res_set))

        if skill_context and skill_context.get("skill_weights"):
            # Weighted skill match: validated skills count more
            weights = skill_context["skill_weights"]
            weighted_match = sum(
                weights.get(s, 0.5) for s in matched_skills
            )
            max_possible = len(jd_set)
            skill_match_score = min(100.0, (weighted_match / max_possible) * 100 * 1.25)
        else:
            skill_match_score = min(100.0, (len(matched_skills) / len(jd_set)) * 100 * 1.25)

    # --- Component 2: TF-IDF ---
    tfidf_score = calculate_tfidf_similarity(jd_text, resume_text)

    # --- Component 3: Semantic ---
    semantic_score = calculate_semantic_similarity(jd_text, resume_text)

    # --- Component 4: Experience ---
    candidate_yoe = 0.0
    candidate_seniority = 0
    if experience_data:
        candidate_yoe = experience_data.get("total_yoe", 0.0)
        candidate_seniority = experience_data.get("max_seniority", 0)
    experience_score = calculate_experience_score(
        candidate_yoe, jd_required_yoe, candidate_seniority
    )

    # --- Component 5: LLM ---
    llm_score = 0.0
    llm_verdict = ""
    if llm_result:
        llm_score = float(llm_result.get("overall_score", 0))
        llm_verdict = llm_result.get("verdict", "")

    # --- Determine scoring mode ---
    has_experience = experience_data is not None
    has_llm = llm_result is not None and llm_score > 0

    applied_weights = {}

    if custom_weights:
        # Use custom weights provided by the user
        w_skill = float(custom_weights.get("skill", 0)) / 100
        w_keyword = float(custom_weights.get("keyword", 0)) / 100
        w_contextual = float(custom_weights.get("contextual", 0)) / 100
        w_experience = float(custom_weights.get("experience", 0)) / 100
        w_ai = float(custom_weights.get("ai", 0)) / 100
        
        # If a feature is disabled or missing, its weight is gracefully handled by its score being 0 or scaled down.
        # But if the user provided weights summing to 100, we trust them.
        final_score_raw = (
            w_skill * skill_match_score
            + w_keyword * tfidf_score
            + w_contextual * semantic_score
            + w_experience * experience_score
            + w_ai * llm_score
        )
        applied_weights = {
            "skill": f"{int(w_skill*100)}%",
            "keyword": f"{int(w_keyword*100)}%",
            "contextual": f"{int(w_contextual*100)}%",
            "experience": f"{int(w_experience*100)}%",
            "ai": f"{int(w_ai*100)}%" if has_llm and w_ai > 0 else "0%"
        }
    else:
        # Fallback default weights
        if has_experience and has_llm:
            w_skill, w_keyword, w_contextual, w_experience, w_ai = 0.25, 0.05, 0.10, 0.10, 0.50
        elif has_experience:
            w_skill, w_keyword, w_contextual, w_experience, w_ai = 0.25, 0.25, 0.35, 0.15, 0.0
        elif has_llm:
            w_skill, w_keyword, w_contextual, w_experience, w_ai = 0.30, 0.10, 0.10, 0.0, 0.50
        else:
            w_skill, w_keyword, w_contextual, w_experience, w_ai = 0.50, 0.25, 0.25, 0.0, 0.0
            
        final_score_raw = (
            w_skill * skill_match_score
            + w_keyword * tfidf_score
            + w_contextual * semantic_score
            + w_experience * experience_score
            + w_ai * llm_score
        )
        applied_weights = {
            "skill": f"{int(w_skill*100)}%",
            "keyword": f"{int(w_keyword*100)}%",
            "contextual": f"{int(w_contextual*100)}%",
            "experience": f"{int(w_experience*100)}%" if has_experience else "0%",
            "ai": f"{int(w_ai*100)}%" if has_llm else "0%"
        }

    final_score = round(final_score_raw)

    # --- Recommendation ---
    if knockout_result and not knockout_result.get("passed", True):
        recommendation = "Disqualified"
    elif final_score >= 80:
        recommendation = "Strong fit"
    elif final_score >= 60:
        recommendation = "Moderate fit"
    else:
        recommendation = "Weak fit"

    # --- Round all sub-scores ---
    sm_int = round(skill_match_score)
    ti_int = round(tfidf_score)
    se_int = round(semantic_score)
    ex_int = round(experience_score)
    llm_int = round(llm_score)

    # --- Generate insights ---
    insights = generate_insights(
        sm_int, ti_int, se_int, ex_int, llm_int,
        matched_skills, missing_skills, len(jd_skills),
        candidate_yoe, llm_verdict, knockout_result,
    )

    return {
        "score": final_score,
        "score_breakdown": {
            "skill_match": sm_int,
            "tfidf_similarity": ti_int,
            "semantic_similarity": se_int,
            "experience_score": round(experience_score),
            "llm_score": round(llm_score) if has_llm else 0,
            "applied_weights": applied_weights
        },
        "recommendation": recommendation,
        "matched_skills": sorted(matched_skills),
        "missing_skills": sorted(missing_skills),
        "strengths": insights["strengths"],
        "weaknesses": insights["weaknesses"],
        "explanation": insights["explanation"],
        "llm_verdict": llm_verdict,
        "years_of_experience": candidate_yoe,
    }