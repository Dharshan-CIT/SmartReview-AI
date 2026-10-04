import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Illustration, type IllustrationKind } from "./Illustration";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg ${className}`} />;
}

export function EmptyState({ title, message, action, illustration = "search" }: { title?: string; message: string; action?: ReactNode; illustration?: IllustrationKind }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Illustration kind={illustration} />
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <p className="max-w-md text-muted">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-neg-border bg-neg-bg px-6 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-neg" aria-hidden />
      <p className="max-w-md font-medium text-neg">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
