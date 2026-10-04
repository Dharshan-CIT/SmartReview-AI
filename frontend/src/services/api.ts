import type { AnalysisResult, Analytics, BatchResponse, FeedbackResult, FeedbackSummary, Health, HistoryPage, ModelInfo } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";

/** Error whose message is always safe to show to the user. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const FALLBACK = "We couldn't analyze this review. Please try again.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0);
  }
  if (!res.ok) {
    let detail = FALLBACK;
    try {
      const body = await res.json();
      // Only trust short, plain-string details from our own API; never show raw traces.
      if (typeof body?.detail === "string" && body.detail.length < 200) detail = body.detail;
    } catch {
      /* keep fallback */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  analyze: (review: string) =>
    request<AnalysisResult>("/api/analyze", { method: "POST", body: JSON.stringify({ review }) }),
  analyzeBatch: (reviews: string[], save = true) =>
    request<BatchResponse>("/api/analyze/batch", { method: "POST", body: JSON.stringify({ reviews, save }) }),
  health: () => request<Health>("/api/health"),
  analytics: () => request<Analytics>("/api/analytics"),
  modelInfo: () => request<ModelInfo>("/api/model-info"),
  history: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
    return request<HistoryPage>(`/api/history?${q.toString()}`);
  },
  historyItem: (id: number) => request<AnalysisResult>(`/api/history/${id}`),
  deleteHistory: (id: number) => request<void>(`/api/history/${id}`, { method: "DELETE" }),
  clearHistory: () => request<{ deleted: number }>("/api/history", { method: "DELETE" }),
  historyExportUrl: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    return `${BASE}/api/history/export?${q.toString()}`;
  },
  giveFeedback: (aspectId: number, vote: "up" | "down") =>
    request<FeedbackResult>(`/api/aspects/${aspectId}/feedback`, { method: "POST", body: JSON.stringify({ vote }) }),
  feedbackSummary: () => request<FeedbackSummary>("/api/feedback/summary"),
};
