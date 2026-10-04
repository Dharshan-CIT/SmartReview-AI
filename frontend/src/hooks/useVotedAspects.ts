import { useCallback, useEffect, useState } from "react";

const KEY = "smartreview-voted-aspects";
type Vote = "up" | "down";

function readAll(): Record<number, Vote> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Remembers which aspect ids this browser already voted on, so the same person can't vote twice. */
export function useVotedAspects() {
  const [voted, setVoted] = useState<Record<number, Vote>>(() => readAll());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(voted));
    } catch {
      /* storage unavailable: the vote still goes to the server, it just is not remembered locally */
    }
  }, [voted]);

  const record = useCallback((aspectId: number, vote: Vote) => {
    setVoted((v) => ({ ...v, [aspectId]: vote }));
  }, []);

  return { voted, record };
}
