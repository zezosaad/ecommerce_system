import type { SuccessEnvelope, ListEnvelope, ErrorEnvelope } from '@vendorhub/types';

type SessionExpiredCallback = () => void;

let onSessionExpired: SessionExpiredCallback | null = null;

export function registerSessionExpiredCallback(cb: SessionExpiredCallback): void {
  onSessionExpired = cb;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ErrorEnvelope | null,
  ) {
    super(body?.error?.message ?? `API error ${status}`);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
}

export class ApiClient {
  private baseUrl: string;
  private getAccessToken?: () => Promise<string | null>;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getAccessToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      onSessionExpired?.();
      throw new ApiClientError(401, await response.json().catch(() => null));
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiClientError(response.status, body);
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<SuccessEnvelope<T>> {
    return this.request<SuccessEnvelope<T>>(path, { method: 'GET' });
  }

  async getList<T>(path: string): Promise<ListEnvelope<T>> {
    return this.request<ListEnvelope<T>>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<SuccessEnvelope<T>> {
    return this.request<SuccessEnvelope<T>>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<SuccessEnvelope<T>> {
    return this.request<SuccessEnvelope<T>>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<SuccessEnvelope<T>> {
    return this.request<SuccessEnvelope<T>>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<SuccessEnvelope<T>> {
    return this.request<SuccessEnvelope<T>>(path, { method: 'DELETE' });
  }
}
