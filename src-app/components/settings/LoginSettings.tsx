import { FaGoogle, FaMicrosoft, FaSlack } from "react-icons/fa";
import { FiLogOut, FiLoader } from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";

type OAuthProvider = "google" | "microsoft" | "slack";

/**
 * ログイン設定コンポーネント
 * 設定モーダル内でアカウントのログイン・ログアウトを管理
 */
export function LoginSettings() {
  const { state, login, logout } = useAuth();

  const handleLogin = async (provider: OAuthProvider) => {
    try {
      await login(provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ログイン中の場合
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // ログイン済みの場合
  if (state.isAuthenticated && state.user) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            ログイン中のアカウント
          </h3>

          <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
            {/* アバター */}
            {state.user.picture ? (
              <img
                src={state.user.picture}
                alt={state.user.name}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-lg">
                {state.user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* ユーザー情報 */}
            <div className="flex-1">
              <p className="font-medium text-gray-800">{state.user.name}</p>
              <p className="text-sm text-gray-500">{state.user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 capitalize">
                  {state.user.provider}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    state.user.tier === "pro"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {state.user.tier === "pro" ? "Pro" : "Free"}
                </span>
              </div>
            </div>

            {/* ログアウトボタン */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <FiLogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>

        {/* プラン情報 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            プラン情報
          </h3>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-800">
                  {state.user.tier === "pro" ? "Pro プラン" : "Free プラン"}
                </p>
                <p className="text-sm text-blue-600">
                  {state.user.tier === "pro"
                    ? "無制限のOCR処理"
                    : "月300枚まで無料"}
                </p>
              </div>
              {state.user.tier !== "pro" && (
                <button className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors">
                  アップグレード
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 未ログインの場合
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          アカウントにログイン
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          ログインすると、サーバー側でOCR処理が行われ、月300枚まで無料で利用できます。
        </p>
      </div>

      <div className="space-y-3">
        {/* Google */}
        <button
          onClick={() => handleLogin("google")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FaGoogle className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium text-gray-700">
            Googleでログイン
          </span>
        </button>

        {/* Microsoft */}
        <button
          onClick={() => handleLogin("microsoft")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FaMicrosoft className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            Microsoftでログイン
          </span>
        </button>

        {/* Slack */}
        <button
          onClick={() => handleLogin("slack")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FaSlack className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">
            Slackでログイン
          </span>
        </button>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          ログインせずにアプリを使用することもできます。その場合、OCR処理にはローカルの設定（OCR設定タブ）が使用されます。
        </p>
      </div>
    </div>
  );
}
