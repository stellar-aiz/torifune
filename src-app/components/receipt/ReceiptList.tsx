import type { ReceiptData, SortConfig, SortField } from "../../types/receipt";
import { ReceiptTable } from "./ReceiptTable";

interface ReceiptListProps {
  receipts: ReceiptData[];
  yearMonth: string;
  sortConfig: SortConfig;
  onRemove: (id: string) => void;
  onUpdateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
  onBulkUpdateReceiverName?: (name: string) => void;
  onToggleSort: (field: SortField) => void;
}

export function ReceiptList({
  receipts,
  yearMonth,
  sortConfig,
  onRemove,
  onUpdateReceipt,
  onBulkUpdateReceiverName,
  onToggleSort,
}: ReceiptListProps) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
        <p className="text-sm">レシートファイルを追加してください</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ReceiptTable
        receipts={receipts}
        yearMonth={yearMonth}
        sortConfig={sortConfig}
        onRemove={onRemove}
        onUpdateReceipt={onUpdateReceipt}
        onBulkUpdateReceiverName={onBulkUpdateReceiverName}
        onToggleSort={onToggleSort}
      />
    </div>
  );
}
