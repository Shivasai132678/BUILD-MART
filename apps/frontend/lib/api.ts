import axios, { AxiosHeaders } from 'axios';

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  timestamp: string;
  path?: string;
};

// In the browser, use relative URLs so requests go through Next.js rewrites (same-origin proxy).
// On the server (middleware, SSR), use the absolute backend URL directly.
const baseURL = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length);
      if (value.length === 0) {
        return null;
      }

      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }

  return null;
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const csrfToken = readCookie('csrf_token');
    if (csrfToken) {
      const headers = AxiosHeaders.from(config.headers ?? {});
      headers.set('X-CSRF-Token', csrfToken);
      config.headers = headers;
    }
  }

  return config;
});

function isAuthEndpointRequest(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const requestUrl = error.config?.url;
  return typeof requestUrl === 'string' && requestUrl.includes('/api/v1/auth/');
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !isAuthEndpointRequest(error)
    ) {
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);

export function unwrapApiData<T>(payload: T | ApiSuccessEnvelope<T>): T {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as ApiSuccessEnvelope<T>).data;
  }

  return payload as T;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}
