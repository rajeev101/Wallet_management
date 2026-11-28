export class ApiError extends Error {
  constructor(message: string, public readonly status = 0, public readonly code?: string) { super(message); this.name = 'ApiError'; }
}

export class HttpClient {
  token: string | null = null;
  onUnauthorized?: () => void;
  constructor(public readonly baseUrl: string, private readonly transport: typeof fetch = fetch, private readonly timeoutMs = 20000) {
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('API base URL must be an absolute HTTP(S) URL.');
  }

  async request<T>(path: string, method = 'GET', payload?: unknown, authenticated = true): Promise<T> {
    const token = authenticated ? this.token : null;
    if (authenticated && !token) throw new ApiError('Please sign in again.', 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.transport(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method, signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      const text = await response.text();
      let data: { message?: string; success?: boolean; code?: string };
      try { data = text ? JSON.parse(text) : {}; }
      catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status); }
      if (response.status === 401 && authenticated && this.token === token) this.onUnauthorized?.();
      if (!response.ok || data.success === false) throw new ApiError(data.message || `Request failed (${response.status}).`, response.status, data.code);
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError('The request timed out. Check your connection before trying again.');
      throw new ApiError('Unable to reach Campus Wallet. Check your internet connection and try again.');
    } finally { clearTimeout(timer); }
  }
}