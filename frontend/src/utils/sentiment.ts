import type { Overall, Sentiment } from "../types";

export interface SentimentStyle {
  label: string;
  icon: string; // never rely on colour alone
  badge: string;
  mark: string;
  card: string;
  hex: string;
}

const STYLES: Record<Overall, SentimentStyle> = {
  positive: {
    label: "Positive", icon: "✓", hex: "#059669",
    badge: "bg-pos-bg text-pos border-pos-border",
    mark: "bg-pos-bg text-pos border-pos underline decoration-pos/60",
    card: "border-pos-border",
  },
  negative: {
    label: "Negative", icon: "✕", hex: "#e11d48",
    badge: "bg-neg-bg text-neg border-neg-border",
    mark: "bg-neg-bg text-neg border-neg underline decoration-neg/60 decoration-wavy",
    card: "border-neg-border",
  },
  neutral: {
    label: "Neutral", icon: "–", hex: "#64748b",
    badge: "bg-neu-bg text-neu border-neu-border",
    mark: "bg-neu-bg text-neu border-neu underline decoration-neu/60 decoration-dotted",
    card: "border-neu-border",
  },
  mixed: {
    label: "Mixed", icon: "±", hex: "#d97706",
    badge: "bg-mix-bg text-mix border-mix-border",
    mark: "", card: "border-mix-border",
  },
  none: {
    label: "No aspects", icon: "·", hex: "#94a3b8",
    badge: "bg-neu-bg text-neu border-neu-border",
    mark: "", card: "border-border",
  },
};

export const sentimentStyle = (s: Overall | Sentiment): SentimentStyle => STYLES[s];
export const SENTIMENTS: Sentiment[] = ["positive", "negative", "neutral"];
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Below this the model is unsure; the UI says so instead of presenting a shaky result as fact. */
export const LOW_CONFIDENCE = 0.6;
