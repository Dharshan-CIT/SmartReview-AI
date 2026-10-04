import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** True when the user asked the OS for less motion. Animations then jump straight to their end state. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

/** Animate a number from 0 to `target` (ease-out). Honors reduced motion. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** A number that counts up when it first appears. `format` turns the animated value into text. */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration }: { value: number; format?: (n: number) => string; duration?: number }) {
  const v = useCountUp(value, duration);
  // aria-label keeps the FINAL value readable by screen readers while the digits animate.
  return <span aria-label={format(value)} className="tabular-nums">{format(v)}</span>;
}

/** Fade + slide a block in the first time it scrolls into view. Without IntersectionObserver it is simply visible. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined" || prefersReducedMotion());
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  const style: CSSProperties = { transitionDelay: shown ? `${delay}ms` : "0ms" };
  return (
    <div ref={ref} style={style} className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}>
      {children}
    </div>
  );
}
