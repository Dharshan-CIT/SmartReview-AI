import type { AspectSummary } from "../types";

/** Net sentiment of an aspect in [-1, 1]: (positive - negative) / mentions. */
export const netScore = (a?: AspectSummary) => (a && a.total ? (a.positive - a.negative) / a.total : 0);

export interface Row {
  aspect: string;
  a?: AspectSummary;
  b?: AspectSummary;
  winner: "A" | "B" | "tie" | "n/a";
}

/** Aspects mentioned for either product, with a winner per aspect (needs both sides mentioned). */
export function compareAspects(a: AspectSummary[], b: AspectSummary[]): Row[] {
  const map = new Map<string, Row>();
  for (const x of a) map.set(x.aspect, { aspect: x.aspect, a: x, winner: "n/a" });
  for (const y of b) map.set(y.aspect, { ...(map.get(y.aspect) ?? { aspect: y.aspect, winner: "n/a" as const }), b: y });
  const rows = [...map.values()].map((r) => {
    if (!r.a || !r.b) return r;
    const d = netScore(r.a) - netScore(r.b);
    return { ...r, winner: Math.abs(d) < 0.15 ? ("tie" as const) : d > 0 ? ("A" as const) : ("B" as const) };
  });
  return rows.sort((x, y) => (y.a?.total ?? 0) + (y.b?.total ?? 0) - ((x.a?.total ?? 0) + (x.b?.total ?? 0)));
}
