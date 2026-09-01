/** Cliente HTTP do PDV. Erros de rede são distinguidos de erros de negócio. */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/v1';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor');
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(error.code ?? 'UNKNOWN', error.message ?? 'Falha na requisição', response.status, error.details);
  }
  return payload as T;
}
