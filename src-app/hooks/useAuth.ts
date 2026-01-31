/**
 * 認証フック
 * AuthContextを簡単に利用するためのカスタムフック
 */

import { useAuthContext, type AuthContextType } from "../contexts/AuthContext";

/**
 * 認証状態と認証操作を提供するフック
 * AuthProvider外で使用するとエラーをスローする
 */
export function useAuth(): AuthContextType {
  return useAuthContext();
}
