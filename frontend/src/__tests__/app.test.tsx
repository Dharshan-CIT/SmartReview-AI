import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { HighlightedReview } from "../components/HighlightedReview";
import { ToastProvider } from "../components/ui/Toast";
import { api, ApiError } from "../services/api";
import type { AnalysisResult } from "../types";
import { MAX_REVIEW_CHARS } from "../utils/samples";

vi.mock("../services/api", async (orig) => {
  const actual = await orig<typeof import("../services/api")>();
  return { ...actual, api: { analyze: vi.fn(), analytics: vi.fn(), history: vi.fn(), modelInfo: vi.fn(), health: vi.fn(), historyItem: vi.fn(),
    deleteHistory: vi.fn(), giveFeedback: vi.fn(), feedbackSummary: vi.fn() } };
});

const RESULT: AnalysisResult = {
  id: 1,
  review: "The screen is great but the battery is poor.",
  overall_sentiment: "mixed",
  created_at: "2026-01-01T10:00:00",
  aspects: [
    { text: "screen", start: 4, end: 10, sentiment: "positive", confidence: 0.96 },
    { text: "battery", start: 28, end: 35, sentiment: "negative", confidence: 0.92 },
  ],
};

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><ToastProvider><App /></ToastProvider></MemoryRouter>);

const EMPTY_INFO = { ate: { training: null, test_metrics: null }, atsc: { training: null, test_metrics: null } };

beforeEach(() => {
  vi.resetAllMocks();
  document.documentElement.classList.remove("dark");
  localStorage.clear();
  // Every page mounts the navbar status dot and (landing) model info, so give them defaults.
  vi.mocked(api.health).mockResolvedValue({ status: "ok", models_loaded: true, device: "cpu" });
  vi.mocked(api.modelInfo).mockResolvedValue(EMPTY_INFO);
  vi.mocked(api.feedbackSummary).mockResolvedValue({ total_votes: 0, thumbs_up: 0, thumbs_down: 0, agreement_rate: null, most_disputed: [] });
});

