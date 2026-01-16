import { useState, useEffect } from "react";
import { FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import { testProviderConnection } from "../../services/tauri/commands";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settingsStore = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settingsStore.settings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settingsStore.settings);
      setTestResult(null);
    }
  }, [isOpen, settingsStore.settings]);

  const handleSave = async () => {
    await settingsStore.saveSettings(localSettings);
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // 一時的に設定を保存してからテスト
      await settingsStore.saveSettings(localSettings);
      await testProviderConnection();
      setTestResult({ success: true, message: "接続テスト成功" });
    } catch (error) {
      setTestResult({
        success: false,
        message: `接続テスト失敗: ${error}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">OCR設定</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            {/* Google Document AI セクション */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Google Document AI
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  プロジェクトID
                </label>
                <input
                  type="text"
                  value={localSettings.projectId ?? ""}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      projectId: e.target.value || undefined,
                    })
                  }
                  placeholder="your-project-id"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  ロケーション
                </label>
                <input
                  type="text"
                  value={localSettings.location ?? ""}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      location: e.target.value || undefined,
                    })
                  }
                  placeholder="us (デフォルト)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  プロセッサID
                </label>
                <input
                  type="text"
                  value={localSettings.processorId ?? ""}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      processorId: e.target.value || undefined,
                    })
                  }
                  placeholder="0000000000000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  サービスアカウントJSON
                </label>
                <textarea
                  value={localSettings.serviceAccountJson ?? ""}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      serviceAccountJson: e.target.value || undefined,
                    })
                  }
                  placeholder='{"type": "service_account", ...}'
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  GCPコンソールからダウンロードしたサービスアカウントキーのJSON全体を貼り付けてください
                </p>
              </div>
            </div>

            {/* 接続テスト結果 */}
            {testResult && (
              <div
                className={`
                  flex items-start gap-2 p-3 rounded-lg
                  ${testResult.success ? "bg-green-50" : "bg-red-50"}
                `}
              >
                {testResult.success ? (
                  <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    testResult.success ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {testResult.message}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isTesting
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }
            `}
          >
            {isTesting ? "テスト中..." : "接続テスト"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
