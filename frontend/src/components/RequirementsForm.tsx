"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  job_description: z.string().trim().min(1, { message: "Job description cannot be empty" }),
});

type FormData = z.infer<typeof formSchema>;

interface RequirementsFormProps {
  onRequirementsSubmit: (text: string) => void;
}

export default function RequirementsForm({ onRequirementsSubmit }: RequirementsFormProps) {
  const [response, setResponse] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setResponse(null);
    setErrorMsg(null);
    try {
      const res = await fetch("http://localhost:8000/job-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to submit Job Description");
      }

      const result = await res.json();
      setResponse(result.received_jd);
      onRequirementsSubmit(result.received_jd);
    } catch (err) {
      setErrorMsg("Error communicating with backend.");
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 w-full">
        <div className="flex flex-col relative group">
          <label htmlFor="jd-input" className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Job Description
          </label>
          <div className="relative">
            <div className={`absolute -inset-0.5 rounded-xl blur opacity-20 group-focus-within:opacity-50 transition duration-500 ${errors.job_description ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"}`}></div>
            <textarea
              id="jd-input"
              rows={8}
              className={`relative w-full bg-slate-900/80 backdrop-blur-sm border rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none transition-all duration-300 resize-y ${
                errors.job_description ? "border-rose-500/50 focus:border-rose-400 focus:ring-1 focus:ring-rose-400" : "border-slate-700/50 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
              }`}
              placeholder="Enter the detailed role requirements and essential skills..."
              {...register("job_description")}
            />
          </div>
          {errors.job_description && (
            <span className="text-rose-400 text-xs mt-2 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              {errors.job_description.message}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="relative group overflow-hidden bg-slate-800 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-white/5 w-full sm:w-auto self-start"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: "200% auto", animation: "glow 3s linear infinite" }}></div>
          <div className="relative flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                Parse Job Description
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </>
            )}
          </div>
        </button>
      </form>

      {errorMsg && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-3 backdrop-blur-sm">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {response && (
        <div className="mt-2 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
          <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Requirements Configured Successfully
          </h3>
          <div className="bg-slate-900/50 rounded-lg p-4 border border-emerald-500/10">
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">{response}</p>
          </div>
        </div>
      )}
    </div>
  );
}