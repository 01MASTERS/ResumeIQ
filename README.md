# ResumeIQ Intelligence Hub

ResumeIQ is an intelligent Candidate Screening & Evaluation Platform that automates the recruitment pipeline. It uses AI, natural language processing, semantic search, and TF-IDF keyword extraction to accurately rank resumes against job descriptions. It also features a fully-fledged email automation pipeline to seamlessly invite top candidates for interviews or assessments.

## Features
- **AI-Powered Screening**: Contextual and semantic matching between resumes and job descriptions using Sentence Transformers.
- **Dynamic Leaderboard**: Custom weighting system (Skill Match, Keyword Fit, Contextual, Experience Fit, AI Score) to rank candidates precisely.
- **Automated Contact Extraction**: Intelligently extracts candidate emails and phone numbers from raw PDFs and DOCX files.
- **Email Automation Module**: Send personalized template-based emails (Interview, Assessment, Custom) to selected candidates with dynamic placeholders.
- **Modern UI**: Built with Next.js and Tailwind CSS featuring advanced glassmorphism and beautiful animations.

## Architecture
- **Frontend**: Next.js 14, React, Tailwind CSS, TypeScript.
- **Backend**: FastAPI, Python 3.12, PyMuPDF, Sentence Transformers.
- **Database**: MySQL 8.0, SQLAlchemy, Alembic (Migrations).
- **Deployment**: Fully dockerized with `docker-compose`.

## Getting Started

### Prerequisites
- Docker and Docker Compose installed.

### Setup Instructions

1. **Environment Variables**
   Create an `.env` file in the `backend/` directory with your email credentials for the Email Automation module:
   ```env
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   FROM_EMAIL=your_email@gmail.com
   ```

2. **Run the Application via Docker**
   From the root directory, simply run:
   ```bash
   docker compose up --build -d
   ```
   This will spin up:
   - MySQL Database Container (`db`)
   - FastAPI Backend Container (`backend`) exposed on `http://localhost:8000`

   *Note: Database migrations (`alembic upgrade head`) are run automatically on container startup!*

3. **Run the Frontend locally**
   (If you prefer to run the frontend outside of docker):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Access the frontend at `http://localhost:3000`.

## Updating Database Schema
If you change the backend models, run:
```bash
docker compose exec backend alembic revision --autogenerate -m "Description"
docker compose restart backend
```
