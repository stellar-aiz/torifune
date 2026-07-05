/**
 * エラーログ設定コンポーネント
 */

import { useEffect, useState } from "react";
import { FiClipboard, FiMail } from "react-icons/fi";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  readErrorLog,
  type ErrorLogRecord,
} from "../../services/tauri/commands";

const SUPPORT_EMAIL = "hiromu.ochiai@stellar-aiz.com";

const sourceBadgeStyle: Record<string, string> = {
  frontend: "bg-blue-100 text-blue-700",
  "rust-panic": "bg-red-100 text-red-700",
};

function buildMailtoUrl(): string {
  const subject = "torifune エラーログの報告";
  const body = [
    "お世話になっております。",
    "",
    "torifuneでエラーが発生しましたのでご報告します。",
    "",
    "「クリップボードにコピー」ボタンでログをコピーした場合は、下記に貼り付けてください。",
    "",
    "---",
    "ここに貼り付け",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function LogsSettings() {
  const [entries, setEntries] = useState<ErrorLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [copyMessage, setCopyMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        const records = await readErrorLog();
        setEntries(records);
      } catch (error) {
        console.error("Failed to read error log:", error);
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadLogs();
  }, []);

  const sortedEntries = [...entries].sort((a, b) =>
    a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0,
  );

  const handleToggleDetails = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopy = async () => {
    try {
      const text = entries.map((entry) => JSON.stringify(entry)).join("\n");
      await writeText(text);
      setCopyMessage({ success: true, text: "コピーしました" });
    } catch (error) {
      console.error("Failed to copy error log:", error);
      setCopyMessage({ success: false, text: "コピーに失敗しました" });
    }
  };

  const handleEmail = async () => {
    try {
      await openUrl(buildMailtoUrl());
    } catch (error) {
      console.error("Failed to open mail client:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">エラーログ</h3>
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">エラーログ</h3>
      <p className="text-xs text-gray-500">
        直近30日以内にこの端末で記録されたエラーログです。開発者への調査依頼に利用できます。
      </p>

      {/* アクションバー */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FiClipboard className="w-4 h-4" />
          クリップボードにコピー
        </button>
        <button
          onClick={handleEmail}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          <FiMail className="w-4 h-4" />
          開発者にメールで送信
        </button>
        {copyMessage && (
          <span
            className={`text-xs ${copyMessage.success ? "text-green-600" : "text-red-600"}`}
          >
            {copyMessage.text}
          </span>
        )}
      </div>

      {/* ログ一覧 */}
      {sortedEntries.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
          直近30日以内のエラーログはありません
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedEntries.map((entry, index) => {
            const badgeClass =
              sourceBadgeStyle[entry.source] ?? "bg-gray-200 text-gray-700";
            const hasDetails = Boolean(entry.stack || entry.context);
            const isExpanded = expandedIndices.has(index);

            return (
              <div
                key={`${entry.timestamp}-${index}`}
                className="rounded-lg bg-gray-50 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString("ja-JP")}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}
                  >
                    {entry.source}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{entry.message}</p>
                {hasDetails && (
                  <>
                    <button
                      onClick={() => handleToggleDetails(index)}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {isExpanded ? "詳細を隠す" : "詳細を表示"}
                    </button>
                    {isExpanded && (
                      <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                        <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap break-all">
                          {[entry.stack, entry.context]
                            .filter(Boolean)
                            .join("\n\n")}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
