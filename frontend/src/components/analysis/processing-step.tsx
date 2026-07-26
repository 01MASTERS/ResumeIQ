"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { analyzeSessionNew, analyzeJson, CandidateResult } from "@/lib/api";
import { useSessionStatus } from "@/lib/useSessionStatus";
import { AIConfigData } from "./ai-config-step";
import { toast } from "sonner";
import { BrainCircuit, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
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
    evaluationProgress,
    failedCandidates,
    isCompleted,
  } = useSessionStatus(
    isJsonPath ? null : sessionId,
    !isJsonPath,               // only enable for the file-upload path
    { terminalStatuses: ["completed", "failed", "expired"] }
  );

  // Derived progress percentage
  const progress = isJsonPath
    ? 0   // JSON path has no polling; we'll drive it via analysisRan ref
    : evaluationProgress;

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
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (detail?.code === "PREPROCESSING_IN_PROGRESS") {
          // Backend race guard fired — wait 3s then retry
          toast.warning("Still preprocessing, retrying in 3 seconds…");
          setTimeout(() => {
            analysisRan.current = false; // allow retry
          }, 3000);
        } else {
          toast.error("Analysis failed. Please try again.");
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
          resumes: JSON.parse((uploadPayload as any).data),
          use_ollama: aiConfig?.use_ollama ?? false,
          ollama_model: aiConfig?.ollama_model ?? "",
        };
        const results = await analyzeJson(payload, { timeout: 300_000 });
        onComplete(results?.candidates ?? []);
      } catch {
        toast.error("Analysis failed. The backend may be unreachable.");
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

  const displayProgress = isJsonPath ? undefined : progress;
  const showProgress = displayProgress !== undefined;

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

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {icon}
      <div className="text-left">
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function buildAnalyzePayload(aiConfig: AIConfigData | null) {
  const payload: any = {
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
