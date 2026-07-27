"use client";

import Ferrofluid from "@/components/Ferrofluid";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileSearch,
  BrainCircuit,
  Trophy,
  Shield,
  Zap,
  BarChart3,

  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import logoImage from "@/images/resumeiqlogo.png";
import { useRef } from "react";

const features = [
  {
    icon: FileSearch,
    title: "Smart Resume Parsing",
    description: "Upload PDFs or DOCX files. Our AI extracts skills, experience, and qualifications instantly.",
  },
  {
    icon: BrainCircuit,
    title: "AI-Powered Evaluation",
    description: "LLM-driven semantic analysis goes beyond keyword matching to understand candidate fit.",
  },
  {
    icon: Trophy,
    title: "Ranked Leaderboard",
    description: "Candidates are scored and ranked with detailed breakdowns across multiple dimensions.",
  },
  {
    icon: Shield,
    title: "Configurable Weights",
    description: "Customize scoring weights for skills, experience, AI assessment, and more.",
  },
  {
    icon: Zap,
    title: "Batch Processing",
    description: "Screen dozens of candidates simultaneously. Get results in minutes, not hours.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Score breakdowns, skill gap analysis, strengths & weaknesses for every candidate.",
  },
];

const steps = [
  {
    step: "01",
    title: "Describe the Role",
    description: "Paste your job description. Our AI extracts requirements, skills, and context.",
  },
  {
    step: "02",
    title: "Upload Resumes",
    description: "Drag & drop PDF/DOCX files or provide structured JSON candidate data.",
  },
  {
    step: "03",
    title: "Get AI Rankings",
    description: "Review scored candidates, deep-dive into analysis, and send invitations.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
} as const;

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Global Background */}
      <motion.div 
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="fixed inset-0 overflow-hidden z-0"
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', opacity: 0.5 }}>
          <Ferrofluid
            className=""
            dpr={1}
            mixBlendMode="normal"
            colors={["#ffffff", "#ffffff", "#ffffff"]}
            speed={0.5}
            scale={1.6}
            turbulence={1}
            fluidity={0.1}
            rimWidth={0.2}
            sharpness={2.5}
            shimmer={1.5}
            glow={2}
            flowDirection="down"
            opacity={1}
            mouseInteraction={true}
            mouseStrength={1}
            mouseRadius={0.35}
          />
        </div>
      </motion.div>

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/[0.04] bg-background/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <Image src={logoImage} alt="ResumeIQ Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Resume<span className="text-primary">IQ</span>
            </span>
          </Link>

        </div>
      </nav>

      {/* ─── Hero ─── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center pt-16 z-10"
      >

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 mt-12"
          >
            Hire smarter with{" "}
            <span className="text-gradient">AI-powered</span>{" "}
            resume screening
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Screen, evaluate, and rank candidates in minutes — not hours.
            Multi-dimensional AI analysis that goes beyond keyword matching.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/analysis/new">
              <Button size="lg" className="text-base px-8 shadow-xl shadow-primary/25 hover:shadow-primary/35 transition-shadow">
                Start Screening <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="text-base px-8">
                View Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ─── Features ─── */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to hire{" "}
              <span className="text-gradient">the best</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete toolkit for AI-powered candidate evaluation, from parsing to ranking.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="group relative rounded-2xl border border-white/[0.1] bg-background/70 backdrop-blur-xl p-6 transition-all duration-300 hover:border-white/20 hover:bg-background/80 hover:shadow-2xl hover:shadow-black/40"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-32 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps to <span className="text-gradient">perfect hires</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              A streamlined workflow that turns hours of manual screening into minutes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-[1px] bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30" />

            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative text-center p-8 rounded-3xl bg-background/60 backdrop-blur-lg border border-white/[0.08] hover:bg-background/70 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-background border border-white/[0.15] text-lg font-bold text-primary mb-6 shadow-xl shadow-black/40 relative z-10">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-32">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border border-white/[0.1] bg-background/70 backdrop-blur-2xl p-12 sm:p-16 text-center overflow-hidden shadow-2xl shadow-black/50"
          >
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/[0.06] blur-[100px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to transform your hiring?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Start screening candidates with AI-powered analysis today.
              </p>
              <Link href="/dashboard">
                <Button size="lg" className="text-base px-10 shadow-xl shadow-primary/25">
                  Get Started <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">


          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} ResumeIQ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
