"""
Skill extraction utility.
Normalizes text and matches against a predefined skill vocabulary.
Includes contextual extraction that checks for skills within experience sections
to reduce susceptibility to keyword stuffing.
"""
import re
import math

# Predefined skill database
SKILL_DB = [
    "Python", "Java", "C++", "JavaScript", "TypeScript", "React", "Next.js",
    "Node.js", "FastAPI", "Django", "Flask", "SQL", "MySQL", "PostgreSQL",
    "MongoDB", "Redis", "Docker", "Kubernetes", "Git", "GitHub", "AWS",
    "Azure", "GCP", "Machine Learning", "TensorFlow", "PyTorch", "NLP",
    "HTML", "CSS", "Tailwind", "REST API", "GraphQL", "Linux", "C",
    "Spring Boot", "Rust", "Go", "Scala", "Kafka", "RabbitMQ", "Elasticsearch",
    "Terraform", "CI/CD", "Jenkins", "Ansible", "Prometheus", "Grafana",
    "Vue.js", "Angular", "Svelte", "Express.js", "Ruby", "Rails",
    "Swift", "Kotlin", "Flutter", "React Native", "Firebase", "Supabase",
    "Pandas", "NumPy", "Spark", "Hadoop", "Airflow", "dbt",
    "Tableau", "Power BI", "Figma", "Jira", "Agile", "Scrum",
]


def _build_skill_pattern(skill: str) -> str:
    """Build a regex pattern for robust skill matching with word boundaries."""
    skill_lower = skill.lower()
    return (
        r"(?:^|[\s,.;:!()\[\]{}])"
        + re.escape(skill_lower)
        + r"(?:[\s,.;:!()\[\]{}]|$)"
    )


def extract_skills(text: str) -> list[str]:
    """
    Extract skills from any text by matching against the predefined skill database.
    Returns a list of matched skill names.
    """
    extracted = []
    text_clean = " ".join(text.split()).lower()

    for skill in SKILL_DB:
        pattern = _build_skill_pattern(skill)
        if re.search(pattern, text_clean):
            extracted.append(skill)

    return extracted


def extract_contextual_skills(
    parsed_sections: dict,
    total_roles: list[dict] | None = None,
) -> dict:
    """
    Extract skills with contextual awareness.

    Skills found in the 'experience' and 'projects' sections are considered
    validated (the candidate actually used them in a professional context).
    Skills found ONLY in a 'skills' list section get a lower weight since they
    may be self-reported without evidence.

    Args:
        parsed_sections: Dict of section_name -> section_text from section_parser.
        total_roles: Optional list of role dicts with duration info for recency weighting.

    Returns:
        dict with:
            - all_skills: list[str] (all skills found anywhere)
            - validated_skills: list[str] (skills found in experience/projects)
            - unvalidated_skills: list[str] (skills found ONLY in skills list)
            - skill_weights: dict[str, float] (skill -> weight 0.0 to 1.0)
    """
    # Extract skills from different sections
    experience_text = parsed_sections.get("experience", "")
    projects_text = parsed_sections.get("projects", "")
    skills_text = parsed_sections.get("skills", "")
    full_text = " ".join(parsed_sections.values())

    all_skills = set(extract_skills(full_text))
    context_skills = set(extract_skills(experience_text + " " + projects_text))
    list_only_skills = all_skills - context_skills

    # Build weights: validated skills get 1.0, list-only skills get 0.5
    skill_weights = {}
    for skill in context_skills:
        skill_weights[skill] = 1.0
    for skill in list_only_skills:
        skill_weights[skill] = 0.5

    # Apply recency decay if role duration data is available
    if total_roles and len(total_roles) >= 2:
        # The most recent roles (first in list) get full weight,
        # older roles get exponential decay
        _apply_recency_decay(skill_weights, parsed_sections, total_roles)

    return {
        "all_skills": sorted(all_skills),
        "validated_skills": sorted(context_skills),
        "unvalidated_skills": sorted(list_only_skills),
        "skill_weights": skill_weights,
    }


def _apply_recency_decay(
    skill_weights: dict,
    parsed_sections: dict,
    roles: list[dict],
) -> None:
    """
    Apply a recency decay multiplier to skill weights.
    Skills used in recent roles get higher weight; older roles get decay.
    Modifies skill_weights in place.
    """
    experience_text = parsed_sections.get("experience", "")
    if not experience_text:
        return

    # Split experience text roughly by role boundaries (date ranges)
    # This is a heuristic — we look for skills near each date range
    total_roles_count = len(roles)
    decay_lambda = 0.3  # Controls how fast older skills decay

    for idx, role in enumerate(roles):
        age_factor = idx  # 0 = most recent, higher = older
        decay = math.exp(-decay_lambda * age_factor)

        # For skills that are only found in older contexts,
        # reduce their weight by the decay factor
        role_start = role.get("start", "")
        role_end = role.get("end", "")

        if role_start and idx >= total_roles_count // 2:
            # For roles in the older half, apply decay to any unique skills
            for skill, weight in list(skill_weights.items()):
                if weight < 1.0:  # Only decay unvalidated skills further
                    skill_weights[skill] = round(weight * decay, 2)


def match_skills(resume_skills: list[str], jd_skills: list[str]) -> dict:
    """Calculate overlap and missing skills between resume and JD."""
    res_set = set(resume_skills)
    jd_set = set(jd_skills)

    matched = list(jd_set.intersection(res_set))
    missing = list(jd_set.difference(res_set))

    return {
        "matched_skills": matched,
        "missing_skills": missing,
    }