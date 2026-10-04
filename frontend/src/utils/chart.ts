/** Shared Recharts styling that follows the light/dark theme via CSS variables. */
export const GRID = "var(--color-border)";
export const TICK = { fontSize: 12, fill: "var(--color-muted)" };
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    color: "var(--color-text)",
    boxShadow: "var(--shadow-pop)",
  },
  labelStyle: { color: "var(--color-text)", fontWeight: 600 },
  itemStyle: { color: "var(--color-text)" },
  cursor: { fill: "var(--color-neu-bg)" },
};
