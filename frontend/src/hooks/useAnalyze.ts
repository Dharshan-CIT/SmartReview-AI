import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AnalysisResult } from "../types";

export const STAGES = ["Analyzing your review...", "Extracting aspects...", "Classifying sentiment...", "Preparing insights..."];

export function useAnalyze() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);

  // Cycle the progress message while waiting (purely cosmetic; the real work is one API call).
  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 900);
    return () => clearInterval(t);
  }, [loading]);

  async function analyze(review: string) {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.analyze(review));
    } catch (e) {
      setResult(null);
      setError((e as Error).message || "We couldn't analyze this review. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return { result, error, loading, stage: STAGES[stage], analyze, reset: () => { setResult(null); setError(null); } };
}
