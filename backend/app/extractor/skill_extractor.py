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

SKILL_DEPENDENCIES = {
    # Languages
    "C++": ["Programming Fundamentals"],
    "C": ["Programming Fundamentals"],
    "Java": ["Programming Fundamentals", "OOP"],
    "Python": ["Programming Fundamentals"],
    "JavaScript": ["Programming Fundamentals"],
    "TypeScript": ["JavaScript"],
    "Go": ["Programming Fundamentals"],
    "Rust": ["Programming Fundamentals"],
    "C#": ["Programming Fundamentals", "OOP"],
    "Kotlin": ["Java"],
    "Swift": ["Programming Fundamentals"],
    "PHP": ["Programming Fundamentals"],
    "Ruby": ["Programming Fundamentals"],

    # Frontend Basics
    "HTML": [],
    "CSS": ["HTML"],
    "Bootstrap": ["CSS"],
    "Tailwind CSS": ["CSS"],
    "Sass": ["CSS"],

    # Frontend Frameworks
    "React": ["JavaScript"],
    "Redux": ["React"],
    "Zustand": ["React"],
    "Vue.js": ["JavaScript"],
    "Nuxt.js": ["Vue.js"],
    "Angular": ["TypeScript"],
    "Next.js": ["React", "TypeScript"],
    "Remix": ["React"],
    "Svelte": ["JavaScript"],
    "SvelteKit": ["Svelte"],
    "Astro": ["HTML", "CSS", "JavaScript"],

    # Backend JavaScript
    "Node.js": ["JavaScript"],
    "Express.js": ["Node.js"],
    "NestJS": ["Node.js", "TypeScript"],
    "Socket.IO": ["Node.js"],
    "GraphQL": ["APIs"],

    # Python Backend
    "Flask": ["Python"],
    "Django": ["Python"],
    "FastAPI": ["Python"],
    "Celery": ["Python"],
    "SQLAlchemy": ["Python", "SQL"],

    # Java Backend
    "Spring": ["Java"],
    "Spring Boot": ["Java"],
    "Spring MVC": ["Spring"],
    "Spring Security": ["Spring Boot"],
    "Hibernate": ["Java", "SQL"],
    "JPA": ["Java", "SQL"],

    # .NET
    "ASP.NET Core": ["C#"],
    "Entity Framework": ["C#", "SQL"],

    # PHP
    "Laravel": ["PHP"],
    "CodeIgniter": ["PHP"],

    # Ruby
    "Rails": ["Ruby"],

    # Databases
    "SQL": [],
    "MySQL": ["SQL"],
    "PostgreSQL": ["SQL"],
    "SQLite": ["SQL"],
    "Oracle DB": ["SQL"],
    "MongoDB": ["NoSQL"],
    "Redis": ["NoSQL"],
    "Cassandra": ["NoSQL"],
    "Firebase": ["JavaScript"],
    "Supabase": ["PostgreSQL"],
    "Prisma": ["SQL", "Node.js"],

    # APIs
    "REST API": ["HTTP"],
    "GraphQL API": ["GraphQL"],
    "OpenAPI": ["REST API"],
    "gRPC": ["Networking"],

    # Version Control
    "Git": [],
    "GitHub": ["Git"],
    "GitLab": ["Git"],

    # DevOps
    "Linux": [],
    "Bash": ["Linux"],
    "Docker": ["Linux"],
    "Docker Compose": ["Docker"],
    "Kubernetes": ["Docker"],
    "Helm": ["Kubernetes"],
    "Terraform": ["Cloud Computing"],
    "Ansible": ["Linux"],
    "Nginx": ["Linux", "Networking"],
    "Apache": ["Linux"],

    # CI/CD
    "GitHub Actions": ["Git"],
    "Jenkins": ["Git"],
    "GitLab CI": ["Git"],

    # Cloud
    "AWS": ["Linux", "Networking"],
    "Azure": ["Linux"],
    "Google Cloud": ["Linux"],
    "Vercel": ["Next.js"],
    "Netlify": ["JavaScript"],

    # Authentication
    "JWT": ["REST API"],
    "OAuth": ["HTTP"],
    "OpenID Connect": ["OAuth"],
    "Keycloak": ["OAuth", "OpenID Connect"],
    "Ory Kratos": ["OAuth"],
    "Ory Hydra": ["OAuth", "OpenID Connect"],

    # Data Science
    "NumPy": ["Python"],
    "Pandas": ["Python"],
    "Matplotlib": ["Python"],
    "Seaborn": ["Matplotlib"],
    "Scikit-learn": ["NumPy", "Pandas"],
    "TensorFlow": ["Python", "Machine Learning"],
    "PyTorch": ["Python", "Machine Learning"],
    "XGBoost": ["Machine Learning"],

    # AI
    "Machine Learning": ["Python", "Statistics", "Linear Algebra"],
    "Deep Learning": ["Machine Learning"],
    "Computer Vision": ["Deep Learning"],
    "NLP": ["Deep Learning"],
    "LLMs": ["Deep Learning"],
    "LangChain": ["Python", "LLMs"],
    "LlamaIndex": ["Python", "LLMs"],
    "Vector Databases": ["LLMs"],
    "RAG": ["LLMs", "Vector Databases"],

    # Mobile
    "Android": ["Java"],
    "Jetpack Compose": ["Kotlin"],
    "React Native": ["React"],
    "Flutter": ["Dart"],
    "Dart": ["Programming Fundamentals"],

    # Testing
    "JUnit": ["Java"],
    "Mockito": ["JUnit"],
    "PyTest": ["Python"],
    "Jest": ["JavaScript"],
    "Cypress": ["JavaScript"],
    "Playwright": ["JavaScript"],

    # Misc
    "Networking": [],
    "HTTP": ["Networking"],
    "WebSockets": ["HTTP"],
    "Operating Systems": [],
    "DBMS": [],
    "OOP": [],
    "Data Structures": ["Programming Fundamentals"],
    "Algorithms": ["Data Structures"],
    "System Design": [
        "DBMS",
        "Networking",
        "Operating Systems",
        "REST API"
    ]
}

def _expand_skills(skill_set: set[str]) -> set[str]:
    """Recursively expand skills to include their dependencies."""
    expanded = set(skill_set)
    while True:
        added = set()
        for skill in expanded:
            parents = SKILL_DEPENDENCIES.get(skill, [])
            for parent in parents:
                if parent not in expanded:
                    added.add(parent)
        if not added:
            break
        expanded.update(added)
    return expanded

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

    all_skills_raw = set(extract_skills(full_text))
    context_skills_raw = set(extract_skills(experience_text + " " + projects_text))
    
    # Expand skills to include indirect dependencies
    all_skills = _expand_skills(all_skills_raw)
    context_skills = _expand_skills(context_skills_raw)
    
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