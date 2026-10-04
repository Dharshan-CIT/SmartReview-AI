import { useEffect, useState, type ReactNode } from "react";

const KEY = "smartreview-splash-seen";
const SHOW_MS = 3000; // the splash stays for 3 seconds (click or any key skips it)
const FADE_MS = 400;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Branded splash shown once per browser session, before the app.
 * The app renders underneath immediately, so it is ready the moment the splash fades. Click or press any key to skip. Storage failures simply mean it shows again.
 */
export function Splash({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fade" | "done">(() => (alreadySeen() ? "done" : "show"));

  useEffect(() => {
    if (phase !== "show") return;
    // Same 5 seconds for everyone. With "reduce motion" on, the CSS turns the animations off, so the splash is simply static.
    const t = setTimeout(() => setPhase("fade"), SHOW_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fade") return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "show") return;
    const skip = () => setPhase("fade");
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [phase]);

  return (
    <>
      {children}
      {phase !== "done" && (
        <div
          role="status"
          aria-label="Loading SmartReview AI"
          onClick={() => setPhase("fade")}
          className={`fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-bg transition-opacity ease-out ${phase === "fade" ? "opacity-0" : "opacity-100"}`}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        >
          <div aria-hidden className="bg-hero absolute inset-0" />
          <div aria-hidden className="bg-grid absolute inset-0" />
          <div aria-hidden className="splash-orb absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />
          <div aria-hidden className="splash-orb absolute -right-20 bottom-1/4 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl [animation-delay:-3s]" />

          <div className="relative flex flex-col items-center px-6 text-center">
            <div className="splash-logo grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary-600 to-violet-600 shadow-glow">
              <svg viewBox="0 0 32 32" className="h-12 w-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path className="splash-check" d="M8 17l5 5 11-12" />
              </svg>
            </div>

            <h1 className="splash-title mt-8 text-5xl font-bold tracking-tight text-text sm:text-6xl">
              SmartReview <span className="text-gradient">AI</span>
            </h1>
            <p className="splash-tag mt-4 text-base text-muted sm:text-lg">Understand what your customers really think</p>

            <div className="mt-10 h-1 w-56 overflow-hidden rounded-full bg-border" aria-hidden>
              <div className="splash-bar h-full rounded-full bg-gradient-to-r from-primary-600 to-teal-400" />
            </div>
            <p className="mt-4 text-xs text-muted">Click or press any key to skip</p>
          </div>
        </div>
      )}
    </>
  );
}
