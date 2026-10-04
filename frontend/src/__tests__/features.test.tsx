import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AspectCard } from "../components/AspectCard";
import { ToastProvider } from "../components/ui/Toast";
import { api } from "../services/api";
import type { AnalysisResult, BatchResponse } from "../types";
import { compareAspects, netScore } from "../utils/aspects";
import { extractReviews, parseCsv, resultsToCsv, safeCell } from "../utils/csv";
import { buildReportHtml } from "../utils/report";

vi.mock("../services/api", async (orig) => {
  const actual = await orig<typeof import("../services/api")>();
  return {
    ...actual,
    api: {
      analyze: vi.fn(), analyzeBatch: vi.fn(), analytics: vi.fn(), history: vi.fn(), modelInfo: vi.fn(), health: vi.fn(),
      historyItem: vi.fn(), deleteHistory: vi.fn(), clearHistory: vi.fn(), historyExportUrl: vi.fn(() => "/api/history/export"),
      giveFeedback: vi.fn(), feedbackSummary: vi.fn(),
    },
  };
});

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><ToastProvider><App /></ToastProvider></MemoryRouter>);

/** Batch / Compare / Model / Analytics pages are lazy-loaded chunks: wait for their heading. */
async function open(path: string, heading: RegExp) {
  renderAt(path);
  await screen.findByRole("heading", { name: heading }, { timeout: 8000 }); // first chunk load can be slow on a busy machine
}

function batchOf(texts: string[]): BatchResponse {
  const results: AnalysisResult[] = texts.map((t, i) => ({
    id: i + 1, review: t, overall_sentiment: "mixed", created_at: "2026-01-01T10:00:00",
    aspects: [
      { text: "screen", start: 0, end: 6, sentiment: "positive", confidence: 0.95 },
      { text: "battery", start: 7, end: 14, sentiment: "negative", confidence: 0.5 },
    ],
  }));
  return {
    results,
    summary: {
      reviews: texts.length, aspects: texts.length * 2, positive: texts.length, negative: texts.length, neutral: 0,
      avg_confidence: 0.725, low_confidence: texts.length, overall_distribution: { mixed: texts.length },
      top_aspects: [
        { aspect: "screen", total: texts.length, positive: texts.length, negative: 0, neutral: 0 },
        { aspect: "battery", total: texts.length, positive: 0, negative: texts.length, neutral: 0 },
      ],
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.health).mockResolvedValue({ status: "ok", models_loaded: true, device: "cpu" });
  vi.mocked(api.modelInfo).mockResolvedValue({ ate: { training: null, test_metrics: null }, atsc: { training: null, test_metrics: null } });
  vi.mocked(api.historyExportUrl).mockReturnValue("/api/history/export");
  vi.mocked(api.feedbackSummary).mockResolvedValue({ total_votes: 0, thumbs_up: 0, thumbs_down: 0, agreement_rate: null, most_disputed: [] });
});

describe("csv helpers", () => {
  it("parses quotes, commas and newlines inside quoted cells", () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n')).toEqual([["a", "b"], ["x, y", "line1\nline2"]]);
    expect(parseCsv('"say ""hi""",2')).toEqual([['say "hi"', "2"]]);
  });

  it("extracts reviews from text, and from csv by column name or first column", () => {
    expect(extractReviews("one\n\n  two  \r\nthree")).toEqual(["one", "two", "three"]);
    expect(extractReviews("id,Review\n1,Great screen\n2,Bad battery", "x.csv")).toEqual(["Great screen", "Bad battery"]);
    expect(extractReviews("comment\nGood\nBad", "x.csv")).toEqual(["Good", "Bad"]);
    expect(extractReviews("Good\nBad", "x.csv")).toEqual(["Good", "Bad"]);
  });

  it("neutralises spreadsheet formulas and quotes cells in exports", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("+1")).toBe("'+1");
    expect(safeCell("normal")).toBe("normal");
    const csv = resultsToCsv([{ id: 1, review: '=cmd "x"', overall_sentiment: "none", created_at: "", aspects: [] }]);
    expect(csv.split("\r\n")[1]).toBe(`"'=cmd ""x""","none","","",""`);
  });
});

