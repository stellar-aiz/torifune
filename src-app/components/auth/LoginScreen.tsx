import { useState } from "react";
import { LoginButton } from "./LoginButton";

type Provider = "google" | "microsoft" | "slack";

interface LoginScreenProps {
  onLogin: (provider: Provider) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleLogin = async (provider: Provider) => {
    setLoadingProvider(provider);
    try {
      await onLogin(provider);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Main content */}
      <div className="w-full max-w-sm">
        {/* Logo and title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/conv-01.png"
              alt="トリフネ"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">トリフネ</h1>
          <p className="text-gray-400 text-sm">Receipt Analyzer</p>
        </div>

        {/* Login buttons */}
        <div className="space-y-3">
          <LoginButton
            provider="google"
            onClick={() => handleLogin("google")}
            isLoading={loadingProvider === "google"}
          />
          <LoginButton
            provider="microsoft"
            onClick={() => handleLogin("microsoft")}
            isLoading={loadingProvider === "microsoft"}
          />
          <LoginButton
            provider="slack"
            onClick={() => handleLogin("slack")}
            isLoading={loadingProvider === "slack"}
          />
        </div>

        {/* Divider with terms text */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center">
        <p className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} Stellar AIZ Inc. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
}
