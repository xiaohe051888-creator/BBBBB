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

  const execCopy = async (): Promise<boolean> => {
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
    return ok;
  };

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      const verified1 = await verify();
      if (verified1 === true) return true;

      const ok = await execCopy();
      if (!ok) return false;

      const verified2 = await verify();
      if (verified2 === false) return false;
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const ok = await execCopy();
    if (!ok) return false;
    const verified = await verify();
    if (verified === false) return false;
    return true;
  } catch {
    return false;
  }
};
