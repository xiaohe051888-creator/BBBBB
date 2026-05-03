export const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;

  const clipboard = navigator.clipboard;

  const verify = async (): Promise<boolean | null> => {
    if (!clipboard?.readText) return null;
    try {
      const v = await clipboard.readText();
      return v === text;
    } catch {
      return null;
    }
  };

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      const verified = await verify();
      if (verified === true) return true;
      if (verified === null) return true;
    } catch {
      // fall through
    }
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (!ok) return false;
    const verified = await verify();
    if (verified === false) return false;
    return true;
  } catch {
    return false;
  }
};
