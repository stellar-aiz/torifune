import {
  FiFolder,
  FiRefreshCw,
  FiCheck,
  FiAlertCircle,
  FiFolderPlus,
} from "react-icons/fi";
import type { DirectoryValidation } from "../../types/receipt";

/** バリデーションエラーメッセージを取得 */
function getValidationErrorMessage(validation: DirectoryValidation): string {
  if (!validation.exists) {
    return "指定されたパスが存在しません。フォルダを作成するか、別のパスを選択してください。";
  }
  if (!validation.isDirectory) {
    return "指定されたパスはディレクトリではありません。フォルダを選択してください。";
  }
  return "指定されたフォルダに書き込み権限がありません。別のフォルダを選択してください。";
}

interface FolderSettingsProps {
  rootDirectory: string;
  defaultDirectory: string;
  validation: DirectoryValidation | null;
  onPathChange: (path: string) => void;
  onReset: () => void;
  onBrowse: () => void;
  onCreate: () => void;
  isLoading?: boolean;
  isCreating?: boolean;
}

export function FolderSettings({
  rootDirectory,
  defaultDirectory,
  validation,
  onPathChange,
  onReset,
  onBrowse,
  onCreate,
  isLoading = false,
  isCreating = false,
}: FolderSettingsProps) {
  const isDefault = rootDirectory === defaultDirectory;
  const isValid =
    validation?.exists && validation?.isDirectory && validation?.isWritable;

  return (
    <div className="space-y-6">
      {/* ルートディレクトリ設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">
          保存先ルートディレクトリ
        </h3>

        {/* パス入力とボタン */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={rootDirectory}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder={defaultDirectory}
              disabled={isLoading}
              className={`
                w-full px-3 py-2 border rounded-lg text-sm font-mono
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${isLoading ? "bg-gray-100 text-gray-400" : ""}
                ${
                  validation && !isValid
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }
              `}
            />
          </div>

          {/* 参照ボタン */}
          <button
            onClick={onBrowse}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
              ${
                isLoading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }
            `}
          >
            <FiFolder className="w-4 h-4" />
            参照...
          </button>

          {/* デフォルトに戻すボタン */}
          <button
            onClick={onReset}
            disabled={isLoading || isDefault}
            title="デフォルトに戻す"
            className={`
              px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1
              ${
                isLoading || isDefault
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }
            `}
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* デフォルトパス表示 */}
        {!isDefault && (
          <p className="text-xs text-gray-500">
            デフォルト: <span className="font-mono">{defaultDirectory}</span>
          </p>
        )}
      </div>

      {/* バリデーションエラーメッセージ */}
      {validation && !isValid && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50">
            <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">
              {getValidationErrorMessage(validation)}
            </span>
          </div>
          {/* フォルダが存在しない場合は作成ボタンを表示 */}
          {!validation.exists && (
            <button
              onClick={onCreate}
              disabled={isLoading || isCreating}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isLoading || isCreating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }
              `}
            >
              <FiFolderPlus className="w-4 h-4" />
              {isCreating ? "作成中..." : "フォルダを作成"}
            </button>
          )}
        </div>
      )}

      {/* バリデーション成功メッセージ */}
      {validation && isValid && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50">
          <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700">
            ディレクトリは正常に設定されています
          </span>
        </div>
      )}

      {/* フォルダ構造の説明 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-600">
          フォルダ構造について
        </h4>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            レシートファイルは以下の構造で保存されます：
          </p>
          <code className="block text-sm font-mono text-gray-800 bg-white px-3 py-2 rounded border border-gray-200">
            {rootDirectory || defaultDirectory}/YYYY/MM/
          </code>
          <p className="text-xs text-gray-500 mt-2">
            例: 2025年1月のレシートは{" "}
            <span className="font-mono">
              {rootDirectory || defaultDirectory}/2025/01/
            </span>{" "}
            に保存されます
          </p>
        </div>
      </div>
    </div>
  );
}
