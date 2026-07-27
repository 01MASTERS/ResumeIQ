"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CandidateResult } from "@/lib/api";
import { useState, useMemo } from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

import { Brain, FileText, CheckCircle, XCircle, Send, Plus, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { inviteCandidates } from "@/lib/api";
import { toast } from "sonner";

interface LeaderboardStepProps {
  results: CandidateResult[];
  onReset?: () => void;
}

const REC_COLORS: Record<string, string> = {
  'Strong fit': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  'Moderate fit': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  'Weak fit': 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  'Disqualified': 'bg-rose-500/20 text-rose-500 border-rose-500/30'
};



export function LeaderboardStep({ results, onReset }: LeaderboardStepProps) {
  const [minScore, setMinScore] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Modal state
  const [inviteSubject, setInviteSubject] = useState("Invitation to Interview: {{company_name}}");
  const [inviteBody, setInviteBody] = useState("Hi {{name}},\n\nWe were very impressed with your resume and would love to invite you for an interview.\n\nBest,\nHR Team");
  const [isSending, setIsSending] = useState(false);

  const filteredResults = useMemo(() => {
    return results.filter(r => r.overall_score >= minScore).sort((a, b) => a.rank - b.rank);
  }, [results, minScore]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResults.map(r => r.filename));
    }
  };

  const handleSendInvites = async () => {
    setIsSending(true);
    try {
      const candidatesToInvite = selectedIds.map(id => {
        const candidate = results.find(r => r.filename === id);
        return { name: candidate?.candidate_name || "Unknown", email: candidate?.email || "" };
      });
      await inviteCandidates({
        candidates: candidatesToInvite,
        subject: inviteSubject,
        message: inviteBody
      });
      toast.success(`Successfully sent invites to ${selectedIds.length} candidates.`);
      setIsInviteModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      if (!err.isGlobalError) {
        toast.error("Failed to send invites. Please check connection.");
      }
    } finally {
      setIsSending(false);
    }
  };



  const hasAiEvaluation = useMemo(() => {
    return results.some(r => r.llm_score > 0 || (r.llm_verdict && r.llm_verdict.length > 0));
  }, [results]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
    if (score >= 60) return "bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]";
    if (score >= 40) return "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
    return "bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-24"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analysis Results</h2>
          <p className="text-muted-foreground">Review, filter, and invite top candidates.</p>
        </div>
        {onReset && (
          <Button 
            onClick={onReset}
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary gap-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Start New Analysis
          </Button>
        )}
      </div>



      {/* Filter */}
      <div className="glass p-6 rounded-2xl border border-white/5 flex items-center gap-6">
        <div className="w-full max-w-sm space-y-3">
          <div className="flex justify-between">
            <Label>Minimum Score Filter</Label>
            <span className="font-bold text-primary">{minScore}</span>
          </div>
          <Slider 
            value={[minScore]} 
            max={100} 
            step={1} 
            onValueChange={(v) => setMinScore(Array.isArray(v) ? v[0] : (v as number))}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{filteredResults.length}</strong> of {results.length} candidates
        </div>
      </div>



      {/* Leaderboard Table */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/40 backdrop-blur-2xl">
        <Table className="text-sm">
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-[40px] py-2 h-10">
                <Checkbox 
                  checked={selectedIds.length === filteredResults.length && filteredResults.length > 0} 
                  onCheckedChange={toggleSelectAll} 
                />
              </TableHead>
              <TableHead className="w-[60px] text-center py-2 h-10 text-xs">Rank</TableHead>
              <TableHead className="py-2 h-10 text-xs">Candidate</TableHead>
              <TableHead className="text-center py-2 h-10 text-xs">Score</TableHead>
              <TableHead className="text-right py-2 h-10 text-xs">Recommendation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No candidates match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredResults.map((candidate, index) => (
                <TableRow key={`${candidate.filename}-${index}`} className="border-white/5 hover:bg-white/5 transition-colors group">
                  <TableCell className="py-2">
                    <Checkbox 
                      checked={selectedIds.includes(candidate.filename)}
                      onCheckedChange={() => toggleSelect(candidate.filename)}
                    />
                  </TableCell>
                  <TableCell className="text-center font-mono font-medium text-muted-foreground py-2 text-xs">
                    #{candidate.rank}
                  </TableCell>
                  <TableCell className="py-2">
                    <div 
                      className="font-medium text-foreground text-sm hover:text-primary transition-colors cursor-pointer hover:underline underline-offset-4 inline-block"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`http://localhost:8000/api/resumes/${encodeURIComponent(candidate.filename)}`, '_blank');
                      }}
                    >
                      {candidate.candidate_name || candidate.filename.split('.')[0] || 'Unknown Candidate'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{candidate.email}</div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${getScoreColor(candidate.overall_score)}`}>
                      {candidate.overall_score}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${REC_COLORS[candidate.recommendation] || 'bg-secondary text-foreground'}`}>
                      {candidate.recommendation}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Accordion */}
      {filteredResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold tracking-tight">Candidate Deep Dive</h3>
          <Accordion className="space-y-4">
            {filteredResults.map((candidate, index) => (
              <motion.div
                key={`${candidate.candidate_name}-${index}`}
                initial={{ scale: 0.7, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <AccordionItem value={`${candidate.candidate_name}-${index}`} className="glass border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-2xl overflow-hidden data-[state=open]:border-primary/50 data-[state=open]:bg-primary/5 transition-all shadow-lg hover:shadow-xl">
                  <AccordionTrigger className="px-6 hover:no-underline hover:bg-white/10 transition-all rounded-xl m-1 group/trigger">
                    <div className="flex justify-between items-center w-full pr-4">
                      <div className="flex flex-col items-start gap-2">
                        <span 
                        className="font-extrabold text-xl tracking-tight text-slate-100 hover:text-primary transition-colors cursor-pointer hover:underline underline-offset-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`http://localhost:8000/api/resumes/${encodeURIComponent(candidate.filename)}`, '_blank');
                        }}
                      >
                        {candidate.candidate_name || candidate.filename.split('.')[0] || 'Unknown Candidate'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded shadow-sm border ${
                        candidate.recommendation === "Strong fit" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" :
                        candidate.recommendation === "Moderate fit" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5" :
                        candidate.recommendation === "Disqualified" ? "bg-slate-800 text-slate-500 border-slate-700" :
                        "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5"
                      }`}>
                        {candidate.recommendation}
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2 mr-2">
                      <div className="relative group/score">
                        <div className={`absolute -inset-2 rounded-lg blur opacity-0 group-hover/score:opacity-40 transition duration-500 ${
                          candidate.overall_score >= 70 ? "bg-emerald-500" : candidate.overall_score >= 40 ? "bg-amber-500" : "bg-rose-500"
                        }`}></div>
                        <span className="relative text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight drop-shadow-sm">
                          {candidate.overall_score}<span className="text-sm text-slate-500 font-bold">/100</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="flex flex-col gap-6">
                    {/* Dynamic Score Breakdown (Horizontal Row like v1) */}
                    <div className={`grid gap-3 bg-secondary/30 rounded-xl p-4 border border-white/5 relative z-10 grid-cols-2 sm:grid-cols-3 ${hasAiEvaluation ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
                      {[
                        { label: 'Skill Match', value: candidate.skill_match, color: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' },
                        { label: 'Keyword Fit', value: candidate.tf_idf_similarity, color: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' },
                        { label: 'Contextual', value: candidate.semantic_similarity, color: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' },
                        { label: 'Experience', value: candidate.experience, color: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' },
                        hasAiEvaluation ? { label: 'AI Score', value: candidate.llm_score, color: 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' } : null,
                      ].filter(Boolean).map((score: { label: string; value: number; color: string } | null, idx) => {
                        if (!score) return null;
                        return (
                        <div key={score.label} className={idx !== 0 ? "lg:border-l lg:border-white/5 lg:pl-3" : ""}>
                          <div className="flex justify-between items-end mb-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none tracking-wider">{score.label}</p>
                          </div>
                          <div className="w-full bg-black/40 rounded-full h-1.5 mt-2 mb-1.5 overflow-hidden">
                            <div className={`h-full rounded-full relative ${score.color.split(' ')[0]}`} style={{ width: `${score.value}%` }}>
                              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                          </div>
                          <p className="text-xs font-black text-foreground">{score.value}%</p>
                        </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: AI Assessment */}
                      <div className="space-y-4">
                        {candidate.explanation || candidate.llm_verdict ? (
                          <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-xl p-5 h-full relative z-10 shadow-inner">
                            <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2 uppercase tracking-wider">
                              <Brain className="w-4 h-4" /> AI Evaluation Summary
                            </h4>
                            <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                              {candidate.llm_verdict || candidate.explanation}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-secondary/30 border border-white/5 h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground shadow-inner rounded-xl">
                            <Brain className="w-8 h-8 mb-3 opacity-20" />
                            <p className="text-sm font-medium">AI Assessment Unavailable</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Strengths & Weaknesses + Skills */}
                      <div className="space-y-4 flex flex-col">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 hover:bg-emerald-500/10 transition-colors">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" /> Key Strengths
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-2">
                              {candidate.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 leading-tight">
                                  <span className="text-emerald-500 mt-0.5">•</span>
                                  <span>{s}</span>
                                </li>
                              ))}
                              {candidate.strengths.length === 0 && <li className="text-muted-foreground italic">None listed</li>}
                            </ul>
                          </div>
                          
                          <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 hover:bg-rose-500/10 transition-colors">
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" /> Weaknesses
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-2">
                              {candidate.weaknesses.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 leading-tight">
                                  <span className="text-rose-500 mt-0.5">•</span>
                                  <span>{s}</span>
                                </li>
                              ))}
                              {candidate.weaknesses.length === 0 && <li className="text-muted-foreground italic">None listed</li>}
                            </ul>
                          </div>
                        </div>

                        <div className="bg-secondary/30 rounded-xl p-4 border border-white/5 mt-auto">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" /> Skill Analysis ({candidate.years_of_experience} yrs exp)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {candidate.matched_skills.map(skill => (
                              <Badge key={`matched-${skill}`} variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">{skill}</Badge>
                            ))}
                            {candidate.resume_skills.filter(s => !candidate.matched_skills.includes(s)).map(skill => (
                              <Badge key={`resume-${skill}`} variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">{skill}</Badge>
                            ))}
                            {candidate.missing_skills.map(skill => (
                              <Badge key={`missing-${skill}`} variant="secondary" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 line-through opacity-70">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-6 py-4 border border-white/10 shadow-2xl flex items-center gap-6"
          >
            <div className="text-sm font-medium">
              <span className="text-primary font-bold">{selectedIds.length}</span> candidates selected
            </div>
            <Button onClick={() => setIsInviteModalOpen(true)} className="rounded-full shadow-lg shadow-primary/20">
              <Mail className="mr-2 w-4 h-4" />
              Invite Selected
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-[500px] glass border-white/10 bg-background/95 backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle>Invite Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input 
                value={inviteSubject} 
                onChange={e => setInviteSubject(e.target.value)} 
                className="bg-secondary/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Body Template</Label>
              <Textarea 
                value={inviteBody} 
                onChange={e => setInviteBody(e.target.value)} 
                className="min-h-[150px] bg-secondary/50 border-white/10"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Available variables: <code className="text-primary">{"{{name}}"}</code>, <code className="text-primary">{"{{company_name}}"}</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSendInvites} disabled={isSending}>
              {isSending ? "Sending..." : "Send Invites"}
              {!isSending && <Send className="ml-2 w-4 h-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
