"use client";

import { useState } from "react";
import Image from "next/image";
import RequirementsForm from "../components/RequirementsForm";
import CandidateEvaluation from "../components/CandidateEvaluation";

export default function Home() {
  const [jdText, setJdText] = useState<string | null>(null);

  return (
    <main className="min-h-screen relative overflow-hidden bg-slate-950 p-4 sm:p-8 md:py-16 flex justify-center items-start">
      {/* Background glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse-slow pointer-events-none" />
      
      <div className="w-full max-w-4xl flex flex-col gap-8 relative z-10">
        {/* Header Section */}
        <div className="text-center mb-4 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.3)] border border-indigo-500/20">
            <Image src="/logo.png" alt="ResumeIQ Logo" fill className="object-cover" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4 drop-shadow-sm tracking-tight">
            ResumeIQ Intelligence Hub
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-medium">
            Intelligent Candidate Screening & Evaluation Platform
          </p>
        </div>

        {/* Content Container */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/5 ring-1 ring-white/10 flex flex-col gap-8">
          <RequirementsForm onRequirementsSubmit={setJdText} />
          
          {/* Subtle Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-2" />

          <CandidateEvaluation requirementsText={jdText} />
        </div>
      </div>
    </main>
  );
}