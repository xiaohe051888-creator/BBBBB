import type { ThreeModelStatus } from '../services/api';
import { formatAiRoleLabel, formatModeSelectLabel } from '../utils/beginnerCopy';

type ModelEntry = Partial<ThreeModelStatus['models']['banker']>;

export interface ModeReadiness {
  aiReady: boolean;
  singleReady: boolean;
  ruleReady: true;
  missing3Ai: string[];
  missingSingle: string[];
}

const pushReason = (model: ModelEntry | undefined, label: string, out: string[]) => {
  if (!model?.api_key_set) {
    out.push(`${label}${formatModeSelectLabel('notConfigured')}`);
    return;
  }
  if (!model?.last_test_ok) {
    out.push(`${label}${formatModeSelectLabel('notReady')}`);
  }
};

export const buildModeReadiness = (status: ThreeModelStatus | null | undefined): ModeReadiness => {
  const models = status?.models;
  const missing3Ai: string[] = [];
  const missingSingle: string[] = [];

  if (!status?.ai_ready_for_enable) {
    pushReason(models?.banker, formatAiRoleLabel('banker', 'config'), missing3Ai);
    pushReason(models?.player, formatAiRoleLabel('player', 'config'), missing3Ai);
    pushReason(models?.combined, formatAiRoleLabel('combined', 'config'), missing3Ai);
  }
  if (!status?.single_ai_ready_for_enable) {
    pushReason(models?.single, formatAiRoleLabel('single'), missingSingle);
  }

  return {
    aiReady: !!status?.ai_ready_for_enable,
    singleReady: !!status?.single_ai_ready_for_enable,
    ruleReady: true,
    missing3Ai,
    missingSingle,
  };
};
