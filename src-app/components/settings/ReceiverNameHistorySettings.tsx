/**
 * 宛名設定コンポーネント
 */

import { useState } from "react";
import { FiTrash2, FiX, FiPlus, FiArrowUp } from "react-icons/fi";
import { useReceiverNameHistoryStore } from "../../hooks/useReceiverNameHistoryStore";

export function ReceiverNameHistorySettings() {
  const {
    registeredNames,
    historyNames,
    isLoading,
    addRegisteredName,
    promoteToRegistered,
    removeRegisteredName,
    removeFromHistory,
    clearHistory,
    clearRegistered,
  } = useReceiverNameHistoryStore();
  const [newName, setNewName] = useState("");

  const handleAddName = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      addRegisteredName(trimmed);
      setNewName("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddName();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">宛名設定</h3>
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 登録済み宛名セクション */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">登録済み宛名</h3>
          {registeredNames.length > 0 && (
            <button
              onClick={() => clearRegistered()}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <FiTrash2 className="w-3 h-3" />
              すべて削除
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">
          よく使う宛名を登録しておくと、レシート入力時に優先的に表示されます。
        </p>

        {/* 新規宛名追加 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="新しい宛名を入力"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button
            onClick={handleAddName}
            disabled={!newName.trim()}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <FiPlus className="w-4 h-4" />
            追加
          </button>
        </div>

        {/* 登録済み宛名一覧 */}
        {registeredNames.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
            登録された宛名がありません
          </p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {registeredNames.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span className="text-sm text-gray-700 truncate flex-1">
                  {name}
                </span>
                <button
                  onClick={() => removeRegisteredName(name)}
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

      {/* 入力履歴セクション */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">入力履歴</h3>
          {historyNames.length > 0 && (
            <button
              onClick={() => clearHistory()}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <FiTrash2 className="w-3 h-3" />
              すべて削除
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">
          過去に入力した宛名の履歴です。よく使う宛名は「登録」に昇格できます。
        </p>

        {/* 入力履歴一覧 */}
        {historyNames.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
            入力履歴がありません
          </p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {historyNames.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm text-gray-700 truncate flex-1">
                  {name}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => promoteToRegistered(name)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="登録に昇格"
                  >
                    <FiArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromHistory(name)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="削除"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
