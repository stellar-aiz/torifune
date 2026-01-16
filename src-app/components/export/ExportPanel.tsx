import { useState } from "react";
import { FiDownload, FiPlay, FiTrash2, FiCheck } from "react-icons/fi";
import type { ReceiptData } from "../../types/receipt";
import { exportToExcel } from "../../services/excel/exporter";

interface ExportPanelProps {
  receipts: ReceiptData[];
  isProcessing: boolean;
  onStartOcr: () => Promise<void>;
  onClearAll: () => void;
}

export function ExportPanel({
  receipts,
  isProcessing,
  onStartOcr,
  onClearAll,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const pendingCount = receipts.filter((r) => r.status === "pending").length;
  const processingCount = receipts.filter((r) => r.status === "processing").length;
  const successCount = receipts.filter((r) => r.status === "success").length;
  const errorCount = receipts.filter((r) => r.status === "error").length;

  const canStartOcr = pendingCount > 0 && !isProcessing;
  const canExport = successCount > 0 && !isProcessing && !isExporting;

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      await exportToExcel(receipts.filter((r) => r.status === "success"));
    } catch (error) {
      console.error("Export failed:", error);
      alert(`エクスポートに失敗しました: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartOcr = async () => {
    if (!canStartOcr) return;
    await onStartOcr();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">処理状況</h2>

      {/* ステータスサマリー */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-700">{receipts.length}</div>
          <div className="text-xs text-gray-500">総数</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{successCount}</div>
          <div className="text-xs text-gray-500">完了</div>
        </div>
        {pendingCount > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-xs text-gray-500">待機中</div>
          </div>
        )}
        {errorCount > 0 && (
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
            <div className="text-xs text-gray-500">エラー</div>
          </div>
        )}
      </div>

      {/* 進捗バー */}
      {isProcessing && processingCount > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${((successCount + errorCount) / receipts.length) * 100}%`,
              }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            {successCount + errorCount} / {receipts.length} 処理済み
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="space-y-2">
        <button
          onClick={handleStartOcr}
          disabled={!canStartOcr}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${canStartOcr
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              処理中...
            </>
          ) : (
            <>
              <FiPlay className="w-4 h-4" />
              OCR処理開始 ({pendingCount}件)
            </>
          )}
        </button>

        <button
          onClick={handleExport}
          disabled={!canExport}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${canExport
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              エクスポート中...
            </>
          ) : (
            <>
              <FiDownload className="w-4 h-4" />
              Excelエクスポート
            </>
          )}
        </button>

        {receipts.length > 0 && (
          <button
            onClick={onClearAll}
            disabled={isProcessing}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
              ${isProcessing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-red-500 border border-red-200 hover:bg-red-50"
              }
            `}
          >
            <FiTrash2 className="w-4 h-4" />
            すべてクリア
          </button>
        )}
      </div>

      {/* 注意事項 */}
      {successCount > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <FiCheck className="w-4 h-4 text-blue-500 mt-0.5" />
            <div className="text-xs text-blue-700">
              {successCount}件のレシートがエクスポート可能です。
              データを確認してからエクスポートしてください。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
