/** Calendar date in `YYYY-MM-DD` form. All domain logic works with this instead of `Date` so behavior stays deterministic and serializable. */
export type IsoDate = string;

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isOnOrBefore(a: IsoDate, b: IsoDate): boolean {
  return daysBetween(a, b) >= 0;
}

/** Injected "current time" so aggregates never call `new Date()` directly and stay unit-testable. */
export interface Clock {
  today(): IsoDate;
}

export const systemClock: Clock = {
  today: () => new Date().toISOString().slice(0, 10),
};

export function fixedClock(today: IsoDate): Clock {
  return { today: () => today };
}
