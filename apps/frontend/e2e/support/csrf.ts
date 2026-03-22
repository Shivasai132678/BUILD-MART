import type { APIRequestContext } from '@playwright/test';

type CookieLike = {
  name: string;
  value: string;
};

function extractCsrfToken(cookies: CookieLike[]): string | null {
  const tokenCookie = cookies.find((cookie) => cookie.name === 'csrf_token');
  if (!tokenCookie?.value) {
    return null;
  }

  try {
    return decodeURIComponent(tokenCookie.value);
  } catch {
    return tokenCookie.value;
  }
}

export async function getCsrfHeaders(
  req: APIRequestContext,
  apiBase: string,
): Promise<Record<string, string>> {
  const state = await req.storageState();
  const cookies = state.cookies.filter((cookie) => {
    try {
      const url = new URL(apiBase);
      const host = url.hostname.toLowerCase();
      const domain = cookie.domain.replace(/^\./, '').toLowerCase();
      return (
        host === domain ||
        host.endsWith(`.${domain}`)
      );
    } catch {
      return true;
    }
  });

  const csrfToken = extractCsrfToken(cookies);
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
}
