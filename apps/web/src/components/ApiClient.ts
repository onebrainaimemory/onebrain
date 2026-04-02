const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
  meta?: {
    cursor?: string;
    hasMore?: boolean;
    total?: number;
  };
}

function buildHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'OneBrain',
    ...extraHeaders,
  };

  return headers;
}

// Paths that should not trigger a token refresh on 401
const AUTH_PATHS = ['/v1/auth/refresh', '/v1/auth/logout', '/v1/auth/logout-all'];

// Singleton refresh promise to prevent concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${API_BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'OneBrain' },
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function emitSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('onebrain:session-expired'));
  }
}

async function rawFetch<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ response: Response; json: ApiResponse<T> | null }> {
  const hasBody = body !== undefined && body !== null;
  const headers = buildHeaders();
  if (!hasBody) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (response.status === 204) {
    return { response, json: null };
  }

  const json = (await response.json()) as ApiResponse<T> & {
    meta?: { pagination?: { cursor?: string; hasMore?: boolean; total?: number } };
  };

  if (json.meta?.pagination) {
    json.meta.cursor = json.meta.pagination.cursor;
    json.meta.hasMore = json.meta.pagination.hasMore;
    json.meta.total = json.meta.pagination.total;
  }

  return { response, json };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<ApiResponse<T>> {
  let url = `${API_BASE}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const { response, json } = await rawFetch<T>(method, url, body);

  if (response.status === 204) {
    return { data: undefined as T };
  }

  // On 401, try silent token refresh then retry once
  if (response.status === 401 && !AUTH_PATHS.includes(path)) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retry = await rawFetch<T>(method, url, body);
      if (retry.response.status === 204) {
        return { data: undefined as T };
      }
      if (retry.json && !retry.response.ok && !retry.json.error) {
        return {
          error: {
            code: 'HTTP_ERROR',
            message: `Request failed with status ${retry.response.status}`,
          },
        };
      }
      return retry.json ?? { data: undefined as T };
    }

    // Refresh failed — session truly expired
    emitSessionExpired();
    return {
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session expired',
      },
    };
  }

  if (json && !response.ok && !json.error) {
    return {
      error: {
        code: 'HTTP_ERROR',
        message: `Request failed with status ${response.status}`,
      },
    };
  }

  return json ?? { data: undefined as T };
}

export const apiClient = {
  get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>('GET', path, undefined, params);
  },

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body);
  },

  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('PATCH', path, body);
  },

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path);
  },
};

export type { ApiResponse };
