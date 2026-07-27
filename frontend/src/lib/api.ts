import axios, { AxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
});

import { toast } from "sonner";

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network Error: Cannot connect to the server. Please check your connection.");
      error.isGlobalError = true;
    } else if (error.response.status >= 500) {
      toast.error("Server Error: The backend encountered an unexpected condition.");
      error.isGlobalError = true;
    }
    return Promise.reject(error);
  }
);

// ── Types ──────────────────────────────────────────────────────────────────

export interface JobDescriptionResponse {
  job_description: string;
}

export interface CandidateResult {
  rank: number;
  candidate_name: string;
  email: string;
  filename: string;
  overall_score: number;
  recommendation: 'Strong fit' | 'Moderate fit' | 'Weak fit' | 'Disqualified' | string;
  skill_match: number;
  tf_idf_similarity: number;
  semantic_similarity: number;
  experience: number;
  llm_score: number;
  matched_skills: string[];
  missing_skills: string[];
  resume_skills: string[];
  years_of_experience: number;
  explanation: string;
  llm_verdict: string;
  strengths: string[];
  weaknesses: string[];
}

export interface AnalysisSession {
  id: string;
  created_at: string;
  candidates_count: number;
  average_score: number;
  job_description: string;
  candidates: CandidateResult[];
}

export interface HistorySessionItem {
  id: string;
  created_at: string;
  candidates_count: number;
  average_score: number;
}

// ── New session-based types ────────────────────────────────────────────────

export interface CreateSessionResponse {
  session_id: number;
  status: string;
  expires_at: string;
}

export interface UploadResumesResponse {
  session_id: number;
  accepted_count: number;
  accepted: string[];
  rejected: { filename: string; reason: string }[];
}

export interface CandidateCounts {
  total: number;
  uploaded: number;
  preprocessing: number;
  preprocessed: number;
  preprocessing_failed: number;
  evaluating: number;
  completed: number;
  evaluation_failed: number;
}

export interface SessionStatus {
  session_id: number;
  status: string;
  expires_at: string | null;
  candidates: CandidateCounts;
  ready_to_analyze: boolean;
  error_details: {
    candidate_id: number;
    filename: string;
    status: string;
    error: string;
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapCandidate = (c: any): CandidateResult => ({
  rank: c.rank,
  candidate_name: c.candidate_name,
  email: c.candidate_email || '',
  filename: c.filename,
  overall_score: c.score,
  recommendation: c.recommendation,
  skill_match: c.score_breakdown?.skill_match || 0,
  tf_idf_similarity: c.score_breakdown?.tfidf_similarity || c.score_breakdown?.keyword_match || 0,
  semantic_similarity: c.score_breakdown?.semantic_similarity || c.score_breakdown?.contextual_match || 0,
  experience: c.score_breakdown?.experience_score || c.score_breakdown?.experience || 0,
  llm_score: c.score_breakdown?.llm_score || c.score_breakdown?.ai_score || 0,
  matched_skills: c.matched_skills || [],
  missing_skills: c.missing_skills || [],
  resume_skills: c.resume_skills || [],
  years_of_experience: c.years_of_experience || 0,
  explanation: c.explanation || '',
  llm_verdict: c.llm_verdict || '',
  strengths: c.strengths || [],
  weaknesses: c.weaknesses || [],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAnalysisResponse = (data: any) => ({
  ...data,
  candidates: data.ranked_candidates ? data.ranked_candidates.map(mapCandidate) : [],
});

// ── New session-based API ──────────────────────────────────────────────────

/** Step 1: Create analysis session from JD. Returns session_id. */
export const createSession = async (
  payload: { job_description: string }
): Promise<CreateSessionResponse> => {
  const { data } = await api.post('/sessions', payload);
  return data;
};

/** Step 2: Upload resumes to an existing session. Returns 202 immediately. */
export const uploadResumesToSession = async (
  sessionId: number,
  formData: FormData
): Promise<UploadResumesResponse> => {
  const { data } = await api.post(`/sessions/${sessionId}/resumes`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
  return data;
};

/** Step 3: Poll session status for real-time preprocessing progress. */
export const getSessionStatus = async (sessionId: number): Promise<SessionStatus> => {
  const { data } = await api.get(`/sessions/${sessionId}/status`);
  return data;
};

/** Step 4: Trigger lean analysis (LLM only — NLP already done in BG). */
export const analyzeSessionNew = async (
  sessionId: number,
  payload: {
    use_ai: boolean;
    use_ollama: boolean;
    ollama_model: string;
    use_custom_weights: boolean;
    weight_skill?: number;
    weight_keyword?: number;
    weight_contextual?: number;
    weight_experience?: number;
    weight_ai?: number;
  }
) => {
  const { data } = await api.post(`/sessions/${sessionId}/analyze`, payload, {
    timeout: 300_000,
  });
  return mapAnalysisResponse(data);
};

// ── Legacy API (kept for backward compatibility) ──────────────────────────

export const submitJobDescription = async (text: string): Promise<JobDescriptionResponse> => {
  const { data } = await api.post('/job-description', { job_description: text });
  return { job_description: data.received_jd };
};

export const uploadResumes = async (formData: FormData, config?: AxiosRequestConfig) => {
  const { data } = await api.post('/upload-resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  });
  return mapAnalysisResponse(data);
};

export const uploadAndParse = async (formData: FormData, config?: AxiosRequestConfig) => {
  const { data } = await api.post('/upload-and-parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  });
  return data;
};

export const analyzeSession = async (sessionId: string | number, payload: Record<string, unknown>, config?: AxiosRequestConfig) => {
  const { data } = await api.post(`/analyze-session/${sessionId}`, payload, config);
  return mapAnalysisResponse(data);
};

export const analyzeJson = async (payload: Record<string, unknown>, config?: AxiosRequestConfig) => {
  const { data } = await api.post('/analyze-json', payload, config);
  return mapAnalysisResponse(data);
};

export const inviteCandidates = async (
  payload: { candidates: { name: string; email: string }[]; subject: string; message: string }
) => {
  const { data } = await api.post('/invite-candidates', payload);
  return data;
};

export const getAnalyses = async (): Promise<HistorySessionItem[]> => {
  const { data } = await api.get('/analyses');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    candidates_count: item.candidate_count,
    average_score: item.average_score || 0,
  }));
};

export const getAnalysisById = async (id: string): Promise<AnalysisSession> => {
  const { data } = await api.get(`/analyses/${id}`);
  return {
    id: data.analysis_id,
    created_at: new Date().toISOString(),
    candidates_count: data.ranked_candidates?.length || 0,
    average_score: Math.round(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.ranked_candidates?.reduce((acc: number, c: any) => acc + c.score, 0) /
        (data.ranked_candidates?.length || 1)
    ),
    job_description: data.job_description,
    candidates: data.ranked_candidates ? data.ranked_candidates.map(mapCandidate) : [],
  };
};

export const deleteAnalysis = async (id: string): Promise<void> => {
  await api.delete(`/analyses/${id}`);
};

export default api;
