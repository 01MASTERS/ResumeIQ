"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { analyzeSessionNew, analyzeJson, CandidateResult } from "@/lib/api";
import { useSessionStatus } from "@/lib/useSessionStatus";
import { AIConfigData } from "./ai-config-step";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";

interface ProcessingStepProps {
  sessionId: number | null;
  jobDescription: string;
  /** Only used for the legacy JSON path */
  uploadPayload?: { type: "json"; data: string } | null;
  aiConfig: AIConfigData | null;
  onComplete: (results: CandidateResult[]) => void;
  onError: () => void;
}

export function ProcessingStep({
  sessionId,
  jobDescription,
  uploadPayload,
  aiConfig,
  onComplete,
  onError,
}: ProcessingStepProps) {
  const isJsonPath = uploadPayload?.type === "json";

  // Real-time status from the backend — polls /sessions/{id}/status every 2s
  const {
    status,
  } = useSessionStatus(
    isJsonPath ? null : sessionId,
    !isJsonPath,               // only enable for the file-upload path
    { terminalStatuses: ["completed", "failed", "expired"] }
  );



  const candidatesTotal = status?.candidates.total ?? 0;
  const candidatesCompleted = status?.candidates.completed ?? 0;
  const candidatesEvaluating = status?.candidates.evaluating ?? 0;

  // Track whether we already fired the analyze call to avoid double-calling
  const analysisRan = useRef(false);

  // ── File-upload path: fire /sessions/{id}/analyze once, then poll ──
  useEffect(() => {
    if (isJsonPath || !sessionId || analysisRan.current) return;
    analysisRan.current = true;

    const run = async () => {
      try {
        const payload = buildAnalyzePayload(aiConfig);
        const results = await analyzeSessionNew(sessionId, payload);

        if (results?.candidates?.length) {
          onComplete(results.candidates);
        } else {
          // Empty result — show leaderboard anyway
          onComplete([]);
        }
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail;
        if (detail?.code === "PREPROCESSING_IN_PROGRESS") {
          // Backend race guard fired — wait 3s then retry
          toast.warning("Still preprocessing, retrying in 3 seconds…");
          setTimeout(() => {
            analysisRan.current = false; // allow retry
          }, 3000);
        } else {
          if (!(err as any).isGlobalError) {
            toast.error("Analysis failed. Please try again.");
          }
          setTimeout(() => onError(), 1500);
        }
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJsonPath, sessionId]);

  // ── JSON path: fire /analyze-json ─────────────────────────────────────
  useEffect(() => {
    if (!isJsonPath || analysisRan.current) return;
    analysisRan.current = true;

    const run = async () => {
      try {
        const payload = {
          job_description: jobDescription,
          resumes: JSON.parse((uploadPayload as { data: string }).data),
          use_ollama: aiConfig?.use_ollama ?? false,
          ollama_model: aiConfig?.ollama_model ?? "",
        };
        const results = await analyzeJson(payload, { timeout: 300_000 });
        onComplete(results?.candidates ?? []);
      } catch (err: any) {
        if (!err.isGlobalError) {
          toast.error("Analysis failed. The backend may be unreachable.");
        }
        setTimeout(() => onError(), 1500);
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJsonPath]);

  // ─── Derived message ──────────────────────────────────────────────────
  const getMessage = () => {
    if (isJsonPath) return "Running AI evaluation…";
    if (!status) return "Initializing evaluation…";
    const s = status.status;
    if (s === "analyzing") {
      if (candidatesEvaluating > 0)
        return `AI evaluation — ${candidatesCompleted}/${candidatesTotal} complete`;
      if (candidatesCompleted === candidatesTotal && candidatesTotal > 0)
        return "Finalising results…";
      return "Running AI evaluation…";
    }
    return "Preparing analysis…";
  };


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex flex-col items-center justify-center py-10 w-full"
    >
      {/* ── Central animated orb ── */}
      <div className="relative mb-12 flex items-center justify-center min-h-[160px]">
        <Loader />
      </div>

      <div className="w-full max-w-md space-y-8 text-center">
        {/* ── Status message ── */}
        <div className="h-8 relative overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.h3
              key={getMessage()}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-medium absolute w-full text-gradient"
            >
              {getMessage()}
            </motion.h3>
          </AnimatePresence>
        </div>


      </div>
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAnalyzePayload(aiConfig: AIConfigData | null) {
  const payload: {
    use_ai: boolean;
    use_ollama: boolean;
    ollama_model: string;
    use_custom_weights: boolean;
    weight_skill?: number;
    weight_keyword?: number;
    weight_contextual?: number;
    weight_experience?: number;
    weight_ai?: number;
  } = {
    use_ai: aiConfig?.use_ai ?? true,
    use_ollama: aiConfig?.use_ollama ?? false,
    ollama_model: aiConfig?.ollama_model ?? "",
    use_custom_weights: aiConfig?.use_custom_weights ?? false,
  };
  if (aiConfig?.use_custom_weights && aiConfig.weights) {
    payload.weight_skill = aiConfig.weights.skill_match;
    payload.weight_keyword = aiConfig.weights.keyword_match;
    payload.weight_contextual = aiConfig.weights.contextual_match;
    payload.weight_experience = aiConfig.weights.experience;
    payload.weight_ai = aiConfig.weights.ai_score;
  }
  return payload;
}
