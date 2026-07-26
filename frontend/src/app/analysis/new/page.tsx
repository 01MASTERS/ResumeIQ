"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JobDescriptionStep } from "@/components/analysis/job-description-step";
import { ResumeUploadStep } from "@/components/analysis/resume-upload-step";
import { AIConfigStep, AIConfigData } from "@/components/analysis/ai-config-step";
import { ProcessingStep } from "@/components/analysis/processing-step";
import { LeaderboardStep } from "@/components/analysis/leaderboard-step";
import {
  CandidateResult,
  createSession,
  uploadResumesToSession,
  analyzeJson,
} from "@/lib/api";
import { toast } from "sonner";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import Stepper, { Step as StepperStep } from "@/components/Stepper";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Step = "job_description" | "resume_upload" | "ai_config" | "processing" | "results";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function NewAnalysisPage() {
  const [currentStep, setCurrentStep] = useState<Step>("job_description");

  const [jobDescription, setJobDescription] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);

  // For JSON path only — no session needed
  const [jsonPayload, setJsonPayload] = useState<string | null>(null);

  const [aiConfig, setAiConfig] = useState<AIConfigData | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [isJdExpanded, setIsJdExpanded] = useState(false);

  const stepIndices: Record<Step, number> = {
    job_description: 1,
    resume_upload: 2,
    ai_config: 3,
    processing: 4,
    results: 5,
  };
  const currentStepIndex = stepIndices[currentStep];

  // ── Step 1: JD submitted → create session immediately ──────────────────
  const handleJDNext = async (jd: string) => {
    setJobDescription(jd);
    try {
      const { session_id } = await createSession({ job_description: jd });
      setSessionId(session_id);
    } catch {
      // Non-fatal — the session will be created on upload instead.
      // Show a warning so the user knows.
      toast.warning("Could not connect to backend. Check that the server is running.");
    }
    setCurrentStep("resume_upload");
  };

  // ── Step 2: Files uploaded → fire POST /sessions/{id}/resumes ──────────
  const handleUploadNext = async (
    payload: { type: "files"; files: File[] } | { type: "json"; data: string }
  ) => {
    if (payload.type === "json") {
      setJsonPayload(payload.data);
      setCurrentStep("ai_config");
      return;
    }

    // File path — need a valid sessionId
    if (!sessionId) {
      toast.error("No active session. Please restart from the Job Description step.");
      setCurrentStep("job_description");
      return;
    }

    try {
      const formData = new FormData();
      payload.files.forEach((f) => formData.append("files", f));

      const result = await uploadResumesToSession(sessionId, formData);

      if (result.accepted_count === 0) {
        toast.error("No valid files could be processed. Please try again.");
        return;
      }

      if (result.rejected.length > 0) {
        toast.warning(
          `${result.rejected.length} file${result.rejected.length > 1 ? "s" : ""} rejected: ${result.rejected.map((r) => r.filename).join(", ")}`
        );
      }

      // 202 Accepted — BG preprocessing has started, move to AI Config
      setCurrentStep("ai_config");
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.message || "Upload failed.";
      toast.error(msg);
    }
  };

  // ── Step 3: AI Config submitted → move to processing ──────────────────
  const handleAiConfigNext = (config: AIConfigData) => {
    setAiConfig(config);
    setCurrentStep("processing");
  };

  // ── Step 4: Analysis complete ──────────────────────────────────────────
  const handleAnalysisComplete = (res: CandidateResult[]) => {
    setResults(res);
    setCurrentStep("results");
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setJobDescription("");
    setSessionId(null);
    setJsonPayload(null);
    setAiConfig(null);
    setResults([]);
    setIsJdExpanded(false);
    setCurrentStep("job_description");
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-5xl mx-auto py-4"
    >
      {/* Background glows */}
      <div className="fixed -top-40 -right-40 w-[400px] h-[400px] bg-primary/[0.03] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed -bottom-40 -left-40 w-[400px] h-[400px] bg-accent/[0.02] blur-[100px] rounded-full pointer-events-none z-0" />

      <motion.div variants={itemVariants} className="relative z-10">
        {/* ── Stepper (steps 1-3 only) ── */}
        <div className={currentStepIndex > 3 ? "hidden" : "block"}>
          <Stepper
            className="!p-0 !min-h-0 !items-start w-full"
            activeStep={currentStepIndex}
            initialStep={1}
            footerClassName="hidden"
            stepCircleContainerClassName="!max-w-full !w-full !shadow-none !border-none !bg-transparent !m-0 !p-0"
            stepContainerClassName={`sticky top-0 z-50 bg-background/95 backdrop-blur-xl rounded-b-3xl border-b border-white/[0.02] shadow-sm mb-12 py-6 relative px-4 md:px-12 max-w-2xl mx-auto ${
              currentStepIndex > 3 ? "hidden" : "hidden md:flex"
            }`}
            contentClassName="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative min-h-[550px] flex flex-col w-full"
            disableStepIndicators={true}
          >
            {/* Step 1: Job Description */}
            <StepperStep>
              <JobDescriptionStep
                key="jd"
                onNext={handleJDNext}
              />
            </StepperStep>

            {/* Step 2: Resume Upload */}
            <StepperStep>
              <ResumeUploadStep
                key="upload"
                onNext={handleUploadNext}
                onBack={() => setCurrentStep("job_description")}
              />
            </StepperStep>

            {/* Step 3: AI Config (with live preprocessing progress) */}
            <StepperStep>
              <AIConfigStep
                key="config"
                initialConfig={aiConfig || undefined}
                sessionId={sessionId}
                onNext={handleAiConfigNext}
                onBack={() => setCurrentStep("resume_upload")}
              />
            </StepperStep>
          </Stepper>
        </div>

        {/* ── Steps 4 & 5: full-width panels ── */}
        <AnimatePresence mode="wait">
          {currentStep === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative overflow-hidden flex flex-col justify-center min-h-[400px]"
            >
              <ProcessingStep
                sessionId={sessionId}
                jobDescription={jobDescription}
                uploadPayload={jsonPayload ? { type: "json", data: jsonPayload } : null}
                aiConfig={aiConfig}
                onComplete={handleAnalysisComplete}
                onError={() => setCurrentStep("ai_config")}
              />
            </motion.div>
          )}

          {currentStep === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative flex flex-col gap-6"
            >
              {/* JD preview card */}
              <Card className="bg-white/[0.02] border-white/[0.06]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 text-primary">
                    <FileText className="w-3.5 h-3.5" /> Job Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative flex flex-col items-start">
                    <p
                      className={`text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed transition-all ${
                        isJdExpanded ? "" : "line-clamp-3"
                      }`}
                    >
                      {jobDescription}
                    </p>
                    {jobDescription && jobDescription.length > 250 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsJdExpanded(!isJdExpanded)}
                        className="mt-2 text-[10px] text-primary hover:text-primary/80 h-6 px-2 -ml-2"
                      >
                        {isJdExpanded ? (
                          <><ChevronUp className="w-3 h-3 mr-1" /> Show Less</>
                        ) : (
                          <><ChevronDown className="w-3 h-3 mr-1" /> View Full Description</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <LeaderboardStep results={results} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
