import type { ReceiptData } from "../../types/receipt";
import { ReceiptCard } from "./ReceiptCard";

interface ReceiptListProps {
  receipts: ReceiptData[];
  onRemove: (id: string) => void;
  onUpdateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
}

export function ReceiptList({ receipts, onRemove, onUpdateReceipt }: ReceiptListProps) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
        <p className="text-sm">レシートファイルを追加してください</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          onRemove={() => onRemove(receipt.id)}
          onUpdate={(updates) => onUpdateReceipt(receipt.id, updates)}
        />
      ))}
    </div>
  );
}
