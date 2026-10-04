export function formatDate(iso: string): string {
  // The API returns naive UTC timestamps; mark them as UTC so local time is correct.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
