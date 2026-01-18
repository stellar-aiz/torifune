import { useCallback, useState, useRef, useEffect } from "react";
import { FiUploadCloud, FiFile } from "react-icons/fi";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|pdf)$/i;

interface ReceiptDropzoneProps {
  onFilesAdded: (filePaths: string[]) => Promise<void>;
  isProcessing: boolean;
}

export function ReceiptDropzone({ onFilesAdded, isProcessing }: ReceiptDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const webview = getCurrentWebview();
    const unlistenPromise = webview.onDragDropEvent((event) => {
      const { payload } = event;

      switch (payload.type) {
        case "enter":
          setIsDragging(true);
          break;
        case "leave":
          setIsDragging(false);
          break;
        case "drop": {
          setIsDragging(false);
          if (isProcessingRef.current) return;

          const supportedFiles = payload.paths.filter((path) =>
            SUPPORTED_EXTENSIONS.test(path)
          );
          if (supportedFiles.length > 0) {
            onFilesAdded(supportedFiles);
          }
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onFilesAdded]);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

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
        relative border-2 border-dashed rounded-lg px-4 py-2 transition-all
        ${isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 bg-white hover:border-gray-400"
        }
        ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
      onClick={handleSelectFiles}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            p-1.5 rounded-full
            ${isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}
          `}
        >
          {isDragging ? (
            <FiFile className="w-5 h-5" />
          ) : (
            <FiUploadCloud className="w-5 h-5" />
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-700">
            {isDragging
              ? "ここにドロップ"
              : "ファイルをここにドロップ、またはクリックして選択"}
          </p>
          <p className="text-xs text-gray-400">
            JPEG, PNG, PDF (複数選択可)
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-600">処理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
