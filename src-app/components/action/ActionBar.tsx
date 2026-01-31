import {
  FiPlay,
  FiDownload,
  FiTrash2,
  FiLoader,
  FiCheckCircle,
} from "react-icons/fi";

interface ActionBarProps {
  canStartOcr: boolean;
  isProcessing: boolean;
  processingProgress?: {
    completed: number;
    total: number;
  };
  onStartOcr: () => Promise<void>;
  onOpenExcel: () => Promise<void>;
  onDeleteMonth: () => void;
  canDeleteMonth: boolean;
  onValidate: () => void;
  canValidate: boolean;
}

export function ActionBar({
  canStartOcr,
  isProcessing,
  processingProgress,
  onStartOcr,
  onOpenExcel,
  onDeleteMonth,
  canDeleteMonth,
  onValidate,
  canValidate,
}: ActionBarProps) {
  const isOcrDisabled = !canStartOcr && !isProcessing;

  return (
    <div className="h-10 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
      {/* Left side: OCR button + progress */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStartOcr}
          disabled={isOcrDisabled}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${
              isProcessing
                ? "bg-blue-500 text-white cursor-wait"
                : canStartOcr
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {isProcessing ? (
            <>
              <FiLoader className="w-3.5 h-3.5 animate-spin" />
              処理中...
            </>
          ) : (
            <>
              <FiPlay className="w-3.5 h-3.5" />
              OCR実行
            </>
          )}
        </button>

        {/* Progress display (only during processing) */}
        {isProcessing && processingProgress && (
          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{
                  width: `${(processingProgress.completed / processingProgress.total) * 100}%`,
                }}
              />
            </div>
            {/* Progress text */}
            <span className="text-xs text-gray-600">
              {processingProgress.completed} / {processingProgress.total}{" "}
              処理済み
            </span>
          </div>
        )}

        {/* Validate button */}
        <button
          onClick={onValidate}
          disabled={isProcessing || !canValidate}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${
              isProcessing || !canValidate
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }
          `}
        >
          <FiCheckCircle className="w-3.5 h-3.5" />
          データ検証
        </button>
      </div>

      {/* Right side: Excel + Delete buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenExcel}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-gray-700 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          <FiDownload className="w-3.5 h-3.5" />
          Excelを開く
        </button>

        <button
          onClick={onDeleteMonth}
          disabled={isProcessing || !canDeleteMonth}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${
              isProcessing || !canDeleteMonth
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-red-500 border border-red-200 hover:bg-red-50"
            }
          `}
        >
          <FiTrash2 className="w-3.5 h-3.5" />
          削除
        </button>
      </div>
    </div>
  );
}
