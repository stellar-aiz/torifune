/**
 * APIクライアント
 * 認証付きHTTPリクエストを行うためのfetchラッパー
 */

import { invoke } from "@tauri-apps/api/core";

/** APIレスポンスエラー */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

/** リクエストオプション */
interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  skipAuth?: boolean;
}

/** APIクライアント設定 */
interface ApiClientConfig {
  baseUrl: string;
}

/** デフォルト設定 */
const defaultConfig: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "https://api.torifune.app",
};

let config = { ...defaultConfig };

/** APIクライアント設定を更新 */
export function configureApiClient(newConfig: Partial<ApiClientConfig>): void {
  config = { ...config, ...newConfig };
}

/** 保存されたアクセストークンを取得 */
async function getAccessToken(): Promise<string | null> {
  try {
    const tokens = await invoke<{ accessToken: string } | null>(
      "get_auth_tokens",
    );
    return tokens?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** トークンをリフレッシュ */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const tokens = await invoke<{
      accessToken: string;
      refreshToken: string;
    } | null>("get_auth_tokens");
    if (!tokens?.refreshToken) {
      return null;
    }

    // リフレッシュAPIを呼び出し
    const response = await fetch(`${config.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const newTokens = await response.json();

    // 新しいトークンを保存
    await invoke("save_auth_tokens", {
      tokens: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: newTokens.user,
      },
    });

    return newTokens.accessToken;
  } catch {
    return null;
  }
}

/** URLにクエリパラメータを追加 */
function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = new URL(path, config.baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/** HTTPリクエストを実行 */
async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { headers = {}, params, body, skipAuth = false } = options;

  // ヘッダーを構築
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // 認証トークンを追加
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  // リクエスト実行
  let response = await fetch(buildUrl(path, params), {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401エラー時はトークンリフレッシュを試行
  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(buildUrl(path, params), {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  // エラーレスポンスの処理
  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  // 204 No Content の場合
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/** GETリクエスト */
export async function get<T>(
  path: string,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return request<T>("GET", path, options);
}

/** POSTリクエスト */
export async function post<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return request<T>("POST", path, { ...options, body });
}

/** PATCHリクエスト */
export async function patch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return request<T>("PATCH", path, { ...options, body });
}

/** DELETEリクエスト */
export async function del<T>(
  path: string,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return request<T>("DELETE", path, options);
}

/** APIクライアントをエクスポート */
export const apiClient = {
  get,
  post,
  patch,
  delete: del,
  configure: configureApiClient,
};
