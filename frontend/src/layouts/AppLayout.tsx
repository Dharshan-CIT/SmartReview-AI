import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useModelShortcut } from "../hooks/useModelShortcut";

export function AppLayout() {
  const { pathname } = useLocation();
  useModelShortcut();
  useEffect(() => {
    window.scrollTo(0, 0); // braces: an effect must not return scrollTo's value
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary-700 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div key={pathname} className="route-in"><Outlet /></div>
      </main>
      <footer className="border-t border-border bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-semibold tracking-tight">SmartReview <span className="text-primary-ink">AI</span></p>
            <p className="mt-2 max-w-sm text-sm text-muted">Aspect-based sentiment analysis for e-commerce reviews: find what customers talk about, and how they feel about it.</p>
          </div>
          <nav aria-label="Footer: tools">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tools</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-primary-ink" to="/analyze">Analyzer</Link></li>
              <li><Link className="hover:text-primary-ink" to="/batch">Batch report</Link></li>
              <li><Link className="hover:text-primary-ink" to="/compare">Compare products</Link></li>
            </ul>
          </nav>
          <nav aria-label="Footer: more">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">More</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-primary-ink" to="/dashboard">Analytics</Link></li>
              <li><Link className="hover:text-primary-ink" to="/history">History</Link></li>
              <li><Link className="hover:text-primary-ink" to="/about">About</Link></li>
            </ul>
          </nav>
        </div>
        <p className="border-t border-border py-4 text-center text-xs text-muted">Built with BERT, FastAPI and React · University PBL project</p>
      </footer>
    </div>
  );
}
