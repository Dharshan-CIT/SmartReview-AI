import type { AspectSummary } from "../types";

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Plain-English takeaways from aspect counts. A pattern is only stated when there are at least `minMentions`
 * mentions behind it, so one stray review can never produce a headline.
 */
export function insightsFromAspects(aspects: AspectSummary[], minMentions = 2): string[] {
  const praised = aspects.filter((a) => a.positive >= minMentions && a.positive > a.negative).sort((a, b) => b.positive - a.positive).slice(0, 3);
  const criticised = aspects.filter((a) => a.negative >= minMentions && a.negative > a.positive).sort((a, b) => b.negative - a.negative).slice(0, 3);
  const split = aspects.filter((a) => a.positive >= minMentions && a.negative >= minMentions && Math.abs(a.positive - a.negative) <= 1).slice(0, 3);

  const out: string[] = [];
  if (praised.length) out.push(`Customers most often praise ${list(praised.map((a) => `${a.aspect} (${a.positive})`))}.`);
  if (criticised.length) out.push(`The most common complaints are about ${list(criticised.map((a) => `${a.aspect} (${a.negative})`))}.`);
  if (split.length) out.push(`Opinions are split on ${list(split.map((a) => `${a.aspect} (${a.positive} positive, ${a.negative} negative)`))}.`);
  if (!out.length) out.push(`No clear pattern yet: no feature was mentioned at least ${minMentions} times with a consistent opinion. Analyze more reviews for stronger insights.`);
  return out;
}
