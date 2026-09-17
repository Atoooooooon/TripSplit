/**
 * Universal clipboard copy helper that works in both HTTPS and HTTP (insecure context)
 */
export async function copyText(text: string): Promise<boolean> {
  // Try modern Clipboard API first (only works in Secure Context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard failed, falling back to execCommand', e);
    }
  }

  // Fallback for HTTP (non-secure context, e.g. http://117.72.123.54:81)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}

/**
 * Generate full, clean share URL for a trip access code
 */
export function getTripShareUrl(accessCode: string): string {
  const origin = window.location.origin;
  let pathname = window.location.pathname;
  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`;
  }
  return `${origin}${pathname}?code=${encodeURIComponent(accessCode.trim().toUpperCase())}`;
}

/**
 * Generate friendly invite text for WeChat / messaging apps
 */
export function getTripInviteText(tripName: string, accessCode: string): string {
  const url = getTripShareUrl(accessCode);
  const cleanCode = accessCode.trim().toUpperCase();
  return `✈️ 邀请你加入「${tripName}」旅行记账！\n🔗 点击链接直接进入：\n${url}\n🔑 或打开网站输入房间口令：${cleanCode}`;
}
