import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Splash } from "../components/Splash";

describe("Splash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the brand over the app, then removes the overlay quickly", () => {
    render(<Splash><p>APP CONTENT</p></Splash>);
    expect(screen.getByRole("status", { name: /loading smartreview ai/i })).toBeInTheDocument();
    expect(screen.getByText(/SmartReview/)).toBeInTheDocument();
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument(); // already rendered underneath

    act(() => { vi.advanceTimersByTime(3100); }); // show -> fade
    act(() => { vi.advanceTimersByTime(500); }); // fade -> done
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /loading smartreview ai/i })).not.toBeInTheDocument();
  });

  it("can be skipped with a click", () => {
    render(<Splash><p>APP CONTENT</p></Splash>);
    act(() => { screen.getByRole("status").click(); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
  });

  it("does not show again in the same session", () => {
    sessionStorage.setItem("smartreview-splash-seen", "1");
    render(<Splash><p>APP CONTENT</p></Splash>);
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /loading smartreview ai/i })).not.toBeInTheDocument();
  });
});
