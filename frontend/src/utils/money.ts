export const formatMoney = (v: number | null | undefined, digits = 2): string => {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) return '-';
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const formatSignedMoney = (v: number | null | undefined, digits = 2): string => {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) return '-';
  const s = v.toFixed(digits);
  if (v > 0) return `+${s}`;
  return s;
};

