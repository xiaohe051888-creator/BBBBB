export type DedupeInput = {
  cache: Record<string, number>;
  key: string;
  now: number;
  cooldownMs: number;
};

export type DedupeResult = {
  show: boolean;
  nextCache: Record<string, number>;
};

export const shouldShowDedupe = ({ cache, key, now, cooldownMs }: DedupeInput): DedupeResult => {
  const last = cache[key];
  if (typeof last === 'number' && now - last < cooldownMs) {
    return { show: false, nextCache: cache };
  }
  return { show: true, nextCache: { ...cache, [key]: now } };
};

