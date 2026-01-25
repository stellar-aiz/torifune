import { useState, useEffect } from "react";
import { FiX, FiCheck, FiAlertCircle, FiCpu, FiFolder, FiTag, FiCheckSquare } from "react-icons/fi";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import {
  testProviderConnection,
  getDefaultRootDirectory,
  getRootDirectory,
  saveRootDirectory,
  validateDirectory,
  createDirectory,
} from "../../services/tauri/commands";
import type { OcrProvider, DirectoryValidation } from "../../types/receipt";
import { FolderSettings } from "./FolderSettings";
import { AccountCategoryRulesSettings } from "./AccountCategoryRulesSettings";
import { ValidationRulesSettings } from "./ValidationRulesSettings";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "ocr" | "storage" | "accountCategory" | "validationRules";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "storage", label: "保存先設定", icon: <FiFolder className="w-4 h-4" /> },
  { id: "ocr", label: "OCR設定", icon: <FiCpu className="w-4 h-4" /> },
  { id: "accountCategory", label: "勘定科目ルール", icon: <FiTag className="w-4 h-4" /> },
  { id: "validationRules", label: "検証ルール", icon: <FiCheckSquare className="w-4 h-4" /> },
];

const providers: { id: OcrProvider; label: string }[] = [
  { id: "googledocumentai", label: "Google Document AI" },
  { id: "veryfi", label: "Veryfi" },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settingsStore = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settingsStore.settings);
  const [activeTab, setActiveTab] = useState<SettingsTab>("storage");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Storage settings state
  const [rootDirectory, setRootDirectory] = useState<string>("");
  const [defaultDirectory, setDefaultDirectory] = useState<string>("");
  const [directoryValidation, setDirectoryValidation] =
    useState<DirectoryValidation | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [isCreatingDirectory, setIsCreatingDirectory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settingsStore.settings);
      setTestResult(null);
    }
  }, [isOpen, settingsStore.settings]);

  // Load storage settings when modal opens
  useEffect(() => {
    const loadStorageSettings = async () => {
      try {
        setStorageLoading(true);
        const [root, defaultRoot] = await Promise.all([
          getRootDirectory(),
          getDefaultRootDirectory(),
        ]);
        setRootDirectory(root);
        setDefaultDirectory(defaultRoot);
        // Validate directory
        const validation = await validateDirectory(root);
        setDirectoryValidation(validation);
      } catch (error) {
        console.error("Failed to load storage settings:", error);
      } finally {
        setStorageLoading(false);
      }
    };
    if (isOpen) {
      loadStorageSettings();
    }
  }, [isOpen]);

  const handleSave = async () => {
    await settingsStore.saveSettings(localSettings);
    await saveRootDirectory(rootDirectory);
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

  const handlePathChange = async (path: string) => {
    setRootDirectory(path);
    // Validate the new path
    try {
      const validation = await validateDirectory(path);
      setDirectoryValidation(validation);
    } catch (error) {
      setDirectoryValidation(null);
    }
  };

  const handleResetPath = () => {
    handlePathChange(defaultDirectory);
  };

  const handleBrowse = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "保存先フォルダを選択",
      defaultPath: rootDirectory,
    });
    if (selected) {
      handlePathChange(selected as string);
    }
  };

  const handleCreateDirectory = async () => {
    setIsCreatingDirectory(true);
    try {
      await createDirectory(rootDirectory);
      // 作成後に再検証
      const validation = await validateDirectory(rootDirectory);
      setDirectoryValidation(validation);
    } catch (error) {
      console.error("Failed to create directory:", error);
    } finally {
      setIsCreatingDirectory(false);
    }
  };

  const selectedProvider = localSettings.provider ?? "googledocumentai";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full mx-8 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">設定</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* タブコンテンツエリア */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左側：タブリスト */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 p-2 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* 右側：タブコンテンツ */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "ocr" && (
              <div className="space-y-6">
                {/* プロバイダ選択 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    OCRプロバイダ
                  </h3>
                  <div className="flex gap-4">
                    {providers.map((provider) => (
                      <label
                        key={provider.id}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors
                          ${selectedProvider === provider.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="provider"
                          value={provider.id}
                          checked={selectedProvider === provider.id}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              provider: e.target.value as OcrProvider,
                            })
                          }
                        />
                        <span className="text-sm font-medium text-gray-800">
                          {provider.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Google Document AI 設定 */}
                {selectedProvider === "googledocumentai" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Google Document AI 設定
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
                )}

                {/* Veryfi 設定 */}
                {selectedProvider === "veryfi" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Veryfi 設定
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        クライアントID
                      </label>
                      <input
                        type="text"
                        value={localSettings.veryfiClientId ?? ""}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            veryfiClientId: e.target.value || undefined,
                          })
                        }
                        placeholder="vrfXXXXXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        クライアントシークレット
                      </label>
                      <input
                        type="password"
                        value={localSettings.veryfiClientSecret ?? ""}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            veryfiClientSecret: e.target.value || undefined,
                          })
                        }
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        ユーザー名
                      </label>
                      <input
                        type="text"
                        value={localSettings.veryfiUsername ?? ""}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            veryfiUsername: e.target.value || undefined,
                          })
                        }
                        placeholder="your-username"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        APIキー
                      </label>
                      <input
                        type="password"
                        value={localSettings.veryfiApiKey ?? ""}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            veryfiApiKey: e.target.value || undefined,
                          })
                        }
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      Veryfi のダッシュボードから API 認証情報を取得してください
                    </p>
                  </div>
                )}

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

                {/* 接続テストボタン */}
                <div className="pt-2">
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
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <FolderSettings
                rootDirectory={rootDirectory}
                defaultDirectory={defaultDirectory}
                validation={directoryValidation}
                onPathChange={handlePathChange}
                onReset={handleResetPath}
                onBrowse={handleBrowse}
                onCreate={handleCreateDirectory}
                isLoading={storageLoading}
                isCreating={isCreatingDirectory}
              />
            )}

            {activeTab === "accountCategory" && (
              <AccountCategoryRulesSettings />
            )}

            {activeTab === "validationRules" && (
              <ValidationRulesSettings />
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
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
  );
}
