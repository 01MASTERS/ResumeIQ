import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
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
}

// Helpers
const mapCandidate = (c: any): CandidateResult => ({
  rank: c.rank,
  candidate_name: c.candidate_name,
  email: c.candidate_email || "",
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
  explanation: c.explanation || "",
  llm_verdict: c.llm_verdict || "",
  strengths: c.strengths || [],
  weaknesses: c.weaknesses || []
});

const mapAnalysisResponse = (data: any) => ({
  ...data,
  candidates: data.ranked_candidates ? data.ranked_candidates.map(mapCandidate) : []
});

// API Functions

export const submitJobDescription = async (text: string): Promise<JobDescriptionResponse> => {
  const { data } = await api.post('/job-description', { job_description: text });
  return { job_description: data.received_jd };
};

export const uploadResumes = async (formData: FormData, config: any) => {
  const { data } = await api.post('/upload-resume', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    ...config,
  });
  return mapAnalysisResponse(data);
};

export const analyzeJson = async (payload: any, config: any) => {
  const { data } = await api.post('/analyze-json', payload, config);
  return mapAnalysisResponse(data);
};

export const inviteCandidates = async (payload: { candidates: {name: string, email: string}[], subject: string, message: string }) => {
  const { data } = await api.post('/invite-candidates', payload);
  return data;
};

export const getAnalyses = async (): Promise<HistorySessionItem[]> => {
  const { data } = await api.get('/analyses');
  return data.map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    candidates_count: item.candidate_count
  }));
};

export const getAnalysisById = async (id: string): Promise<AnalysisSession> => {
  const { data } = await api.get(`/analyses/${id}`);
  return {
    id: data.analysis_id,
    created_at: new Date().toISOString(),
    candidates_count: data.ranked_candidates?.length || 0,
    average_score: Math.round(data.ranked_candidates?.reduce((acc: number, c: any) => acc + c.score, 0) / (data.ranked_candidates?.length || 1)),
    job_description: data.job_description,
    candidates: data.ranked_candidates ? data.ranked_candidates.map(mapCandidate) : []
  };
};

export const deleteAnalysis = async (id: string): Promise<void> => {
  await api.delete(`/analyses/${id}`);
};

export default api;
