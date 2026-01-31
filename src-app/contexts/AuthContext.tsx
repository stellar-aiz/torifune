/**
 * 認証コンテキスト
 * OAuth認証状態の管理とトークンの永続化を担当
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import * as authApi from "../services/api/auth";

/** ユーザー情報 */
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: "google" | "microsoft" | "slack";
  tier: "free" | "pro";
}

/** 認証状態 */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/** 保存されたトークン情報 */
interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** 認証コンテキストの型 */
export interface AuthContextType {
  state: AuthState;
  login: (provider: "google" | "microsoft" | "slack") => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Tauriコマンド: トークンを取得 */
async function loadStoredTokens(): Promise<StoredTokens | null> {
  try {
    return await invoke<StoredTokens | null>("get_auth_tokens");
  } catch (error) {
    console.warn("Failed to load stored tokens:", error);
    return null;
  }
}

/** Tauriコマンド: トークンを保存 */
async function saveTokens(tokens: StoredTokens): Promise<void> {
  try {
    await invoke<void>("save_auth_tokens", { tokens });
  } catch (error) {
    console.error("Failed to save tokens:", error);
    throw error;
  }
}

/** Tauriコマンド: トークンを削除 */
async function clearTokens(): Promise<void> {
  try {
    await invoke<void>("clear_auth_tokens");
  } catch (error) {
    console.error("Failed to clear tokens:", error);
    throw error;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [storedRefreshToken, setStoredRefreshToken] = useState<string | null>(
    null,
  );

  /** 初期化時にトークンを読み込み */
  useEffect(() => {
    const initialize = async () => {
      try {
        const stored = await loadStoredTokens();
        if (stored) {
          setAccessToken(stored.accessToken);
          setStoredRefreshToken(stored.refreshToken);
          setUser(stored.user);
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  /** ログイン処理 */
  const login = useCallback(
    async (provider: "google" | "microsoft" | "slack") => {
      setIsLoading(true);

      try {
        // OAuth認証フローを開始
        const { authUrl, state, codeVerifier } =
          await authApi.startLogin(provider);

        // ブラウザで認証URLを開く（Tauriのシェルコマンド経由）
        await invoke("open_external_url", { url: authUrl });

        // 認証コールバックを待機（deep link経由で受け取る）
        // 注: 実際の実装ではTauriのイベントリスナーでコールバックを処理
        const code = await waitForAuthCallback(state);

        // 認証コードをトークンに交換
        const tokens = await authApi.exchangeCode(code, state, codeVerifier);

        // トークンと user を保存
        await saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: tokens.user,
        });

        setAccessToken(tokens.accessToken);
        setStoredRefreshToken(tokens.refreshToken);
        setUser(tokens.user);
      } catch (error) {
        console.error("Login failed:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /** ログアウト処理 */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await authApi.logout();
      await clearTokens();
      setAccessToken(null);
      setStoredRefreshToken(null);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
      // ローカルの状態はクリアする
      await clearTokens();
      setAccessToken(null);
      setStoredRefreshToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** トークンリフレッシュ */
  const refreshTokenAction = useCallback(async () => {
    if (!storedRefreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const tokens = await authApi.refreshToken(storedRefreshToken);

      // 更新されたトークンを保存
      if (user) {
        await saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
        });
      }

      setAccessToken(tokens.accessToken);
      setStoredRefreshToken(tokens.refreshToken);
    } catch (error) {
      console.error("Token refresh failed:", error);
      // リフレッシュ失敗時はログアウト状態にする
      await clearTokens();
      setAccessToken(null);
      setStoredRefreshToken(null);
      setUser(null);
      throw error;
    }
  }, [storedRefreshToken, user]);

  /** 認証状態 */
  const state: AuthState = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user && !!accessToken,
    }),
    [user, isLoading, accessToken],
  );

  /** コンテキスト値 */
  const contextValue: AuthContextType = useMemo(
    () => ({
      state,
      login,
      logout,
      refreshToken: refreshTokenAction,
    }),
    [state, login, logout, refreshTokenAction],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/** 認証コンテキストを取得するフック */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

/**
 * 認証コールバックを待機するヘルパー
 * Tauriのイベントリスナーを使用してdeep linkからの認証コードを受け取る
 */
async function waitForAuthCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Authentication timeout"));
    }, 300000); // 5分タイムアウト

    // Tauriイベントをリッスン
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ code: string; state: string }>("auth-callback", (event) => {
        clearTimeout(timeout);
        const { code, state } = event.payload;

        if (state !== expectedState) {
          reject(new Error("Invalid state parameter"));
          return;
        }

        resolve(code);
      });
    });
  });
}
