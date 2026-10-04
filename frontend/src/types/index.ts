export type Sentiment = "positive" | "negative" | "neutral";
export type Overall = Sentiment | "mixed" | "none";

export interface Aspect {
  id?: number | null; // present only when the parent review was saved to history; feedback needs this
  text: string;
  start: number;
  end: number;
  sentiment: Sentiment;
  confidence: number;
  probabilities?: Record<string, number> | null;
  adjusted?: string | null;
  hint?: string | null;
  thumbs_up?: number;
  thumbs_down?: number;
}

export interface FeedbackResult {
  id: number;
  thumbs_up: number;
  thumbs_down: number;
}

export interface DisputedAspect {
  aspect_id: number;
  review_id: number;
  term: string;
  sentiment: Sentiment;
  thumbs_up: number;
  thumbs_down: number;
}

export interface FeedbackSummary {
  total_votes: number;
  thumbs_up: number;
  thumbs_down: number;
  agreement_rate: number | null;
  most_disputed: DisputedAspect[];
}

export interface AnalysisResult {
  id: number | null;
  review: string;
  overall_sentiment: Overall;
  aspects: Aspect[];
  created_at: string;
  warnings?: string[];
}

export interface HistoryItem {
  id: number;
  text: string;
  overall_sentiment: Overall;
  n_aspects: number;
  n_positive: number;
  n_negative: number;
  n_neutral: number;
  created_at: string;
}

export interface HistoryPage {
  total: number;
  items: HistoryItem[];
}

export interface TopAspect {
  aspect: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface AspectSummary {
  aspect: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface BatchSummary {
  reviews: number;
  aspects: number;
  positive: number;
  negative: number;
  neutral: number;
  avg_confidence: number;
  low_confidence: number;
  overall_distribution: Record<string, number>;
  top_aspects: AspectSummary[];
}

export interface BatchResponse {
  results: AnalysisResult[];
  summary: BatchSummary;
}

export interface Analytics {
  avg_confidence?: number;
  low_confidence_aspects?: number;
  reviews_analyzed: number;
  total_aspects: number;
  positive_aspects: number;
  negative_aspects: number;
  neutral_aspects: number;
  overall_distribution: Record<string, number>;
  top_aspects: TopAspect[];
  trend: { date: string; reviews: number }[];
}

export interface Health {
  status: string;
  models_loaded: boolean;
  device: string;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
}

export interface DomainResult {
  sentences: number;
  atsc_examples: number;
  ate_exact_f1: number;
  ate_partial_f1: number;
  atsc_accuracy: number;
  atsc_macro_f1: number;
}

export interface GoldenBucket {
  correct: number;
  of: number;
  rate: number | null;
}

export interface GoldenRow {
  review: string;
  expected: Record<string, string> | "none";
  got: [string, string][];
  correct: number;
  of: number;
  detail: string;
}

export interface ModelInfo {
  cross_domain?: Record<string, { name: string; splits: Record<string, DomainResult> }>;
  golden?: {
    buckets: Record<string, GoldenBucket>;
    still_wrong: GoldenRow[];
  };
  ate: {
    training: { base_model: string; epochs: number; batch_size: number; learning_rate: number; max_len: number;
      train_sentences: number; best_val_f1: number; device: string } | null;
    test_metrics: {
      sentences: number;
      exact_match: ClassMetrics & { tp: number; predicted: number; gold: number };
      partial_match: ClassMetrics;
    } | null;
  };
  atsc: {
    training: { base_model: string; epochs: number; batch_size: number; learning_rate: number; max_len: number;
      train_examples: number; best_val_macro_f1: number; class_weights: boolean; device: string } | null;
    test_metrics: {
      examples: number;
      accuracy: number;
      macro_f1: number;
      per_class: Record<string, ClassMetrics>;
      confusion_matrix: number[][];
      label_order: string[];
    } | null;
  };
}
