import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineDiagram } from "../components/PipelineDiagram";
import { SentimentGauge } from "../components/SentimentGauge";
import { EmptyState } from "../components/ui/States";
import { CountUp, Reveal, prefersReducedMotion } from "../hooks/useMotion";
import LandingPage from "../pages/LandingPage";
import { api } from "../services/api";

vi.mock("../services/api", async (orig) => {
  const actual = await orig<typeof import("../services/api")>();
  return { ...actual, api: { ...actual.api, modelInfo: vi.fn() } };
});

beforeEach(() => {
  vi.mocked(api.modelInfo).mockResolvedValue({ ate: { training: null, test_metrics: null }, atsc: { training: null, test_metrics: null } });
});

describe("SentimentGauge", () => {
  it("describes the net sentiment in words and numbers for screen readers", () => {
    render(<SentimentGauge positive={3} negative={1} neutral={0} />);
    const g = screen.getByRole("img", { name: /net sentiment \+0\.50 \(mostly positive\): 3 positive, 1 negative, 0 neutral/i });
    expect(g).toBeInTheDocument();
    expect(screen.getByText("Mostly positive")).toBeInTheDocument();
  });

  it("is balanced for mixed results and neutral for none", () => {
    const { rerender } = render(<SentimentGauge positive={2} negative={1} neutral={0} />);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    rerender(<SentimentGauge positive={0} negative={0} neutral={0} />);
    expect(screen.getByText("No aspects")).toBeInTheDocument();
    rerender(<SentimentGauge positive={0} negative={3} neutral={0} />);
    expect(screen.getByText("Mostly negative")).toBeInTheDocument();
  });
});

describe("motion helpers", () => {
  it("the test environment reports reduced motion, so animations end instantly", () => {
    expect(prefersReducedMotion()).toBe(true);
  });

  it("CountUp shows the final value immediately under reduced motion and keeps it readable", () => {
    render(<CountUp value={0.82} format={(n) => `${Math.round(n * 100)}%`} />);
    const el = screen.getByLabelText("82%");
    expect(el).toHaveTextContent("82%");
  });

  it("Reveal renders its content visible when motion is reduced", () => {
    render(<Reveal><p>hello</p></Reveal>);
    expect(screen.getByText("hello").parentElement?.className).toContain("opacity-100");
  });
});

describe("illustrations and diagrams", () => {
  it("empty states show an illustration and the message", () => {
    const { container } = render(<EmptyState title="No reviews yet" message="Analyzed reviews will appear here." illustration="list" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("pipeline diagram lists the four processing steps in order", () => {
    render(<PipelineDiagram />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/review text/i);
    expect(items[1]).toHaveTextContent(/find the features/i);
    expect(items[2]).toHaveTextContent(/judge each feature/i);
    expect(items[3]).toHaveTextContent(/insights/i);
  });

  it("landing page shows the pipeline, the tools and no fake example predictions", async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /how smartreview ai processes a review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what you can do/i })).toBeInTheDocument();
    expect(screen.queryByText(/illustrative/i)).not.toBeInTheDocument();
  });
});
