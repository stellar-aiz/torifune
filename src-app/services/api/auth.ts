/**
 * 認証API
 * OAuth認証に関するAPI呼び出しを担当
 */

import { post } from "./client";
import type { User } from "../../contexts/AuthContext";

/** OAuth認証プロバイダー */
export type AuthProvider = "google" | "microsoft" | "slack";

/** ログイン開始レスポンス */
export interface StartLoginResponse {
  authUrl: string;
  state: string;
  codeVerifier: string;
}

/** トークン交換レスポンス */
export interface ExchangeCodeResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** トークンリフレッシュレスポンス */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * OAuth認証フローを開始
 * 認証URLとPKCEパラメータを取得
 */
export async function startLogin(
  provider: AuthProvider,
): Promise<StartLoginResponse> {
  return post<StartLoginResponse>(
    "/auth/login/start",
    { provider },
    { skipAuth: true },
  );
}

/**
 * 認証コードをトークンに交換
 * OAuth認証コールバック後に呼び出す
 */
export async function exchangeCode(
  code: string,
  state: string,
  codeVerifier: string,
): Promise<ExchangeCodeResponse> {
  return post<ExchangeCodeResponse>(
    "/auth/login/callback",
    { code, state, codeVerifier },
    { skipAuth: true },
  );
}

/**
 * アクセストークンをリフレッシュ
 * 期限切れのトークンを更新
 */
export async function refreshToken(
  refreshTokenValue: string,
): Promise<RefreshTokenResponse> {
  return post<RefreshTokenResponse>(
    "/auth/refresh",
    { refreshToken: refreshTokenValue },
    { skipAuth: true },
  );
}

/**
 * ログアウト
 * サーバー側のセッションを無効化
 */
export async function logout(): Promise<void> {
  return post<void>("/auth/logout", undefined, { skipAuth: false });
}
