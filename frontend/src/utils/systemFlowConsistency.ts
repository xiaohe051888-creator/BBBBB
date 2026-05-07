export type PredictionMode = 'ai' | 'single_ai' | 'rule';

export const formatAccuracyPercent = (accuracy?: number | null) => {
  return `${(accuracy || 0).toFixed(1)}%`;
};

export const resolvePredictionMode = (
  systemMode?: PredictionMode | null,
  analysisMode?: PredictionMode | null,
): PredictionMode => {
  return systemMode || analysisMode || 'rule';
};
