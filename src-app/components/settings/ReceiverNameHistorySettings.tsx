/**
 * 宛名履歴管理設定コンポーネント
 */

import { FiTrash2, FiX } from "react-icons/fi";
import { useReceiverNameHistoryStore } from "../../hooks/useReceiverNameHistoryStore";

export function ReceiverNameHistorySettings() {
  const { names, isLoading, removeName, clearAll } = useReceiverNameHistoryStore();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">宛名履歴</h3>
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">宛名履歴</h3>
        {names.length > 0 && (
          <button
            onClick={() => clearAll()}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <FiTrash2 className="w-3 h-3" />
            すべて削除
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        入力した宛名は履歴として保存され、次回から選択できます。
      </p>

      {names.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-lg">
          履歴がありません
        </p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {names.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm text-gray-700 truncate flex-1">{name}</span>
              <button
                onClick={() => removeName(name)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                title="削除"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
