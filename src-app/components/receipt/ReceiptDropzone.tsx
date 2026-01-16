import { useCallback, useState, useRef } from "react";
import { FiUploadCloud, FiFile } from "react-icons/fi";
import { open } from "@tauri-apps/plugin-dialog";

interface ReceiptDropzoneProps {
  onFilesAdded: (filePaths: string[]) => Promise<void>;
  isProcessing: boolean;
}

export function ReceiptDropzone({ onFilesAdded, isProcessing }: ReceiptDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isProcessing) return;

      const files = Array.from(e.dataTransfer.files);
      const supportedFiles = files.filter((file) =>
        /\.(jpe?g|png|pdf)$/i.test(file.name)
      );

      if (supportedFiles.length > 0) {
        // Tauri環境ではファイルパスを取得できないので、webkitRelativePathを使用
        // 実際のTauri環境ではドラッグ&ドロップイベントからパスを取得する
        const paths = supportedFiles.map((f) => f.name);
        // Note: Tauri 2 ではD&Dでファイルパスを取得するにはplugin-uploadが必要
        // 一旦ダイアログで選択する方式を推奨
        console.log("Dropped files:", paths);
        alert("ファイルのドラッグ&ドロップは現在ダイアログ経由でのみサポートしています。下のボタンをクリックしてファイルを選択してください。");
      }
    },
    [isProcessing]
  );

  const handleSelectFiles = useCallback(async () => {
    if (isProcessing) return;

    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Receipt Files",
            extensions: ["jpg", "jpeg", "png", "pdf"],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await onFilesAdded(paths);
      }
    } catch (error) {
      console.error("Failed to select files:", error);
    }
  }, [isProcessing, onFilesAdded]);

  return (
    <div
      ref={dropzoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-6 transition-all
        ${isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 bg-white hover:border-gray-400"
        }
        ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
      onClick={handleSelectFiles}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={`
            p-3 rounded-full
            ${isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}
          `}
        >
          {isDragging ? (
            <FiFile className="w-8 h-8" />
          ) : (
            <FiUploadCloud className="w-8 h-8" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging
              ? "ここにドロップ"
              : "クリックしてファイルを選択"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            JPEG, PNG, PDF (複数選択可)
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">処理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
