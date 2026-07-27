"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getAnalyses } from "@/lib/api";
import { FileText, Users, Percent, TrendingUp, Plus, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

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
} as const;

export default function DashboardPage() {
  const { data: history, isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: getAnalyses,
  });

  const totalAnalyses = history?.length || 0;
  const candidatesScreened = history?.reduce((acc, curr) => acc + (curr.candidates_count || 0), 0) || 0;
  const avgMatchScore = history && history.length > 0
    ? Math.round(history.reduce((acc, curr) => acc + (curr.average_score || 0), 0) / history.length)
    : 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const thisMonthCount = history?.filter(h => {
    const d = new Date(h.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length || 0;
  
  const lastMonthCount = history?.filter(h => {
    const d = new Date(h.created_at);
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  }).length || 0;

  let growthTrend = 0;
  if (lastMonthCount === 0 && thisMonthCount > 0) {
    growthTrend = 100;
  } else if (lastMonthCount > 0) {
    growthTrend = Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
  }

  const stats = [
    {
      title: "Total Analyses",
      value: totalAnalyses,
      icon: FileText,
      gradient: "from-indigo-500/20 to-indigo-500/5",
      iconColor: "text-indigo-400",
      borderColor: "border-indigo-500/10",
    },
    {
      title: "Candidates Screened",
      value: candidatesScreened,
      icon: Users,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/10",
    },
    {
      title: "Avg Match Score",
      value: `${avgMatchScore}%`,
      icon: Percent,
      gradient: "from-purple-500/20 to-purple-500/5",
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/10",
    },
    {
      title: "Growth Trend",
      value: `${growthTrend > 0 ? '+' : ''}${growthTrend}%`,
      icon: TrendingUp,
      gradient: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-400",
      borderColor: "border-amber-500/10",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1.5">
            AI-powered candidate screening and evaluation.
          </p>
        </div>

        <Link href="/analysis/new">
          <Button size="lg" className="shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.title}
            variants={itemVariants}
          >
            <Card className={`relative overflow-hidden group ${stat.borderColor}`}>
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-white/[0.04] ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Analyses */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Analyses</CardTitle>
            <Link href="/history">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs">
                View All <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2">
                {history.slice(0, 5).map((session) => (
                  <Link href={`/history/${session.id}`} key={session.id}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Session {String(session.id).slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{new Date(session.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-semibold text-sm">{session.candidates_count}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Candidates</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-medium mb-1.5">No analyses yet</h3>
                <p className="text-sm text-muted-foreground mb-6">Start your first AI-powered resume screening.</p>
                <Link href="/analysis/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Start New Analysis
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