describe("pages render", () => {
  it("landing page shows the hero and both CTAs", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: /understand what your customers really think/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze a review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore analytics/i })).toBeInTheDocument();
  });

  it("about page describes the website and has NO team or academic details", () => {
    renderAt("/about");
    expect(screen.getByRole("heading", { name: /about smartreview ai/i })).toBeInTheDocument();
    expect(screen.getByText("What you can do")).toBeInTheDocument();
    expect(screen.getByText("How to use it")).toBeInTheDocument();
    for (const gone of [/team member/i, /academic information/i, /guide \/ faculty/i, /roll number/i, /institution/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("hidden project page shows the team and academic details", async () => {
    renderAt("/model");
    expect(await screen.findByText("About the project and the team", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/Multi-Aspect Sentiment Analysis/i)).toBeInTheDocument();
    expect(screen.getByText("Team members")).toBeInTheDocument();
    expect(screen.getByText("Guide / faculty")).toBeInTheDocument();
    expect(screen.getByText("Institution")).toBeInTheDocument();
    expect(screen.getByText("Roll number")).toBeInTheDocument();
  });

  it("unknown route shows a not-found state", () => {
    renderAt("/nope");
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it("dashboard shows an empty state when nothing has been analyzed", async () => {
    vi.mocked(api.analytics).mockResolvedValue({ reviews_analyzed: 0, total_aspects: 0, positive_aspects: 0, negative_aspects: 0, neutral_aspects: 0, overall_distribution: {}, top_aspects: [], trend: [] });
    renderAt("/dashboard");
    expect(await screen.findByText(/no data yet/i, {}, { timeout: 8000 })).toBeInTheDocument();
  });
});

describe("analyzer", () => {
  it("shows the empty state and disables Analyze without text", () => {
    renderAt("/analyze");
    expect(screen.getByText(/enter a product review to begin analysis/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze review/i })).toBeDisabled();
  });

  it("loads an example review into the textarea", async () => {
    renderAt("/analyze");
    await userEvent.click(screen.getByRole("button", { name: "Headphones" }));
    expect((screen.getByLabelText(/product review/i) as HTMLTextAreaElement).value).toContain("sound quality");
    expect(screen.getByRole("button", { name: /analyze review/i })).toBeEnabled();
  });

  it("validates length and shows the character counter", async () => {
    renderAt("/analyze");
    const box = screen.getByLabelText(/product review/i);
    await userEvent.click(box);
    await userEvent.paste("x".repeat(MAX_REVIEW_CHARS + 1));
    expect(screen.getByText(new RegExp(`${MAX_REVIEW_CHARS + 1}/${MAX_REVIEW_CHARS}`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze review/i })).toBeDisabled();
  });

  it("shows loading, then renders overall sentiment, aspect cards and confidences", async () => {
    let resolve!: (r: AnalysisResult) => void;
    vi.mocked(api.analyze).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderAt("/analyze");
    await userEvent.type(screen.getByLabelText(/product review/i), RESULT.review);
    await userEvent.click(screen.getByRole("button", { name: /analyze review/i }));
    expect(await screen.findByText(/analyzing your review/i)).toBeInTheDocument();

    resolve(RESULT);
    expect(await screen.findByText("MIXED")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Screen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Battery" })).toBeInTheDocument();
    expect(screen.getAllByText("96%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Negative").length).toBeGreaterThan(0);
    expect(api.analyze).toHaveBeenCalledWith(RESULT.review);
  });

  it("shows a friendly error (no stack trace) when the API fails", async () => {
    vi.mocked(api.analyze).mockRejectedValue(new ApiError("We couldn't analyze this review. Please try again.", 500));
    renderAt("/analyze");
    await userEvent.type(screen.getByLabelText(/product review/i), "Nice laptop");
    await userEvent.click(screen.getByRole("button", { name: /analyze review/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't analyze this review/i);
    expect(document.body.textContent).not.toMatch(/traceback|stack/i);
  });

  it("shows a helpful message when no aspects are found", async () => {
    vi.mocked(api.analyze).mockResolvedValue({ ...RESULT, review: "I love it.", overall_sentiment: "none", aspects: [] });
    renderAt("/analyze");
    await userEvent.type(screen.getByLabelText(/product review/i), "I love it.");
    await userEvent.click(screen.getByRole("button", { name: /analyze review/i }));
    await waitFor(() => expect(screen.getAllByText(/no specific product features were detected/i).length).toBeGreaterThan(0));
  });
});

describe("HighlightedReview", () => {
  it("wraps each aspect and exposes accessible name with sentiment (not colour-only)", () => {
    render(<HighlightedReview text={RESULT.review} aspects={RESULT.aspects} />);
    expect(screen.getByLabelText("screen: Positive, 96% confidence")).toBeInTheDocument();
    expect(screen.getByLabelText("battery: Negative, 92% confidence")).toBeInTheDocument();
    expect(document.body.textContent).toContain("The ");
    expect(document.body.textContent).toContain(" is poor.");
  });

  it("ignores out-of-range offsets instead of crashing", () => {
    render(<HighlightedReview text="short" aspects={[{ text: "x", start: 2, end: 99, sentiment: "neutral", confidence: 0.5 }]} />);
    expect(screen.getByText("short")).toBeInTheDocument();
  });
});


describe("hidden Model page", () => {
  it("has no Model link in the navigation", () => {
    renderAt("/about");
    expect(screen.queryByRole("link", { name: /^model$/i })).not.toBeInTheDocument();
  });

  it("opens with Alt+Shift+M", async () => {
    renderAt("/about");
    await userEvent.keyboard("{Alt>}{Shift>}M{/Shift}{/Alt}");
    expect(await screen.findByRole("heading", { name: /how it works/i })).toBeInTheDocument();
  });

  it("still works when opened directly by URL", async () => {
    renderAt("/model");
    expect(await screen.findByRole("heading", { name: /how it works/i })).toBeInTheDocument();
  });
});

describe("new UX features", () => {
  it("navbar shows live model status from /api/health", async () => {
    renderAt("/about");
    expect(await screen.findByText("Models ready")).toBeInTheDocument();
  });

  it("status shows API offline when the backend is unreachable", async () => {
    vi.mocked(api.health).mockRejectedValue(new ApiError("down", 0));
    renderAt("/about");
    expect(await screen.findByText("API offline")).toBeInTheDocument();
  });

  it("theme toggle switches dark mode and remembers it", async () => {
    renderAt("/about");
    await userEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("smartreview-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("flags low-confidence aspects instead of presenting them as certain", async () => {
    vi.mocked(api.analyze).mockResolvedValue({ ...RESULT, aspects: [{ ...RESULT.aspects[0], confidence: 0.51 }, RESULT.aspects[1]] });
    renderAt("/analyze");
    await userEvent.type(screen.getByLabelText(/product review/i), RESULT.review);
    await userEvent.click(screen.getByRole("button", { name: /analyze review/i }));
    expect(await screen.findByText(/low confidence/i)).toBeInTheDocument();
  });

  it("landing shows measured metrics only when real evaluation files exist", async () => {
    vi.mocked(api.modelInfo).mockResolvedValue({
      ate: { training: null, test_metrics: { sentences: 305, exact_match: { precision: 0.77, recall: 0.83, f1: 0.8, tp: 1, predicted: 1, gold: 1 }, partial_match: { precision: 0.8, recall: 0.8, f1: 0.8 } } },
      atsc: { training: null, test_metrics: null },
    });
    renderAt("/");
    expect(await screen.findByText("80%")).toBeInTheDocument();
  });

  it("clear button resets the analyzer", async () => {
    renderAt("/analyze");
    await userEvent.type(screen.getByLabelText(/product review/i), "Nice screen");
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.getByLabelText(/product review/i)).toHaveValue("");
  });
});
