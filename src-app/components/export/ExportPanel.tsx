import { useState, useEffect } from "react";
import { FiDownload, FiPlay, FiTrash2, FiCheck } from "react-icons/fi";
import type { ReceiptData } from "../../types/receipt";
import { openSummaryExcel, checkSummaryExcelExists } from "../../services/excel/exporter";

interface ExportPanelProps {
  receipts: ReceiptData[];
  yearMonth: string;
  isProcessing: boolean;
  onStartOcr: () => Promise<void>;
  onClearAll: () => void;
}

export function ExportPanel({
  receipts,
  yearMonth,
  isProcessing,
  onStartOcr,
  onClearAll,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [excelExists, setExcelExists] = useState(false);

  const pendingCount = receipts.filter((r) => r.status === "pending").length;
  const processingCount = receipts.filter((r) => r.status === "processing").length;
  const successCount = receipts.filter((r) => r.status === "success").length;
  const errorCount = receipts.filter((r) => r.status === "error").length;

  // サマリーExcelの存在確認
  useEffect(() => {
    checkSummaryExcelExists(yearMonth).then(setExcelExists);
  }, [yearMonth, successCount]);

  const canStartOcr = pendingCount > 0 && !isProcessing;
  const canOpenExcel = (excelExists || successCount > 0) && !isProcessing && !isExporting;

  const handleOpenExcel = async () => {
    if (!canOpenExcel) return;

    setIsExporting(true);
    try {
      await openSummaryExcel(receipts, yearMonth);
    } catch (error) {
      console.error("Failed to open Excel:", error);
      alert(`Excelを開けませんでした: ${error}`);
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
      <div className="space-y-1 mb-4 text-xs">
        <div className="flex justify-between text-gray-600">
          <span>総数</span>
          <span className="font-medium">{receipts.length}</span>
        </div>
        <div className="flex justify-between text-green-600">
          <span>完了</span>
          <span className="font-medium">{successCount}</span>
        </div>
        {pendingCount > 0 && (
          <div className="flex justify-between text-yellow-600">
            <span>待機中</span>
            <span className="font-medium">{pendingCount}</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>エラー</span>
            <span className="font-medium">{errorCount}</span>
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
              OCR処理開始
            </>
          )}
        </button>

        <button
          onClick={handleOpenExcel}
          disabled={!canOpenExcel}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${canOpenExcel
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
              Excelを開く
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
