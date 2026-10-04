import type { AnalysisResult } from "../types";

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/**
 * Turn pasted text or an uploaded file into a list of reviews.
 * .csv: uses the column named "review" / "text" / "comment" (case-insensitive), else the first column (header skipped if it looks like one).
 * anything else: one review per non-empty line.
 */
export function extractReviews(text: string, filename = ""): string[] {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  if (/\.csv$/i.test(filename)) {
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const named = header.findIndex((h) => ["review", "reviews", "text", "comment", "body", "content"].includes(h));
    if (named >= 0) return rows.slice(1).map((r) => clean(r[named] ?? "")).filter(Boolean);
    // Skip the first row only when it is a KNOWN header name; guessing could silently drop a real one-word review.
    const knownHeader = rows.length > 1 && ["id", "index", "no", "number", "review", "reviews", "text", "comment", "body", "content", "feedback"].includes(header[0]);
    return (knownHeader ? rows.slice(1) : rows).map((r) => clean(r[0] ?? "")).filter(Boolean);
  }
  return text.split(/\r?\n/).map(clean).filter(Boolean);
}

/** Prefix cells that a spreadsheet would treat as formulas (= + - @), preventing CSV/formula injection. */
export function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** One row per aspect (or one row for a review without aspects). */
export function resultsToCsv(results: AnalysisResult[]): string {
  const lines = [["review", "overall_sentiment", "aspect", "aspect_sentiment", "confidence"].join(",")];
  for (const r of results) {
    if (!r.aspects.length) lines.push([q(safeCell(r.review)), q(r.overall_sentiment), q(""), q(""), q("")].join(","));
    for (const a of r.aspects) {
      lines.push([q(safeCell(r.review)), q(r.overall_sentiment), q(safeCell(a.text)), q(a.sentiment), q(a.confidence.toFixed(4))].join(","));
    }
  }
  return lines.join("\r\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
