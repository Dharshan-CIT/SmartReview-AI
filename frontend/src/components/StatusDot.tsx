import { useEffect, useState } from "react";
import { api } from "../services/api";

type State = "checking" | "ready" | "no-models" | "offline";

const LABEL: Record<State, string> = {
  checking: "Checking…",
  ready: "Models ready",
  "no-models": "Models not loaded",
  offline: "API offline",
};
const COLOR: Record<State, string> = {
  checking: "bg-neu",
  ready: "bg-pos",
  "no-models": "bg-mix",
  offline: "bg-neg",
};

/** Live backend health (polled): a real signal, useful before a demo. */
export function StatusDot() {
  const [state, setState] = useState<State>("checking");
  const [device, setDevice] = useState("");

  useEffect(() => {
    let alive = true;
    const check = () =>
      api.health()
        .then((h) => {
          if (!alive) return;
          setState(h.models_loaded ? "ready" : "no-models");
          setDevice(h.device);
        })
        .catch(() => alive && setState("offline"));
    check();
    const t = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span
      role="status"
      title={device && state === "ready" ? `Running on ${device.toUpperCase()}` : undefined}
      className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted lg:inline-flex"
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${COLOR[state]} ${state === "ready" ? "animate-pulse-dot" : ""}`} />
      {LABEL[state]}
    </span>
  );
}
