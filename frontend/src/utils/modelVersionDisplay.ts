const MANUAL_SINGLE_AI_PATTERN = /^single_ai-manual-(\d{14})$/;

const formatTimestamp = (stamp: string) => {
  const year = stamp.slice(0, 4);
  const month = stamp.slice(4, 6);
  const day = stamp.slice(6, 8);
  const hour = stamp.slice(8, 10);
  const minute = stamp.slice(10, 12);
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export const getModelVersionDisplay = (version: string | null | undefined) => {
  if (!version) {
    return {
      title: '默认版本',
      subtitle: null,
    };
  }

  const manualMatch = version.match(MANUAL_SINGLE_AI_PATTERN);
  if (manualMatch) {
    const formattedTime = formatTimestamp(manualMatch[1]);
    return {
      title: '单AI · 手动配置',
      subtitle: `生效于 ${formattedTime}`,
    };
  }

  return {
    title: version,
    subtitle: null,
  };
};

export const formatModelVersionLabel = (version: string | null | undefined) => {
  const display = getModelVersionDisplay(version);
  return display.subtitle ? `${display.title} · ${display.subtitle.replace(/^生效于 /, '')}` : display.title;
};
