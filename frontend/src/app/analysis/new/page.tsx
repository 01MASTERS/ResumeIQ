"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JobDescriptionStep } from "@/components/analysis/job-description-step";
import { ResumeUploadStep } from "@/components/analysis/resume-upload-step";
import { AIConfigStep, AIConfigData } from "@/components/analysis/ai-config-step";
import { ProcessingStep } from "@/components/analysis/processing-step";
import { LeaderboardStep } from "@/components/analysis/leaderboard-step";
import { CandidateResult } from "@/lib/api";
import { Check } from "lucide-react";
import Stepper, { Step as StepperStep } from "@/components/Stepper";

type Step = 'job_description' | 'resume_upload' | 'ai_config' | 'processing' | 'results';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
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
  const [currentStep, setCurrentStep] = useState<Step>('job_description');

  const [jobDescription, setJobDescription] = useState<string>("");
  const [uploadPayload, setUploadPayload] = useState<{ type: 'files', files: File[] } | { type: 'json', data: string } | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfigData | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);

  const stepLabels: Record<string, string> = {
    'job_description': 'Job Details',
    'resume_upload': 'Candidates',
    'ai_config': 'AI Engine'
  };

  const stepIndices: Record<Step, number> = {
    'job_description': 1,
    'resume_upload': 2,
    'ai_config': 3,
    'processing': 4,
    'results': 5
  };
  const currentStepIndex = stepIndices[currentStep];

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
        <Stepper
          className="!p-0 !min-h-0 !items-start w-full"
          activeStep={currentStepIndex}
          initialStep={1}
          footerClassName="hidden"
          stepCircleContainerClassName="!max-w-full !w-full !shadow-none !border-none !bg-transparent !m-0 !p-0"
          stepContainerClassName={`sticky top-0 z-50 bg-background/95 backdrop-blur-xl rounded-b-3xl border-b border-white/[0.02] shadow-sm mb-12 py-6 relative px-4 md:px-12 max-w-2xl mx-auto ${currentStepIndex > 3 ? 'hidden' : 'hidden md:flex'}`}
          contentClassName="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative overflow-hidden min-h-[550px] flex flex-col w-full"
          disableStepIndicators={true} // disable clicking on the steps directly since we have validation
        >
          <StepperStep>
            <JobDescriptionStep
              key="jd"
              onNext={(jd) => {
                setJobDescription(jd);
                setCurrentStep('resume_upload');
              }}
            />
          </StepperStep>
          <StepperStep>
            <ResumeUploadStep
              key="upload"
              onNext={(payload) => {
                setUploadPayload(payload);
                setCurrentStep('ai_config');
              }}
              onBack={() => setCurrentStep('job_description')}
            />
          </StepperStep>
          <StepperStep>
            <AIConfigStep
              key="config"
              initialConfig={aiConfig || undefined}
              onNext={(config) => {
                setAiConfig(config);
                setCurrentStep('processing');
              }}
              onBack={() => setCurrentStep('resume_upload')}
            />
          </StepperStep>
        </Stepper>

        <AnimatePresence mode="wait">
          {currentStep === 'processing' && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative overflow-hidden min-h-[550px] flex flex-col"
            >
              <ProcessingStep
                jobDescription={jobDescription}
                uploadPayload={uploadPayload}
                aiConfig={aiConfig}
                onComplete={(res) => {
                  setResults(res);
                  setCurrentStep('results');
                }}
                onError={() => {
                  setCurrentStep('ai_config');
                }}
              />
            </motion.div>
          )}

          {currentStep === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-sm p-6 md:p-10 relative overflow-hidden min-h-[550px] flex flex-col"
            >
              <LeaderboardStep
                results={results}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
