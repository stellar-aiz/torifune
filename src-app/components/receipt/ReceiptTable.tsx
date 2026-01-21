import { ReceiptTableRow } from "./ReceiptTableRow";
import type { ReceiptData, SortConfig, SortField } from "../../types/receipt";

interface ReceiptTableProps {
  receipts: ReceiptData[];
  yearMonth: string;
  onRemove: (id: string) => void;
  onUpdateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
  sortConfig: SortConfig;
  onToggleSort: (field: SortField) => void;
}

export function ReceiptTable({
  receipts,
  yearMonth,
  onRemove,
  onUpdateReceipt,
  sortConfig,
  onToggleSort,
}: ReceiptTableProps) {
  function SortIndicator({ field }: { field: SortField }): React.ReactElement {
    if (sortConfig.field !== field) {
      return <span className="ml-1 text-gray-300">⇅</span>;
    }
    return (
      <span className="ml-1 text-blue-600">
        {sortConfig.order === "asc" ? "↓" : "↑"}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[750px]">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
            <th className="min-w-[200px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              ファイル名
            </th>
            <th className="min-w-[50px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              サムネイル
            </th>
            <th
              className="min-w-[120px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => onToggleSort("date")}
            >
              日付
              <SortIndicator field="date" />
            </th>
            <th
              className="min-w-[180px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => onToggleSort("merchant")}
            >
              店舗
              <SortIndicator field="merchant" />
            </th>
            <th
              className="min-w-[100px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => onToggleSort("total")}
            >
              合計
              <SortIndicator field="total" />
            </th>
            <th className="min-w-[50px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              検証
            </th>
            <th className="min-w-[50px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <ReceiptTableRow
              key={receipt.id}
              receipt={receipt}
              yearMonth={yearMonth}
              onRemove={() => onRemove(receipt.id)}
              onUpdate={(updates) => onUpdateReceipt(receipt.id, updates)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