describe("compare logic", () => {
  const s = (aspect: string, positive: number, negative: number, neutral = 0) => ({ aspect, total: positive + negative + neutral, positive, negative, neutral });

  it("computes net score and picks a winner only when both products mention the aspect", () => {
    expect(netScore(s("x", 3, 1))).toBeCloseTo(0.5);
    const rows = compareAspects([s("battery", 1, 3), s("screen", 3, 0), s("fan", 1, 0)], [s("battery", 3, 0), s("screen", 3, 0)]);
    const by = Object.fromEntries(rows.map((r) => [r.aspect, r.winner]));
    expect(by).toEqual({ battery: "B", screen: "tie", fan: "n/a" });
  });
});

describe("Batch page", () => {
  it("is reachable from the navigation and starts empty", async () => {
    await open("/batch", /batch analysis/i);
    expect(screen.getByRole("heading", { name: /batch analysis/i })).toBeInTheDocument();
    expect(screen.getByText(/add some reviews/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^analyze\s*reviews?$/i })).toBeDisabled();
  });

  it("loads samples, analyzes them in ONE request, and shows the report", async () => {
    vi.mocked(api.analyzeBatch).mockImplementation(async (r: string[]) => batchOf(r));
    await open("/batch", /batch analysis/i);
    await userEvent.click(screen.getByRole("button", { name: /load sample reviews/i }));
    expect(screen.getByText(/10 reviews detected/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /analyze 10 reviews/i }));
    expect(await screen.findByText("Aspects found")).toBeInTheDocument();
    expect(api.analyzeBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.analyzeBatch).mock.calls[0][0]).toHaveLength(10);
    expect(screen.getByText("Most praised feature")).toBeInTheDocument();
    expect(screen.getByText(/10 aspects had low confidence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("reads a .csv upload using the review column", async () => {
    await open("/batch", /batch analysis/i);
    const file = new File(["id,review\n1,Great screen\n2,Bad battery"], "reviews.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText(/upload a \.txt or \.csv file/i), file);
    expect(await screen.findByText(/2 reviews detected from reviews\.csv/i)).toBeInTheDocument();
  });

  it("blocks more than 50 reviews", async () => {
    await open("/batch", /batch analysis/i);
    const box = screen.getByLabelText(/reviews \(one per line\)/i);
    await userEvent.click(box);
    await userEvent.paste(Array.from({ length: 51 }, (_, i) => `review ${i}`).join("\n"));
    expect(screen.getByText(/too many, the limit is 50/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze 51 reviews/i })).toBeDisabled();
  });

  it("shows a friendly error when the API fails", async () => {
    vi.mocked(api.analyzeBatch).mockRejectedValue(new Error("We couldn't analyze this review. Please try again."));
    await open("/batch", /batch analysis/i);
    await userEvent.click(screen.getByRole("button", { name: /load sample reviews/i }));
    await userEvent.click(screen.getByRole("button", { name: /analyze 10 reviews/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't analyze/i);
  });
});

describe("Compare page", () => {
  it("compares two products with two batch calls that are not saved to history", async () => {
    vi.mocked(api.analyzeBatch).mockImplementation(async (r: string[]) => batchOf(r));
    await open("/compare", /compare products/i);
    expect(screen.getByRole("button", { name: /compare products/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /load sample reviews/i }));
    await userEvent.click(screen.getByRole("button", { name: /compare products/i }));
    expect(await screen.findByText("Verdict")).toBeInTheDocument();
    expect(api.analyzeBatch).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(api.analyzeBatch).mock.calls) expect(call[1]).toBe(false);
    expect(screen.getByText("Feature by feature")).toBeInTheDocument();
  });
});

describe("probability breakdown", () => {
  it("is hidden until requested, then lists all three classes", async () => {
    render(<AspectCard aspect={{ text: "battery", start: 0, end: 7, sentiment: "negative", confidence: 0.9,
      probabilities: { negative: 0.9, neutral: 0.06, positive: 0.04 } }} />);
    expect(screen.queryByRole("list", { name: /probabilities for battery/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show probability breakdown/i }));
    const list = screen.getByRole("list", { name: /probabilities for battery/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("90%")).toBeInTheDocument();
  });

  it("does not offer a breakdown for stored results without probabilities", () => {
    render(<AspectCard aspect={{ text: "screen", start: 0, end: 6, sentiment: "positive", confidence: 0.9 }} />);
    expect(screen.queryByRole("button", { name: /probability breakdown/i })).not.toBeInTheDocument();
  });
});

describe("demo mode and history extras", () => {
  it("demo mode analyzes examples one after another and can be stopped", async () => {
    vi.mocked(api.analyze).mockImplementation(async (r: string) => ({ ...batchOf([r]).results[0] }));
    renderAt("/analyze");
    await userEvent.click(screen.getByRole("button", { name: /play demo/i }));
    await waitFor(() => expect(api.analyze).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /stop demo/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /stop demo/i }));
    expect(screen.getByRole("button", { name: /play demo/i })).toBeInTheDocument();
  });

  it("history shows the aspect filter chip from the URL, and can clear it", async () => {
    vi.mocked(api.history).mockResolvedValue({ total: 0, items: [] });
    renderAt("/history?aspect=battery");
    expect(await screen.findByText(/reviews mentioning/i)).toBeInTheDocument();
    expect(vi.mocked(api.history).mock.calls[0][0]).toMatchObject({ aspect: "battery" });
    await userEvent.click(screen.getByRole("button", { name: /remove aspect filter/i }));
    await waitFor(() => expect(screen.queryByText(/reviews mentioning/i)).not.toBeInTheDocument());
  });

  it("clear-all asks for confirmation and does nothing if declined", async () => {
    vi.mocked(api.history).mockResolvedValue({ total: 1, items: [{ id: 1, text: "x review", overall_sentiment: "none", n_aspects: 0, n_positive: 0, n_negative: 0, n_neutral: 0, created_at: "2026-01-01T00:00:00" }] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAt("/history");
    await userEvent.click(await screen.findByRole("button", { name: /clear all/i }));
    expect(confirm).toHaveBeenCalled();
    expect(api.clearHistory).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe("feedback voting (AspectCard)", () => {
  beforeEach(() => localStorage.clear());

  it("casts a vote once, disables both buttons, and thanks the user", async () => {
    vi.mocked(api.giveFeedback).mockResolvedValue({ id: 42, thumbs_up: 1, thumbs_down: 0 });
    render(<ToastProvider><AspectCard aspect={{ id: 42, text: "screen", start: 0, end: 6, sentiment: "positive", confidence: 0.9 }} /></ToastProvider>);
    const up = screen.getByRole("button", { name: /mark the screen result as correct/i });
    await userEvent.click(up);
    expect(api.giveFeedback).toHaveBeenCalledWith(42, "up");
    expect(up).toBeDisabled();
    expect(screen.getByRole("button", { name: /mark the screen result as wrong/i })).toBeDisabled();
    expect(await screen.findByText(/thanks for the feedback/i)).toBeInTheDocument();
  });

  it("shows no voting controls for results that were never saved (e.g. Compare page)", () => {
    render(<AspectCard aspect={{ text: "screen", start: 0, end: 6, sentiment: "positive", confidence: 0.9 }} />);
    expect(screen.queryByText(/was this right/i)).not.toBeInTheDocument();
  });

  it("remembers a vote across remounts (localStorage) and never votes twice", async () => {
    vi.mocked(api.giveFeedback).mockResolvedValue({ id: 7, thumbs_up: 0, thumbs_down: 1 });
    const aspect = { id: 7, text: "battery", start: 0, end: 7, sentiment: "negative" as const, confidence: 0.9 };
    const { unmount } = render(<AspectCard aspect={aspect} />);
    await userEvent.click(screen.getByRole("button", { name: /mark the battery result as wrong/i }));
    unmount();
    render(<AspectCard aspect={aspect} />);
    expect(screen.getByRole("button", { name: /mark the battery result as wrong/i })).toBeDisabled();
    expect(api.giveFeedback).toHaveBeenCalledTimes(1);
  });
});

describe("Batch report export", () => {
  it("opens a printable report in a new tab once results exist", async () => {
    vi.mocked(api.analyzeBatch).mockImplementation(async (r: string[]) => batchOf(r));
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await open("/batch", /batch analysis/i);
    await userEvent.click(screen.getByRole("button", { name: /load sample reviews/i }));
    await userEvent.click(screen.getByRole("button", { name: /^analyze \d+ reviews?$/i }));
    await screen.findByText("Aspects found");
    await userEvent.click(screen.getByRole("button", { name: /report \(pdf\)/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(String(url)).toMatch(/^blob:/);
    expect(target).toBe("_blank");
    openSpy.mockRestore();
  });
});

describe("report HTML content", () => {
  it("includes the key sections, the insights, and escapes review text", () => {
    const data = batchOf(["<script>alert(1)</script> screen"]);
    const html = buildReportHtml(data, ["Customers most often praise screen (1)."]);
    expect(html).toContain("SmartReview AI — Batch Analysis Report");
    expect(html).toContain("Customers most often praise screen (1).");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("window.print()");
  });
});

describe("Model page: community feedback and golden-review cards", () => {
  it("shows an empty state when there is no feedback yet", async () => {
    await open("/model", /how it works/i);
    expect(await screen.findByText(/no feedback has been left yet/i)).toBeInTheDocument();
  });

  it("shows totals, agreement rate, and the most-disputed table once feedback exists", async () => {
    vi.mocked(api.feedbackSummary).mockResolvedValue({
      total_votes: 5, thumbs_up: 3, thumbs_down: 2, agreement_rate: 0.6,
      most_disputed: [{ aspect_id: 1, review_id: 1, term: "battery", sentiment: "negative", thumbs_up: 1, thumbs_down: 2 }],
    });
    await open("/model", /how it works/i);
    expect((await screen.findByText("Total votes")).closest("div")).toHaveTextContent("5");
    expect(screen.getByText(/agreement rate/i)).toHaveTextContent("60.0%");
    expect(screen.getByText("battery")).toBeInTheDocument();
  });

  it("shows the golden-review buckets and reveals the still-wrong cases on demand", async () => {
    vi.mocked(api.modelInfo).mockResolvedValue({
      ate: { training: null, test_metrics: null }, atsc: { training: null, test_metrics: null },
      golden: {
        buckets: { all: { correct: 9, of: 10, rate: 0.9 }, in_scope: { correct: 5, of: 5, rate: 1 } },
        still_wrong: [{ review: "The keyboard is okay.", expected: { keyboard: "neutral" }, got: [["keyboard", "positive"]], correct: 0, of: 1, detail: "" }],
      },
    });
    await open("/model", /how it works/i);
    expect(await screen.findByText(/golden-review answer check/i)).toBeInTheDocument();
    expect(screen.getByText("Overall").closest("div")).toHaveTextContent("90.0%");
    const toggle = screen.getByRole("button", { name: /show the 1 case still wrong/i });
    expect(screen.queryByText("The keyboard is okay.")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText("The keyboard is okay.")).toBeInTheDocument();
  });

  it("hides both new cards gracefully when the backend has no result files yet", async () => {
    await open("/model", /how it works/i);
    expect(screen.queryByText(/golden-review answer check/i)).not.toBeInTheDocument();
    expect(screen.getByText(/community feedback/i)).toBeInTheDocument(); // this card always renders (shows an empty state instead)
  });
});
