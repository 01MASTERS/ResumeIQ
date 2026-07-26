'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSessionStatus, SessionStatus } from '@/lib/api';

interface UseSessionStatusOptions {
  /** How often to poll in ms. Default: 2000 */
  intervalMs?: number;
  /** Stop polling when session reaches one of these statuses */
  terminalStatuses?: string[];
}

/**
 * Polls GET /sessions/{id}/status on a configurable interval.
 *
 * - Starts immediately when `enabled` becomes true.
 * - Stops automatically when `status` reaches a terminal state.
 * - Cleans up the interval on unmount.
 * - Does not spam requests: waits for each request to finish before
 *   scheduling the next one (uses setTimeout, not setInterval).
 */
export function useSessionStatus(
  sessionId: number | null,
  enabled: boolean,
  options: UseSessionStatusOptions = {}
) {
  const {
    intervalMs = 2000,
    terminalStatuses = ['completed', 'failed', 'expired'],
  } = options;

  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref so the cleanup effect closure always sees the latest timer id
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  // Use a stringified version of terminalStatuses to avoid infinite renders
  // when the options object is recreated on every render.
  const terminalStatusesStr = terminalStatuses.join(',');

  const poll = useCallback(async () => {
    if (!sessionId || !activeRef.current) return;

    try {
      const result = await getSessionStatus(sessionId);
      setStatus(result);
      setError(null);

      if (terminalStatusesStr.split(',').includes(result.status)) {
        activeRef.current = false;
        return; // stop polling
      }
    } catch (err: any) {
      // Don't stop polling on transient network errors — just log
      setError(err?.message ?? 'Status poll failed');
    }

    // Schedule next poll (setTimeout ensures no overlap)
    if (activeRef.current) {
      timerRef.current = setTimeout(poll, intervalMs);
    }
  }, [sessionId, intervalMs, terminalStatusesStr]);

  useEffect(() => {
    if (!sessionId || !enabled) {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    activeRef.current = true;
    poll(); // immediate first call

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, enabled, poll]);

  /** Convenience derivations */
  const preprocessingProgress =
    status && status.candidates.total > 0
      ? Math.round(
          ((status.candidates.preprocessed + status.candidates.preprocessing_failed) /
            status.candidates.total) *
            100
        )
      : 0;

  const evaluationProgress =
    status && status.candidates.total > 0
      ? Math.round(
          ((status.candidates.completed + status.candidates.evaluation_failed) /
            status.candidates.total) *
            100
        )
      : 0;

  return {
    status,
    error,
    preprocessingProgress,
    evaluationProgress,
    isPreprocessing: status?.status === 'preprocessing',
    isAnalyzing: status?.status === 'analyzing',
    isReady: status?.ready_to_analyze ?? false,
    isCompleted: status?.status === 'completed',
    failedCandidates: status?.error_details ?? [],
  };
}
