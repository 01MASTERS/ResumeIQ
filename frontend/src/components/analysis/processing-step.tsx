"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { analyzeJson, CandidateResult, analyzeSession } from "@/lib/api";
import { AIConfigData } from "./ai-config-step";
import { toast } from "sonner";
import { BrainCircuit } from "lucide-react";

interface ProcessingStepProps {
  jobDescription: string;
  uploadPayload: { type: 'files', files: File[] } | { type: 'json', data: string } | null;
  aiConfig: AIConfigData | null;
  parsePromise?: Promise<any> | null;
  onComplete: (results: CandidateResult[]) => void;
  onError: () => void;
}

const MESSAGES = [
  "Extracting document text...",
  "Parsing candidate details...",
  "Analyzing keyword fit...",
  "Calculating semantic match...",
  "Generating AI verdict...",
  "Finalizing leaderboard ranking..."
];

export function ProcessingStep({ jobDescription, uploadPayload, aiConfig, parsePromise, onComplete, onError }: ProcessingStepProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Cycle messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);

    // Fake progress bar that slows down
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < 85) {
        currentProgress += Math.random() * 5;
        setProgress(Math.min(currentProgress, 85));
      } else if (currentProgress < 95) {
        currentProgress += Math.random() * 1;
        setProgress(Math.min(currentProgress, 95));
      }
    }, 500);

    const performAnalysis = async () => {
      try {
        let results: any;
        
        if (uploadPayload?.type === 'files') {
          // Wait for Phase 1 to finish parsing PDFs
          let sessionId = null;
          if (parsePromise) {
            const parseResult = await parsePromise;
            sessionId = parseResult.session_id;
          } else {
            throw new Error("No upload session found.");
          }
          
          // Execute Phase 2 (AI Evaluation and Scoring)
          const payload: any = {
            use_ai: aiConfig?.use_ai ?? true,
            use_ollama: aiConfig?.use_ollama ?? false,
            ollama_model: aiConfig?.ollama_model || "",
            use_custom_weights: aiConfig?.use_custom_weights ?? false,
          };
          
          if (aiConfig?.use_custom_weights && aiConfig.weights) {
            payload.weight_skill = aiConfig.weights.skill_match;
            payload.weight_keyword = aiConfig.weights.keyword_match;
            payload.weight_contextual = aiConfig.weights.contextual_match;
            payload.weight_experience = aiConfig.weights.experience;
            payload.weight_ai = aiConfig.weights.ai_score;
          }
          
          results = await analyzeSession(sessionId, payload, { timeout: 300000 });
        } else if (uploadPayload?.type === 'json') {
          const payload = {
            job_description: jobDescription,
            resumes: JSON.parse(uploadPayload.data),
            use_ollama: aiConfig?.use_ollama || false,
            ollama_model: aiConfig?.ollama_model || ""
          };
          results = await analyzeJson(payload, { timeout: 300000 });
        }

        setProgress(100);
        setTimeout(() => {
          // If backend didn't return an array of results, just pass empty or mock.
          // In a real app we validate the response structure here.
          if (results && Array.isArray(results.candidates)) {
            onComplete(results.candidates);
          } else if (Array.isArray(results)) {
            onComplete(results);
          } else {
             // Mock fallback just in case backend is down, for demonstration
             onComplete([]);
          }
        }, 1000);
      } catch (error) {
        console.error("Processing error:", error);
        toast.error("Analysis failed. The backend might be unreachable or timed out.");
        // Fallback to error state
        setTimeout(() => onError(), 1500);
      }
    };

    performAnalysis();

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [jobDescription, uploadPayload, aiConfig, onComplete, onError]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex flex-col items-center justify-center py-10 w-full"
    >
      <div className="relative mb-12 flex items-center justify-center">
        {/* Animated glowing orbs */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            opacity: [0.5, 0.8, 0.5] 
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute w-40 h-40 rounded-full bg-primary/20 blur-2xl"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
            opacity: [0.4, 0.7, 0.4] 
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="absolute w-48 h-48 rounded-full bg-accent/20 blur-3xl"
        />
        
        {/* Central Icon */}
        <div className="relative z-10 w-24 h-24 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
          <BrainCircuit className="w-10 h-10 text-primary animate-pulse" />
        </div>
      </div>

      <div className="w-full max-w-md space-y-8 text-center">
        <div className="h-8 relative overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.h3
              key={messageIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-medium absolute w-full text-gradient"
            >
              {MESSAGES[messageIndex]}
            </motion.h3>
          </AnimatePresence>
        </div>

        <div className="relative pt-10 pb-4 w-full">
          {/* Tracking Percentage Indicator */}
          <motion.div 
            className="absolute top-0 flex flex-col items-center -translate-x-1/2 z-20"
            initial={{ left: "0%" }}
            animate={{ left: `${progress}%` }}
            transition={{ ease: "linear", duration: 0.5 }}
          >
            <div className="bg-background/80 backdrop-blur-sm border border-primary/50 text-foreground text-xs font-bold px-3 py-1 rounded-full shadow-[0_0_20px_rgba(129,140,248,0.5)] tabular-nums flex items-center justify-center">
              {Math.round(progress)}%
            </div>
            <div className="w-[2px] h-4 bg-gradient-to-b from-primary to-transparent" />
          </motion.div>

          {/* Track Background */}
          <div className="h-3 w-full bg-[#07080A]/60 rounded-full border border-white/10 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] overflow-hidden p-[1px]">
            {/* Progress Fill */}
            <motion.div 
              className="h-full rounded-full relative bg-gradient-to-r from-primary via-accent to-primary"
              style={{ backgroundSize: '200% 100%' }}
              initial={{ width: "0%", backgroundPosition: "100% 0" }}
              animate={{ 
                width: `${progress}%`,
                backgroundPosition: ["100% 0", "0% 0"]
              }}
              transition={{ 
                width: { ease: "linear", duration: 0.5 },
                backgroundPosition: { repeat: Infinity, duration: 2, ease: "linear" }
              }}
            >
              {/* Top highlight for 3D glass effect */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-white/40 rounded-full" />
              {/* Bottom shadow for depth */}
              <div className="absolute inset-x-0 bottom-0 h-[1px] bg-black/40 rounded-full" />
            </motion.div>
          </div>
          
          {/* Ambient Outer Glow */}
          <div className="absolute inset-x-0 top-[40px] h-3 w-full">
            <motion.div 
              className="h-full rounded-full bg-primary/40 blur-xl pointer-events-none"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
