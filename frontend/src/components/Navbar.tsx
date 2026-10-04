import { CheckCheck, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { StatusDot } from "./StatusDot";

const LINKS = [
  { to: "/analyze", label: "Analyzer" },
  { to: "/batch", label: "Batch" },
  { to: "/compare", label: "Compare" },
  { to: "/dashboard", label: "Analytics" },
  { to: "/history", label: "History" },
  { to: "/about", label: "About" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-primary-50 text-primary-ink" : "text-muted hover:bg-neu-bg hover:text-text"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-600 text-white shadow-glow">
            <CheckCheck className="h-5 w-5" aria-hidden />
          </span>
          SmartReview <span className="text-primary-ink">AI</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={link}>{l.label}</NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <StatusDot />
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-lg border border-border p-2 text-muted transition-colors hover:bg-neu-bg hover:text-text"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            className="rounded-lg p-2 text-muted hover:bg-neu-bg lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-surface px-4 pb-3 pt-2 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={link} onClick={() => setOpen(false)}>{l.label}</NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
