"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ArrowRight, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { submitJobDescription } from "@/lib/api";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

interface JobDescriptionStepProps {
  onNext: (jd: string) => void;
}

export function JobDescriptionStep({ onNext }: JobDescriptionStepProps) {
  const [text, setText] = useState("");
  
  const mutation = useMutation({
    mutationFn: submitJobDescription,
    onSuccess: (data) => {
      toast.success("Job description saved");
      onNext(data.job_description || text);
    },
    onError: () => {
      toast.error("Failed to save job description. We'll proceed with local state for now.");
      onNext(text);
    }
  });

  const handleSubmit = () => {
    if (text.length < 50) {
      toast.error("Job description is too short (minimum 50 characters).");
      return;
    }
    mutation.mutate(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-6xl mx-auto px-4 sm:px-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 border border-primary/20">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Job Description</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Paste the job description you're hiring for. Our AI will extract key requirements, skills, and context to evaluate candidates.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 relative group border border-white/5 shadow-2xl shadow-black/50">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        <Textarea 
          placeholder="Paste job description here... (e.g. Senior Frontend Engineer with 5+ years of React experience...)"
          className="min-h-[300px] text-lg resize-y bg-background/50 border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-white/20 rounded-xl placeholder:text-muted-foreground/50 p-6 custom-scrollbar"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className={text.length >= 50 ? "text-emerald-500" : "text-amber-500"}>
              {text.length} characters
            </span>
            {text.length >= 50 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          
          <Button 
            size="lg" 
            onClick={handleSubmit} 
            disabled={text.length === 0 || mutation.isPending}
            className="rounded-xl px-8 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all relative overflow-hidden"
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            Continue
            {!mutation.isPending && <ArrowRight className="ml-2 w-5 h-5" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
