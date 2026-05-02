export const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;

  const clipboard = navigator.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
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
    return ok;
  } catch {
    return false;
  }
};

