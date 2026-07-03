import { Component, type ErrorInfo, type ReactNode } from "react";
import { FiAlertTriangle, FiFolder, FiRefreshCw } from "react-icons/fi";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { logError } from "../../services/errorLog";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
  logFilePath: string | null;
}

/**
 * Reactツリー内のレンダリング時例外を捕捉するエラーバウンダリ。
 * 白画面化を防ぎ、ローカルのエラーログへ記録した上で
 * ユーザーがログフォルダを開く/再読み込みできるフォールバックUIを表示する。
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    showDetails: false,
    logFilePath: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(error, { componentStack: errorInfo.componentStack ?? undefined })
      .then((logFilePath) => {
        this.setState({ logFilePath });
      })
      .catch(() => {
        // ログ書き込みの失敗が原因でここから再度例外が飛ぶことは絶対に避ける
      });
  }

  handleToggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  handleOpenLogFolder = async (): Promise<void> => {
    if (!this.state.logFilePath) return;
    try {
      await revealItemInDir(this.state.logFilePath);
    } catch (error) {
      console.error("Failed to open log folder:", error);
    }
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <FiAlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  予期しないエラーが発生しました
                </h2>
                <p className="text-sm text-gray-500">
                  お手数ですが、アプリを再読み込みしてください
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-4 space-y-3">
            <button
              onClick={this.handleToggleDetails}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {this.state.showDetails ? "詳細を隠す" : "詳細を表示"}
            </button>
            {this.state.showDetails && (
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-xs font-mono text-gray-600 break-all">
                  {this.state.error?.message ?? "エラー内容は不明です"}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
            <button
              onClick={this.handleOpenLogFolder}
              disabled={!this.state.logFilePath}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiFolder className="w-4 h-4" />
              ログフォルダを開く
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700 transition-all duration-200"
            >
              <FiRefreshCw className="w-4 h-4" />
              アプリを再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }
}
