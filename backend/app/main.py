import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.connection import engine, Base
from app.routes.jd_routes import router as jd_router
from app.routes.resume_routes import router as resume_router

# Direct generation technique guarantees database schema activation on engine instantiation
Base.metadata.create_all(bind=engine)
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="ResumeIQ Production-Grade Core Matrix Pipeline Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"message": "Backend working"}

app.include_router(jd_router)
app.include_router(resume_router)