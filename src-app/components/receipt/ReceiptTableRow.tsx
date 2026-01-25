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
import { ACCOUNT_CATEGORIES } from "../../constants/accountCategories";
import { generateThumbnail } from "../../services/pdf/pdfExtractor";
import { saveThumbnail } from "../../services/tauri/commands";

interface ReceiptTableRowProps {
  receipt: ReceiptData;
  yearMonth: string;
  onRemove: () => void;
  onUpdate: (updates: Partial<ReceiptData>) => void;
  isFilenameCollapsed: boolean;
  isMerchantCollapsed: boolean;
  isReceiverNameCollapsed: boolean;
}

export function ReceiptTableRow({
  receipt,
  yearMonth,
  onRemove,
  onUpdate,
  isFilenameCollapsed,
  isMerchantCollapsed,
  isReceiverNameCollapsed,
}: ReceiptTableRowProps) {
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

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

  function getStatusIcon(): React.ReactElement {
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
  }

  // Validation helpers
  const hasIssues = receipt.issues && receipt.issues.length > 0;
  const hasErrors = receipt.issues?.some((i) => i.severity === "error");
  const hasWarnings = receipt.issues?.some((i) => i.severity === "warning");

  // Field update handler
  function handleFieldChange(field: keyof ReceiptData, newValue: string): void {
    if (field === "amount") {
      onUpdate({ amount: newValue ? parseFloat(newValue) : undefined });
    } else {
      onUpdate({ [field]: newValue || undefined });
    }
  }

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

  function renderValidationColumn(): React.ReactElement {
    if (!hasIssues) {
      return <FiCheckCircle className="w-4 h-4 text-green-500 m-auto" />;
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
  }

  // Row background based on validation severity
  const rowBgClass = hasErrors ? "bg-red-50" : hasWarnings ? "bg-yellow-50" : "";

  return (
    <tr
      className={`
        border-b border-gray-200 hover:bg-gray-50 transition-colors
        ${rowBgClass}
      `}
    >
      {/* Filename */}
      <td
        className={`${isFilenameCollapsed ? "w-[40px]" : "min-w-[160px]"} px-2 py-1.5 transition-all duration-200`}
        title={receipt.file}
      >
        {isFilenameCollapsed ? (
          <div className="flex items-center justify-center">
            {getStatusIcon()}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm text-gray-800 truncate">
              {receipt.file}
            </span>
          </div>
        )}
      </td>

      {/* Thumbnail */}
      <td className="w-fit px-2 py-1.5">
        <ThumbnailPreview
          src={receipt.thumbnailDataUrl}
          alt={receipt.file}
          isLoading={isGeneratingThumbnail}
          size={36}
          filePath={receipt.filePath}
        />
      </td>

      {/* Date */}
      <td className="min-w-[100px] px-2 py-1.5">
        <EditableCell
          value={receipt.date ?? ""}
          type="date"
          placeholder="-"
          onChange={(v) => handleFieldChange("date", v)}
          className="hover:bg-yellow-50"
        />
      </td>

      {/* Merchant */}
      <td
        className={`${isMerchantCollapsed ? "w-[40px]" : "min-w-[140px]"} px-2 py-1.5 transition-all duration-200`}
        title={receipt.merchant ?? ""}
      >
        {isMerchantCollapsed ? (
          <div className="text-sm text-gray-600 truncate text-center">
            {receipt.merchant ? receipt.merchant.substring(0, 2) : "-"}
          </div>
        ) : (
          <EditableCell
            value={receipt.merchant ?? ""}
            type="text"
            placeholder="-"
            onChange={(v) => handleFieldChange("merchant", v)}
            className="hover:bg-yellow-50"
          />
        )}
      </td>

      {/* Receiver Name */}
      <td
        className={`${isReceiverNameCollapsed ? "w-[40px]" : "min-w-[100px]"} px-2 py-1.5 transition-all duration-200`}
        title={receipt.receiverName ?? ""}
      >
        {isReceiverNameCollapsed ? (
          <div className="text-sm text-gray-600 truncate text-center">
            {receipt.receiverName ? receipt.receiverName.substring(0, 2) : "-"}
          </div>
        ) : (
          <EditableCell
            value={receipt.receiverName ?? ""}
            type="text"
            placeholder="宛名"
            onChange={(v) => handleFieldChange("receiverName", v)}
            className="hover:bg-yellow-50"
          />
        )}
      </td>

      {/* Amount */}
      <td className="min-w-[80px] px-2 py-1.5">
        <EditableCell
          value={receipt.amount?.toString() ?? ""}
          type="number"
          placeholder="-"
          onChange={(v) => handleFieldChange("amount", v)}
          className="text-right hover:bg-yellow-50"
        />
      </td>

      {/* Currency */}
      <td className="w-fit px-2 py-1.5">
        <span className={`text-xs text-left ${receipt.currency && receipt.currency !== "JPY" ? "text-red-500" : ""}`}>
          {receipt.currency ?? "-"}
        </span>
      </td>

      {/* Account Category */}
      <td className="min-w-[100px] px-2 py-1.5">
        <EditableCell
          value={receipt.accountCategory ?? ""}
          type="select"
          options={ACCOUNT_CATEGORIES}
          onChange={(v) => handleFieldChange("accountCategory", v)}
          className="hover:bg-yellow-50"
        />
      </td>

      {/* Note */}
      <td className="min-w-[120px] px-2 py-1.5">
        <EditableCell
          value={receipt.note ?? ""}
          type="text"
          placeholder="備考"
          onChange={(v) => handleFieldChange("note", v)}
          className="hover:bg-yellow-50"
        />
      </td>

      {/* Validation */}
      <td className="min-w-[40px] px-2 py-1.5 text-center">
        {renderValidationColumn()}
      </td>

      {/* Actions */}
      <td className="min-w-[40px] px-2 py-1.5 text-center">
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
