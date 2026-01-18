import { FiLoader } from "react-icons/fi";
import { openPath } from "@tauri-apps/plugin-opener";

interface ThumbnailPreviewProps {
  src?: string;
  alt: string;
  isLoading?: boolean;
  size?: number;
  filePath?: string;
}

export function ThumbnailPreview({
  src,
  alt,
  isLoading = false,
  size = 36,
  filePath,
}: ThumbnailPreviewProps) {
  const handleClick = async () => {
    if (filePath) {
      try {
        await openPath(filePath);
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    }
  };

  return (
    <div
      className={`rounded bg-gray-100 flex items-center justify-center overflow-hidden ${
        filePath ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""
      }`}
      style={{ width: size, height: size }}
      onClick={handleClick}
      title={filePath ? "クリックしてファイルを開く" : undefined}
    >
      {isLoading ? (
        <FiLoader className="w-4 h-4 text-gray-400 animate-spin" />
      ) : src ? (
        <img src={src} alt={alt} className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full bg-gray-200" />
      )}
    </div>
  );
}
