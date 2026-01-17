import { useEffect, useState } from "react";
import {
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiAlertTriangle,
} from "react-icons/fi";
import type { ReceiptData } from "../../types/receipt";
import { generateThumbnail } from "../../services/pdf/pdfExtractor";
import { saveThumbnail } from "../../services/tauri/commands";

interface ReceiptCardProps {
  receipt: ReceiptData;
  yearMonth: string;
  onRemove: () => void;
  onUpdate: (updates: Partial<ReceiptData>) => void;
}

export function ReceiptCard({ receipt, yearMonth, onRemove, onUpdate }: ReceiptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    merchant: receipt.merchant ?? "",
    date: receipt.date ?? "",
    total: receipt.total?.toString() ?? "",
  });

  // 遅延サムネイル生成（サムネイルがない場合）
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  useEffect(() => {
    // サムネイルがあるか、既に生成中か、ファイルパスがない場合はスキップ
    if (receipt.thumbnailDataUrl || isGeneratingThumbnail || !receipt.filePath) {
      return;
    }

    const generateAndSaveThumbnail = async () => {
      setIsGeneratingThumbnail(true);
      try {
        const thumbnail = await generateThumbnail(receipt.filePath);
        if (thumbnail) {
          // ファイルに保存
          await saveThumbnail(yearMonth, receipt.file, thumbnail);
          // ストアを更新
          onUpdate({ thumbnailDataUrl: thumbnail });
        }
      } catch (error) {
        console.warn("Failed to generate thumbnail:", error);
      } finally {
        setIsGeneratingThumbnail(false);
      }
    };

    generateAndSaveThumbnail();
  }, [receipt.thumbnailDataUrl, receipt.filePath, receipt.file, yearMonth, isGeneratingThumbnail, onUpdate]);

  const handleSave = () => {
    onUpdate({
      merchant: editValues.merchant || undefined,
      date: editValues.date || undefined,
      total: editValues.total ? parseFloat(editValues.total) : undefined,
    });
    setIsEditing(false);
  };

  const getStatusIcon = () => {
    switch (receipt.status) {
      case "pending":
        return <FiClock className="w-4 h-4 text-gray-400" />;
      case "processing":
        return <FiLoader className="w-4 h-4 text-blue-500 animate-spin" />;
      case "success":
        return <FiCheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <FiAlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const hasIssues = receipt.issues && receipt.issues.length > 0;
  const hasErrors = receipt.issues?.some((i) => i.severity === "error");

  return (
    <div
      className={`
        bg-white rounded-lg border shadow-sm overflow-hidden
        ${hasErrors ? "border-red-300" : hasIssues ? "border-yellow-300" : "border-gray-200"}
      `}
    >
      {/* サムネイル */}
      <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
        {receipt.thumbnailDataUrl ? (
          <img
            src={receipt.thumbnailDataUrl}
            alt={receipt.file}
            className="w-full h-full object-contain"
          />
        ) : isGeneratingThumbnail ? (
          <FiLoader className="w-6 h-6 text-gray-400 animate-spin" />
        ) : (
          <span className="text-gray-400 text-xs">No Preview</span>
        )}
      </div>

      {/* コンテンツ */}
      <div className="p-3">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-800 truncate">
              {receipt.file}
            </span>
          </div>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* エラーメッセージ */}
        {receipt.status === "error" && receipt.errorMessage && (
          <div className="text-xs text-red-600 bg-red-50 rounded p-2 mb-2">
            {receipt.errorMessage}
          </div>
        )}

        {/* データフィールド */}
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValues.merchant}
              onChange={(e) =>
                setEditValues({ ...editValues, merchant: e.target.value })
              }
              placeholder="店舗名"
              className="w-full text-sm border rounded px-2 py-1"
            />
            <input
              type="date"
              value={editValues.date}
              onChange={(e) =>
                setEditValues({ ...editValues, date: e.target.value })
              }
              className="w-full text-sm border rounded px-2 py-1"
            />
            <input
              type="number"
              value={editValues.total}
              onChange={(e) =>
                setEditValues({ ...editValues, total: e.target.value })
              }
              placeholder="金額"
              className="w-full text-sm border rounded px-2 py-1"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 text-xs bg-blue-500 text-white rounded py-1 hover:bg-blue-600"
              >
                保存
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 text-xs bg-gray-200 text-gray-700 rounded py-1 hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">店舗:</span>
              <span className="text-gray-800 truncate ml-2">
                {receipt.merchant ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">日付:</span>
              <span className="text-gray-800">{receipt.date ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">金額:</span>
              <span className="text-gray-800 font-medium">
                {receipt.total != null
                  ? `\u00A5${receipt.total.toLocaleString()}`
                  : "-"}
              </span>
            </div>

            {receipt.status === "success" && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 mt-2"
              >
                編集
              </button>
            )}
          </div>
        )}

        {/* バリデーションイシュー */}
        {hasIssues && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            {receipt.issues!.map((issue, index) => (
              <div
                key={index}
                className={`
                  flex items-start gap-1 text-xs
                  ${issue.severity === "error" ? "text-red-600" : "text-yellow-600"}
                `}
              >
                <FiAlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
