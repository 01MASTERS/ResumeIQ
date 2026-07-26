"use client";

import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAnalyses, deleteAnalysis } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, History as HistoryIcon, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
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

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: getAnalyses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success("Analysis deleted successfully.");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete analysis.");
      setDeleteId(null);
    }
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <HistoryIcon className="w-5 h-5" />
          </div>
          Analysis History
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 ml-[42px]">
          View past screening sessions and their results.
        </p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-white/[0.06] overflow-hidden bg-card/30 backdrop-blur-sm"
      >
        <Table>
          <TableHeader className="bg-white/[0.02]">
            <TableRow className="border-white/[0.04] hover:bg-transparent">
              <TableHead>Session ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Candidates</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-white/[0.04]">
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !history || history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-52 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <HistoryIcon className="w-10 h-10 mb-3 opacity-15" />
                    <p className="text-sm">No analysis history found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              history.map((session) => (
                <TableRow key={session.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell className="font-mono text-xs text-primary font-medium">
                    {String(session.id).slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{new Date(session.created_at).toLocaleString()}</div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-foreground text-xs font-semibold">
                      {session.candidates_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Link href={`/history/${session.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 text-xs h-7 px-2.5">
                        <ExternalLink className="w-3 h-3 mr-1" /> Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
                      onClick={() => setDeleteId(session.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Analysis
            </DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone and all candidate evaluation data will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
