"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

const formSchema = z.object({
  resumes: z
    .any()
    .refine((files) => files && files.length > 0, "Please select at least one resume file."),
  use_ai: z.boolean().default(true),
  use_custom_weights: z.boolean().default(false),
  weight_skill: z.number().min(0).max(100).default(25),
  weight_keyword: z.number().min(0).max(100).default(5),
  weight_contextual: z.number().min(0).max(100).default(10),
  weight_experience: z.number().min(0).max(100).default(10),
  weight_ai: z.number().min(0).max(100).default(50),
}).refine(data => {
  if (data.use_custom_weights) {
    const total = data.weight_skill + data.weight_keyword + data.weight_contextual + data.weight_experience + (data.use_ai ? data.weight_ai : 0);
    return total === 100;
  }
  return true;
}, {
  message: "Custom weights must sum up to exactly 100%.",
  path: ["use_custom_weights"]
});

type FormData = z.infer<typeof formSchema>;

interface ScoreBreakdown {
  skill_match: number;
  tfidf_similarity: number;
  semantic_similarity: number;
  experience_score: number;
  llm_score: number;
  applied_weights?: Record<string, string>;
}

interface Candidate {
  rank: number;
  candidate_name: string;
  candidate_email?: string | null;
  filename: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  recommendation: string;
  resume_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  explanation: string;
  years_of_experience: number | null;
  llm_verdict: string | null;
}

interface AnalysisResponse {
  summary: string;
  ranked_candidates: Candidate[];
}

interface CandidateEvaluationProps {
  requirementsText: string | null;
}

