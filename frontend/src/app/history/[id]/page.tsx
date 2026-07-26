"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnalysisById } from "@/lib/api";
import { LeaderboardStep } from "@/components/analysis/leaderboard-step";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isJdExpanded, setIsJdExpanded] = useState(false);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['analyses', id],
    queryFn: () => getAnalysisById(id),
    retry: false
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="text-center py-24 flex flex-col items-center">
        <h2 className="text-xl font-bold mb-3">Session Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">This analysis session may have been deleted.</p>
        <Button onClick={() => router.push('/history')} variant="outline">
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to History
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/history')} className="rounded-xl bg-white/[0.04] hover:bg-white/[0.06]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Session {String(session.id).slice(0, 8)}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(session.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Job Description */}
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 text-primary">
            <FileText className="w-3.5 h-3.5" /> Job Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex flex-col items-start">
            <p className={`text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed transition-all ${isJdExpanded ? '' : 'line-clamp-3'}`}>
              {session.job_description}
            </p>
            {session.job_description && session.job_description.length > 250 && (
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

      <LeaderboardStep results={session.candidates} />
    </motion.div>
  );
}
