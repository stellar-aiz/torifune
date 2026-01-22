import { useEffect, useState, useCallback } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiLoader,
  FiAlertTriangle,
} from "react-icons/fi";
import { EditableCell } from "../ui/EditableCell";
import { ThumbnailPreview } from "../ui/ThumbnailPreview";
import { Tooltip } from "../ui/Tooltip";
import type { ReceiptData } from "../../types/receipt";
import { generateThumbnail } from "../../services/pdf/pdfExtractor";
import { saveThumbnail } from "../../services/tauri/commands";

interface ReceiptTableRowProps {
  receipt: ReceiptData;
  yearMonth: string;
  onRemove: () => void;
  onUpdate: (updates: Partial<ReceiptData>) => void;
}

export function ReceiptTableRow({
  receipt,
  yearMonth,
  onRemove,
  onUpdate,
}: ReceiptTableRowProps) {
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Thumbnail generation logic (copied from ReceiptCard)
  useEffect(() => {
    if (receipt.thumbnailDataUrl || isGeneratingThumbnail || !receipt.filePath) {
      return;
    }

    const generateAndSaveThumbnail = async () => {
      setIsGeneratingThumbnail(true);
      try {
        const thumbnail = await generateThumbnail(receipt.filePath);
        if (thumbnail) {
          await saveThumbnail(yearMonth, receipt.file, thumbnail);
          onUpdate({ thumbnailDataUrl: thumbnail });
        }
      } catch (error) {
        console.warn("Failed to generate thumbnail:", error);
      } finally {
        setIsGeneratingThumbnail(false);
      }
    };

    generateAndSaveThumbnail();
  }, [
    receipt.thumbnailDataUrl,
    receipt.filePath,
    receipt.file,
    yearMonth,
    isGeneratingThumbnail,
    onUpdate,
  ]);

  // Status icon logic
  const getStatusIcon = () => {
    switch (receipt.status) {
      case "pending":
        return <FiClock className="w-4 h-4 text-gray-400" />;
      case "processing":
        return <FiLoader className="w-4 h-4 text-blue-500 animate-spin" />;
      case "success":
        return <FiCheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return (
          <Tooltip content={receipt.errorMessage ?? "OCRエラー"} position="top">
            <FiAlertCircle className="w-4 h-4 text-red-500" />
          </Tooltip>
        );
    }
  };

  // Validation helpers
  const hasIssues = receipt.issues && receipt.issues.length > 0;
  const hasErrors = receipt.issues?.some((i) => i.severity === "error");
  const hasWarnings = receipt.issues?.some((i) => i.severity === "warning");

  // Handle save for each field
  const handleDateSave = (newValue: string) => {
    onUpdate({ date: newValue || undefined });
  };

  const handleMerchantSave = (newValue: string) => {
    onUpdate({ merchant: newValue || undefined });
  };

  const handleAmountSave = (newValue: string) => {
    onUpdate({ amount: newValue ? parseFloat(newValue) : undefined });
  };

  const handleRemoveClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await ask(`「${receipt.file}」を削除しますか？`, {
      title: "削除の確認",
      kind: "warning",
    });
    if (confirmed) {
      onRemove();
    }
  }, [receipt.file, onRemove]);

  // Validation column content
  const renderValidationColumn = () => {
    if (!hasIssues) {
      return <FiCheckCircle className="w-4 h-4 text-green-500" />;
    }

    const tooltipContent = (
      <div className="space-y-1">
        {receipt.issues!.map((issue, index) => (
          <div key={index}>{issue.message}</div>
        ))}
      </div>
    );

    return (
      <Tooltip content={tooltipContent} position="top">
        <FiAlertTriangle
          className={`w-4 h-4 ${hasErrors ? "text-red-500" : "text-yellow-500"}`}
        />
      </Tooltip>
    );
  };

  // Row background class
  const getRowBackgroundClass = () => {
    if (hasErrors) return "bg-red-50";
    if (hasWarnings) return "bg-yellow-50";
    return "";
  };

  return (
    <tr
      className={`
        border-b border-gray-200 hover:bg-gray-50 transition-colors
        ${getRowBackgroundClass()}
      `}
    >
      {/* Filename */}
      <td className="min-w-[200px] px-3 py-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-800 truncate" title={receipt.file}>
            {receipt.file}
          </span>
        </div>
      </td>

      {/* Thumbnail */}
      <td className="w-fit px-3 py-2">
        <ThumbnailPreview
          src={receipt.thumbnailDataUrl}
          alt={receipt.file}
          isLoading={isGeneratingThumbnail}
          size={36}
          filePath={receipt.filePath}
        />
      </td>

      {/* Date */}
      <td className="min-w-[120px] px-3 py-2">
        <EditableCell
          value={receipt.date ?? ""}
          type="date"
          placeholder="-"
          onChange={handleDateSave}
        />
      </td>

      {/* Merchant */}
      <td className="min-w-[180px] px-3 py-2">
        <EditableCell
          value={receipt.merchant ?? ""}
          type="text"
          placeholder="-"
          onChange={handleMerchantSave}
        />
      </td>


      {/* Ammount */}
      <td className="min-w-[100px] px-3 py-2">
        <EditableCell
          value={receipt.amount?.toString() ?? ""}
          type="number"
          placeholder="-"
          onChange={handleAmountSave}
          className="text-right"
        />
      </td>

      {/* Currency */}
      <td className="w-fit">
        <span className="text-sm">{receipt.currency ?? "-"}</span>
      </td>

      {/* Validation */}
      <td className="min-w-[50px] px-3 py-2 text-center">
        {renderValidationColumn()}
      </td>

      {/* Actions */}
      <td className="min-w-[50px] px-3 py-2 text-center">
        <button
          onClick={handleRemoveClick}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="削除"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
