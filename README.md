# ResumeIQ Intelligence Hub

ResumeIQ is a cutting-edge **Candidate Screening & Evaluation Platform** designed to intelligently automate the recruitment pipeline. By leveraging advanced Natural Language Processing (NLP), semantic search embeddings, and TF-IDF keyword extraction, ResumeIQ accurately evaluates and ranks applicant resumes against custom job descriptions. 

With a fully integrated email automation pipeline and a stunning modern web interface, ResumeIQ transforms a tedious manual HR process into a seamless, automated, and intelligent workflow.

---

## 🌟 Key Features

- **AI-Powered Screening**: Contextual and semantic matching using state-of-the-art Sentence Transformers.
- **Dynamic Leaderboard**: Custom weighting systems (Skill Match, Keyword Fit, Contextual Fit, Experience Fit, AI Score) to rank candidates precisely according to the HR recruiter's priorities.
- **Smart Contact Extraction**: Intelligently extracts candidate emails, phone numbers, and names directly from raw PDF and DOCX files.
- **Email Automation Module**: Send personalized, template-based emails (Interview Invitations, Assessments, Custom Messages) to selected candidates with dynamic placeholders (e.g., `{{name}}`).
- **Premium User Experience**: Built with Next.js and Tailwind CSS featuring advanced glassmorphism, dynamic loading states, and buttery-smooth animations.

---

## 🏗️ Project Architecture & Structure

ResumeIQ is built as a modern, containerized full-stack application. It is separated into a Python-based intelligent backend and a React-based frontend.

```text
resumeiq/
│
├── backend/                       # FastAPI Python Backend
│   ├── app/                       # Core Application Code
│   │   ├── extractor/             # Regex & heuristic extractors (Email, Phone, Skills, YoE)
│   │   ├── matcher/               # Scoring engines (TF-IDF, Semantic embeddings, LLM Evaluator)
│   │   ├── models/                # SQLAlchemy Database Models (Candidate, Analysis)
│   │   ├── parser/                # PDF and DOCX text extraction tools
│   │   ├── routes/                # FastAPI Endpoints (Resume Uploads, JD parsing, Email Sending)
│   │   ├── schemas/               # Pydantic validation schemas
│   │   └── services/              # External services (SMTP Email Service)
│   ├── alembic/                   # Database Migration Scripts
│   ├── Dockerfile                 # Backend container configuration
│   └── requirements.txt           # Python dependencies
│
├── frontend/                      # Next.js React Frontend
│   ├── src/
│   │   ├── app/                   # Next.js 14 App Router (Pages, Layout, Globals)
│   │   └── components/            # React Components
│   │       ├── CandidateEvaluation.tsx  # Interactive Leaderboard & Email Modal
│   │       └── RequirementsForm.tsx     # Job Description setup form
│   ├── tailwind.config.ts         # Custom Tailwind theme and animations
│   └── package.json               # Node.js dependencies
│
├── docker-compose.yml             # Orchestrates the DB, Backend, and Frontend containers
└── README.md                      
```

### 🧠 Backend (FastAPI + AI)
The backend is responsible for all heavy lifting. When resumes are uploaded:
1. **Parser Layer**: `PyMuPDF` and `python-docx` extract raw text.
2. **Extraction Layer**: Regular expressions isolate contact details, while heuristic algorithms estimate Years of Experience.
3. **Matcher Layer**: 
   - Uses `scikit-learn` to calculate TF-IDF keyword overlap.
   - Uses `sentence-transformers/all-MiniLM-L6-v2` to calculate deep semantic similarity.
   - Uses an LLM agent to provide a human-readable verdict and identify strengths/weaknesses.
4. **Database Layer**: Saves historical analyses to a MySQL database using SQLAlchemy.

### 💻 Frontend (Next.js)
The frontend uses Next.js 14's App Router for fast performance and optimal rendering. 
- **Tailwind CSS**: Heavily customized to implement glowing orbs, floating animations, and glassmorphic modal portals.
- **State Management**: Uses React Hooks and `react-hook-form` to manage complex file uploads and email template states.

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed.
- Node.js (Optional, only if running the frontend locally outside of Docker).

### Setup Instructions

1. **Configure Environment Variables**
   Create an `.env` file inside the `backend/` directory to enable the Email Automation module:
   ```env
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_hr_email@gmail.com
   SMTP_PASSWORD=your_app_password
   FROM_EMAIL=your_hr_email@gmail.com
   ```

2. **Launch the Application**
   From the root directory, simply run:
   ```bash
   docker compose up --build -d
   ```
   This command spins up:
   - A **MySQL Database Container** (`db`)
   - The **FastAPI Backend Container** (`backend`) exposed on `http://localhost:8000`

   *Note: Database migrations (`alembic upgrade head`) execute automatically when the backend container starts.*

3. **Access the Frontend**
   To run the frontend locally:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:3000` in your browser to access the ResumeIQ Intelligence Hub.

---

## 💾 Database Migrations
If you modify any SQLAlchemy models in the backend and need to update the database schema:
```bash
docker compose exec backend alembic revision --autogenerate -m "Describe your changes"
docker compose restart backend
```
