import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AspectCard } from "../components/AspectCard";
import { insightsFromAspects } from "../utils/insights";

const a = (aspect: string, positive: number, negative: number, neutral = 0) => ({ aspect, total: positive + negative + neutral, positive, negative, neutral });

describe("insightsFromAspects", () => {
  it("names praised, criticised and split features, ranked by mentions", () => {
    const out = insightsFromAspects([a("display", 5, 0), a("keyboard", 3, 1), a("battery", 0, 4), a("price", 2, 2), a("fan", 0, 2)]);
    expect(out[0]).toBe("Customers most often praise display (5) and keyboard (3).");
    expect(out[1]).toBe("The most common complaints are about battery (4) and fan (2).");
    expect(out[2]).toBe("Opinions are split on price (2 positive, 2 negative).");
  });

  it("never states a pattern from a single mention", () => {
    const out = insightsFromAspects([a("battery", 0, 1), a("screen", 1, 0)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/no clear pattern yet/i);
  });

  it("handles no data", () => {
    expect(insightsFromAspects([])[0]).toMatch(/no clear pattern yet/i);
  });

  it("limits each sentence to three features", () => {
    const out = insightsFromAspects([a("a", 9, 0), a("b", 8, 0), a("c", 7, 0), a("d", 6, 0)]);
    expect(out[0]).toBe("Customers most often praise a (9), b (8) and c (7).");
  });
});

describe("AspectCard transparency", () => {
  it("tells the user when a wording rule changed the model's answer", () => {
    render(<AspectCard aspect={{ text: "keyboard", start: 4, end: 12, sentiment: "neutral", confidence: 0.12, adjusted: "mild wording (okay)",
      probabilities: { negative: 0.03, neutral: 0.12, positive: 0.85 } }} />);
    expect(screen.getByText(/adjusted by a wording rule: mild wording \(okay\)/i)).toBeInTheDocument();
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();      // honest: the model's own neutral probability is low
  });

  it("explains mild wording without changing the label", () => {
    render(<AspectCard aspect={{ text: "keyboard", start: 4, end: 12, sentiment: "positive", confidence: 0.85, hint: "mild wording (okay)" }} />);
    expect(screen.getByText(/mild wording \(okay\)/i)).toBeInTheDocument();
    expect(screen.getByText(/could also be read as neutral/i)).toBeInTheDocument();
    expect(screen.getByText("Positive")).toBeInTheDocument();
  });

  it("shows nothing extra for normal results", () => {
    render(<AspectCard aspect={{ text: "screen", start: 4, end: 10, sentiment: "positive", confidence: 0.95 }} />);
    expect(screen.queryByText(/adjusted/i)).not.toBeInTheDocument();
  });
});