export default function CandidateEvaluation({ requirementsText }: CandidateEvaluationProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [scoreCutoff, setScoreCutoff] = useState<number>(0);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("custom");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadingSteps = [
    "Extracting document text...",
    "Parsing candidate details...",
    "Analyzing keyword fit...",
    "Calculating semantic match...",
    "Generating AI verdict...",
    "Finalizing leaderboard ranking..."
  ];
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);

  const EMAIL_TEMPLATES: Record<string, { subject: string, body: string }> = {
    custom: { subject: "", body: "" },
    interview: {
      subject: "Interview Invitation: {{company_name}}",
      body: "Dear {{name}},\n\nWe were very impressed by your resume and would like to invite you to an interview at {{company_name}}.\n\nThe interview will take place on {{date}} at {{time}}.\nMode: {{mode}}\n\nPlease let us know if this time works for you.\n\nBest regards,\nThe Hiring Team"
    },
    assessment: {
      subject: "Assessment Invitation: {{company_name}}",
      body: "Dear {{name}},\n\nThank you for applying to {{company_name}}. We would like to invite you to complete a technical assessment as the next step in our process.\n\nPlease complete the assessment by {{date}}.\n\nBest regards,\nThe Hiring Team"
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setEmailTemplate(key);
    setEmailSubject(EMAIL_TEMPLATES[key].subject);
    setEmailBody(EMAIL_TEMPLATES[key].body);
  };

  const sendEmails = async () => {
    setIsSending(true);
    setEmailSuccess(null);
    try {
      const payload = {
        candidates: Array.from(selectedCandidates).map(name => {
          const c = analysisResult?.ranked_candidates.find(x => x.candidate_name === name);
          return { name, email: c?.candidate_email || null };
        }),
        subject: emailSubject,
        message: emailBody
      };
      
      const res = await fetch("http://localhost:8000/invite-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors ? data.errors.join(", ") : "Failed to send emails");
      
      setEmailSuccess(data.message);
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setEmailSuccess(null);
        setSelectedCandidates(new Set());
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsEmailModalOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  const {
    handleSubmit,
    register,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      use_ai: true,
      use_custom_weights: false,
      weight_skill: 25,
      weight_keyword: 5,
      weight_contextual: 10,
      weight_experience: 10,
      weight_ai: 50,
    },
  });

  const selectedFiles: FileList | null = watch("resumes");
  const use_custom_weights = watch("use_custom_weights");
  const use_ai = watch("use_ai");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMsg(`Format rejected: ${file.name}. Only PDF and DOCX extensions are accepted.`);
        setValue("resumes", null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`File too large: ${file.name} exceeds 10MB limit.`);
        setValue("resumes", null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
  };

  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      const urls: Record<string, string> = {};
      Array.from(selectedFiles).forEach(file => {
        urls[file.name] = URL.createObjectURL(file);
      });
      setFileUrls(urls);
      
      return () => {
        Object.values(urls).forEach(url => URL.revokeObjectURL(url));
      };
    } else {
      setFileUrls({});
    }
  }, [selectedFiles]);

  useEffect(() => {
    if (isSubmitting) {
      const interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % loadingSteps.length);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setLoadingStepIdx(0);
    }
  }, [isSubmitting, loadingSteps.length]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (requirementsText) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!requirementsText) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dataTransfer = new DataTransfer();
      const existingNames = new Set<string>();
      
      // Preserve currently selected files
      if (selectedFiles) {
        Array.from(selectedFiles).forEach(file => {
          dataTransfer.items.add(file);
          existingNames.add(file.name);
        });
      }
      
      // Append newly dropped files (avoiding duplicates by name)
      Array.from(e.dataTransfer.files).forEach(file => {
        if (!existingNames.has(file.name)) {
          dataTransfer.items.add(file);
        }
      });

      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        // Dispatch native change event so react-hook-form registers it naturally
        const event = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
    }
  };

  const toggleCardExpansion = (rank: number) => {
    setExpandedCards((prev) => ({ ...prev, [rank]: !prev[rank] }));
  };

  const onSubmit = async (data: FormData) => {
    setAnalysisResult(null);
    setErrorMsg(null);
    setSelectedCandidates(new Set());

    if (!requirementsText) {
      setErrorMsg("Please configure evaluation requirements first.");
      return;
    }

    const formData = new FormData();
    formData.append("job_description", requirementsText);
    formData.append("use_ai", data.use_ai ? "true" : "false");
    formData.append("use_custom_weights", data.use_custom_weights ? "true" : "false");
    formData.append("weight_skill", data.weight_skill.toString());
    formData.append("weight_keyword", data.weight_keyword.toString());
    formData.append("weight_contextual", data.weight_contextual.toString());
    formData.append("weight_experience", data.weight_experience.toString());
    formData.append("weight_ai", data.weight_ai.toString());
    
    if (selectedFiles) {
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append("files", selectedFiles[i]);
      }
    }

    try {
      const res = await fetch("http://localhost:8000/upload-resume", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        const errorMsg = typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail);
        throw new Error(errorMsg || "Analysis failed.");
      }
      setAnalysisResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to the backend.");
    }
  };

  const getRecStyles = (rec: string) => {
    if (rec === "Strong fit") return "bg-green-100 text-green-800 border-green-300";
    if (rec === "Moderate fit") return "bg-amber-100 text-amber-800 border-amber-300";
    if (rec === "Disqualified") return "bg-gray-900 text-white border-gray-700";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  const { ref, ...restRegister } = register("resumes");

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">AI-Powered Candidate Evaluation</h2>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col relative group">
          <label htmlFor="resumes-input" className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Upload Candidate Profiles (PDF / DOCX)
          </label>
          <div className="relative">
            <div className={`absolute -inset-0.5 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500 ${errors.resumes ? "bg-rose-500" : "bg-gradient-to-r from-purple-500 to-pink-500"} ${!requirementsText ? "hidden" : ""}`}></div>
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative w-full bg-slate-900/80 backdrop-blur-sm border-2 border-dashed rounded-xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center ${
                errors.resumes ? "border-rose-500/50" : 
                isDragging ? "border-purple-500 bg-purple-500/10 scale-[1.02]" : 
                requirementsText ? "border-slate-700 hover:border-purple-500/50" : "border-slate-800 opacity-50 cursor-not-allowed"
              }`}
            >
              <svg className={`w-8 h-8 mb-3 ${isDragging ? "text-purple-400 animate-bounce" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className="text-sm text-slate-300 font-semibold mb-1">Drag and drop files here</p>
              <p className="text-xs text-slate-500 mb-4">or click to browse from your computer</p>
              <input
                id="resumes-input"
                type="file"
                multiple
                accept=".pdf,.docx"
                disabled={!requirementsText}
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/20 file:transition-colors disabled:cursor-not-allowed cursor-pointer focus:outline-none"
                {...restRegister}
                ref={(e) => {
                  ref(e);
                  fileInputRef.current = e;
                }}
                onChange={(e) => {
                  restRegister.onChange(e);
                  handleFileChange(e);
                }}
              />
            </div>
          </div>
          {errors.resumes && (
            <span className="text-rose-400 text-xs mt-2 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              {errors.resumes.message as string}
            </span>
          )}
          
          {selectedFiles && selectedFiles.length > 0 && !errorMsg && (
            <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl max-h-40 overflow-y-auto backdrop-blur-sm shadow-inner">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Selected Files ({selectedFiles.length})
              </p>
              <ul className="text-xs text-slate-300 divide-y divide-slate-800/50">
                {Array.from(selectedFiles).map((file, i) => (
                  <li key={i} className="py-2 flex justify-between items-center group">
                    <span className="truncate max-w-md font-medium group-hover:text-purple-300 transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500 group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      {file.name}
                    </span>
                    <span className="text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" {...register("use_ai")} />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            <span className="ml-3 text-sm font-semibold text-slate-300">Enable AI Analysis (Deep qualitative review)</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" {...register("use_custom_weights")} />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              <span className="ml-3 text-sm font-semibold text-slate-300">Customize Scoring Weights</span>
            </label>
          </div>
          
          {errors.use_custom_weights && (
            <span className="text-rose-400 text-xs font-medium">{errors.use_custom_weights.message as string}</span>
          )}

          {use_custom_weights && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Skill Alignment (%)</label>
                <input type="number" {...register("weight_skill", { valueAsNumber: true })} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Keyword Fit (%)</label>
                <input type="number" {...register("weight_keyword", { valueAsNumber: true })} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Contextual (%)</label>
                <input type="number" {...register("weight_contextual", { valueAsNumber: true })} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Experience (%)</label>
                <input type="number" {...register("weight_experience", { valueAsNumber: true })} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
              </div>
              {use_ai && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">AI Evaluation (%)</label>
                  <input type="number" {...register("weight_ai", { valueAsNumber: true })} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !requirementsText}
          className="relative group overflow-hidden bg-slate-800 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-white/5 w-full sm:w-auto self-start"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: "200% auto", animation: "glow 3s linear infinite" }}></div>
          <div className="relative flex items-center justify-center gap-2">
            Initiate Candidate Screening
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
        </button>
      </form>

      {errorMsg && (
        <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-3 backdrop-blur-sm">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {isSubmitting && (
        <div className="mt-10 p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-purple-500/30 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 animate-pulse"></div>
          <div className="relative w-24 h-24 mb-6">
            <svg className="animate-spin w-full h-full text-purple-500/20" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
               <svg className="w-10 h-10 text-indigo-400 animate-pulse drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-3 relative z-10">AI Analysis in Progress</h3>
          <div className="h-6 overflow-hidden relative z-10">
             <p key={loadingStepIdx} className="text-indigo-300 font-medium text-sm tracking-wide animate-[slideUp_0.5s_ease-out]">
               {loadingSteps[loadingStepIdx]}
             </p>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="mt-10 animate-float" style={{ animationDuration: '8s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              Evaluation Leaderboard
            </h3>
            <span className="bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1.5 rounded-full font-mono font-bold border border-indigo-500/20 flex items-center gap-2 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              {analysisResult.summary}
            </span>
          </div>

          {/* Scoring Legend */}
          <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 mb-8 relative z-10 shadow-inner">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Evaluation Criteria Guide
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-300 block mb-1">Skill Alignment</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Direct matching of required technical skills.</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-300 block mb-1">Keyword Fit</span>
                <span className="text-[10px] text-slate-500 leading-tight block">TF-IDF analysis of professional terminology.</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-300 block mb-1">Contextual</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Semantic similarity using embedding models.</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-300 block mb-1">Experience Fit</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Alignment with required years of experience.</span>
              </div>
              <div className="hidden lg:block">
                <span className="text-[10px] font-bold text-slate-300 block mb-1">AI Evaluation</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Deep qualitative review via Large Language Model.</span>
              </div>
            </div>
          </div>

          {/* Score Cut-off Filter */}
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 mb-6 shadow-inner">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
              <label htmlFor="cutoff" className="text-sm font-bold text-slate-300">Minimum Score Cut-off:</label>
            </div>
            <div className="flex items-center gap-4">
              <input 
                id="cutoff"
                type="range" 
                min="0" 
                max="100" 
                value={scoreCutoff} 
                onChange={(e) => setScoreCutoff(Number(e.target.value))}
                className="w-32 sm:w-48 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-lg font-mono font-bold text-white bg-slate-800 px-3 py-1 rounded border border-slate-700 w-14 text-center">
                {scoreCutoff}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-5 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {analysisResult.ranked_candidates.filter(c => c.score >= scoreCutoff).length === 0 ? (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800">
                <p className="text-slate-400 font-medium">No candidates meet the minimum score of {scoreCutoff}.</p>
              </div>
            ) : (
              analysisResult.ranked_candidates.filter(c => c.score >= scoreCutoff).map((candidate) => (
              <div 
                key={candidate.rank} 
                className={`shrink-0 bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 transition-all duration-300 relative overflow-hidden group hover:shadow-2xl ${
                  candidate.recommendation === "Disqualified"
                    ? "border border-slate-800 opacity-70 hover:opacity-100"
                    : "border border-white/5 hover:border-indigo-500/30 hover:-translate-y-1"
                }`}
              >
                {/* Subtle gradient background for high-rank cards */}
                {candidate.rank <= 3 && candidate.recommendation !== "Disqualified" && (
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${candidate.rank === 1 ? 'from-amber-500/10 to-orange-500/5' : 'from-indigo-500/10 to-purple-500/5'} rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:opacity-100 opacity-50 transition-opacity duration-500`}></div>
                )}

                {/* Rank Badge */}
                <div className={`absolute top-0 left-0 text-white text-xs font-black px-4 py-1.5 rounded-br-xl font-mono shadow-md ${
                  candidate.recommendation === "Disqualified" ? "bg-slate-800 text-slate-400" : 
                  candidate.rank === 1 ? "bg-gradient-to-r from-amber-500 to-orange-500" :
                  candidate.rank === 2 ? "bg-gradient-to-r from-slate-400 to-slate-500" :
                  candidate.rank === 3 ? "bg-gradient-to-r from-amber-700 to-orange-800" :
                  "bg-slate-800 text-slate-300"
                }`}>
                  #{candidate.rank}
                </div>
                
                {/* Header: Name, YoE, Score, Recommendation */}
                <div className="flex justify-between items-start mt-3 mb-6 relative z-10">
                  <div className="flex items-start gap-3 max-w-[60%]">
                    <input 
                      type="checkbox" 
                      className="mt-1.5 w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 cursor-pointer shrink-0"
                      checked={selectedCandidates.has(candidate.candidate_name)}
                      onChange={(e) => {
                        const newSet = new Set(selectedCandidates);
                        if (e.target.checked) newSet.add(candidate.candidate_name);
                        else newSet.delete(candidate.candidate_name);
                        setSelectedCandidates(newSet);
                      }}
                    />
                    <div>
                      <h4 className="text-xl font-extrabold text-slate-100 truncate flex items-center gap-2">
                        {fileUrls[candidate.filename] ? (
                          <a href={fileUrls[candidate.filename]} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline decoration-indigo-500/50 underline-offset-4 transition-colors flex items-center gap-2">
                            {candidate.candidate_name}
                            <svg className="w-4 h-4 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                          </a>
                        ) : (
                          candidate.candidate_name
                        )}
                        {candidate.rank === 1 && <svg className="w-5 h-5 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>}
                      </h4>
                      <div className="flex flex-col gap-1 mt-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-500 font-mono truncate flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            {candidate.filename}
                          </p>
                          {candidate.years_of_experience !== null && candidate.years_of_experience > 0 && (
                            <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/20">
                              {candidate.years_of_experience} yrs exp
                            </span>
                          )}
                          {candidate.candidate_email && (
                            <span className="bg-purple-500/10 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                              {candidate.candidate_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="relative group/score cursor-default">
                      <div className={`absolute -inset-2 rounded-lg blur opacity-0 group-hover/score:opacity-30 transition duration-500 ${getScoreBarColor(candidate.score).replace('bg-', 'bg-')}`}></div>
                      <span className="relative text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight drop-shadow-sm">
                        {candidate.score}<span className="text-sm text-slate-500 font-bold">/100</span>
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded shadow-sm border ${
                      candidate.recommendation === "Strong fit" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" :
                      candidate.recommendation === "Moderate fit" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5" :
                      candidate.recommendation === "Disqualified" ? "bg-slate-800 text-slate-500 border-slate-700" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5"
                    }`}>
                      {candidate.recommendation}
                    </span>
                  </div>
                </div>

                {/* Dynamic Score Breakdown */}
                <div className={`grid gap-2 bg-slate-950/50 rounded-xl p-3 mb-5 border border-white/5 relative z-10 ${candidate.score_breakdown.llm_score > 0 ? "grid-cols-5" : "grid-cols-4"}`}>
                  {[
                    { label: "Skill Alignment", weight: candidate.score_breakdown.applied_weights ? candidate.score_breakdown.applied_weights.skill : (candidate.score_breakdown.llm_score > 0 ? "25%" : "45%"), score: candidate.score_breakdown.skill_match },
                    { label: "Keyword Fit", weight: candidate.score_breakdown.applied_weights ? candidate.score_breakdown.applied_weights.keyword : (candidate.score_breakdown.llm_score > 0 ? "5%" : "20%"), score: candidate.score_breakdown.tfidf_similarity },
                    { label: "Contextual", weight: candidate.score_breakdown.applied_weights ? candidate.score_breakdown.applied_weights.contextual : (candidate.score_breakdown.llm_score > 0 ? "10%" : "25%"), score: candidate.score_breakdown.semantic_similarity },
                    { label: "Experience Fit", weight: candidate.score_breakdown.applied_weights ? candidate.score_breakdown.applied_weights.experience : "10%", score: candidate.score_breakdown.experience_score },
                    ...(candidate.score_breakdown.llm_score > 0 ? [{ label: "AI Evaluation", weight: candidate.score_breakdown.applied_weights ? candidate.score_breakdown.applied_weights.ai : "50%", score: candidate.score_breakdown.llm_score }] : []),
                  ].map((item, idx) => (
                    <div key={idx} className={idx !== 0 ? "border-l border-white/5 pl-2" : ""}>
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none tracking-wider">{item.label}</p>
                        <p className="text-[8px] text-slate-600 hidden sm:block">{item.weight}</p>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 mb-1 overflow-hidden">
                        <div className={`h-full rounded-full relative ${
                          item.score >= 70 ? "bg-emerald-500" : item.score >= 40 ? "bg-amber-500" : "bg-rose-500"
                        }`} style={{ width: `${item.score}%` }}>
                          <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                      </div>
                      <p className="text-xs font-black text-slate-200">{item.score}%</p>
                    </div>
                  ))}
                </div>

                {/* LLM Verdict */}
                {candidate.llm_verdict && !candidate.llm_verdict.toLowerCase().includes("unavailable") && (
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-xl p-4 mb-5 relative z-10">
                    <p className="text-xs font-bold text-indigo-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                      AI Evaluation Summary
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{candidate.llm_verdict}</p>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 relative z-10">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 hover:bg-emerald-500/10 transition-colors">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      Key Strengths
                    </p>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      {candidate.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 leading-tight">
                          <span className="text-emerald-500 mt-0.5 opacity-70">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3.5 hover:bg-rose-500/10 transition-colors">
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      Areas for Consideration
                    </p>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      {candidate.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 leading-tight">
                          <span className="text-rose-500 mt-0.5 opacity-70">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Expandable Skills Section */}
                <div className="relative z-10 pt-2 border-t border-white/5">
                  <button
                    onClick={() => toggleCardExpansion(candidate.rank)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 focus:outline-none w-full justify-center sm:justify-start"
                  >
                    <span className={`transform transition-transform duration-300 ${expandedCards[candidate.rank] ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </span>
                    {expandedCards[candidate.rank] ? "Hide Skill Analytics" : "View Skill Analytics"}
                  </button>

                  <div className={`grid transition-all duration-300 ease-in-out ${expandedCards[candidate.rank] ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden flex flex-col gap-4">
                      <div>
                        <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Aligned Competencies</h5>
                        <div className="flex flex-wrap gap-2">
                          {candidate.matched_skills.length > 0 ? (
                            candidate.matched_skills.map((skill) => (
                              <span key={skill} className="bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-sm">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">No aligned competencies identified.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Identified Skill Gaps</h5>
                        <div className="flex flex-wrap gap-2">
                          {candidate.missing_skills.length > 0 ? (
                            candidate.missing_skills.map((skill) => (
                              <span key={skill} className="bg-rose-500/10 text-rose-300 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-rose-500/20 shadow-sm">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">All required competencies met!</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Complete Skill Profile</h5>
                        <div className="flex flex-wrap gap-2">
                          {candidate.resume_skills.length > 0 ? (
                            candidate.resume_skills.map((skill) => (
                              <span key={skill} className="bg-slate-800 text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-md border border-slate-700">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-600 italic">No skills extracted.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* Floating Invite Button */}
      {selectedCandidates.size > 0 && (
        <div className="fixed bottom-10 right-10 z-40">
          <button 
            onClick={() => setIsEmailModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-8 rounded-2xl shadow-[0_10px_30px_rgba(168,85,247,0.4)] border border-purple-400 flex items-center gap-2 transition-all hover:-translate-y-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            Invite Selected Candidates ({selectedCandidates.size})
          </button>
        </div>
      )}

      {/* Email Composition Modal */}
      {isEmailModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsEmailModalOpen(false)}></div>
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                Compose Invitation
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
              {emailSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg text-sm font-medium">
                  {emailSuccess}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Select Template</label>
                <select 
                  value={emailTemplate} 
                  onChange={handleTemplateChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-purple-500 outline-none"
                >
                  <option value="custom">Custom Email</option>
                  <option value="interview">Interview Invitation</option>
                  <option value="assessment">Assessment Invitation</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Automatically populates placeholders like {'{{name}}'}, {'{{company_name}}'}, etc.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Subject</label>
                <input 
                  type="text" 
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-purple-500 outline-none"
                  placeholder="e.g., Invitation to Interview"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-slate-300 mb-1">Message Body</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full flex-1 min-h-[200px] bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-purple-500 outline-none custom-scrollbar"
                  placeholder="Write your custom message here..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={sendEmails}
                disabled={isSending || !emailSubject.trim() || !emailBody.trim()}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : "Send Invitations"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}