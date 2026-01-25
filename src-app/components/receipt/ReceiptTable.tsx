import { useState } from "react";
import { FiChevronRight, FiChevronDown, FiFile, FiShoppingBag, FiUser } from "react-icons/fi";
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
  const [isFilenameColumnCollapsed, setIsFilenameColumnCollapsed] = useState(true);
  const [isMerchantColumnCollapsed, setIsMerchantColumnCollapsed] = useState(false);
  const [isReceiverNameColumnCollapsed, setIsReceiverNameColumnCollapsed] = useState(false);

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
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
            <th
              className={`${isFilenameColumnCollapsed ? "w-[40px]" : "min-w-[160px]"} px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none transition-all duration-200`}
              onClick={() => setIsFilenameColumnCollapsed(!isFilenameColumnCollapsed)}
            >
              <div className="flex items-center gap-1">
                {isFilenameColumnCollapsed ? (
                  <>
                    <FiChevronRight className="w-3 h-3" />
                    <FiFile className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <FiChevronDown className="w-3 h-3" />
                    <span>ファイル名</span>
                  </>
                )}
              </div>
            </th>
            <th className="w-fit px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              {/* サムネイル */}
            </th>
            <th
              className="min-w-[100px] px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => onToggleSort("date")}
            >
              日付
              <SortIndicator field="date" />
            </th>
            <th
              className={`${isMerchantColumnCollapsed ? "w-[40px]" : "min-w-[140px]"} px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none transition-all duration-200`}
              onClick={() => setIsMerchantColumnCollapsed(!isMerchantColumnCollapsed)}
            >
              <div className="flex items-center gap-1">
                {isMerchantColumnCollapsed ? (
                  <>
                    <FiChevronRight className="w-3 h-3" />
                    <FiShoppingBag className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <FiChevronDown className="w-3 h-3" />
                    <span>店舗</span>
                  </>
                )}
              </div>
            </th>
            <th
              className={`${isReceiverNameColumnCollapsed ? "w-[40px]" : "min-w-[100px]"} px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none transition-all duration-200`}
              onClick={() => setIsReceiverNameColumnCollapsed(!isReceiverNameColumnCollapsed)}
            >
              <div className="flex items-center gap-1">
                {isReceiverNameColumnCollapsed ? (
                  <>
                    <FiChevronRight className="w-3 h-3" />
                    <FiUser className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <FiChevronDown className="w-3 h-3" />
                    <span>宛名</span>
                  </>
                )}
              </div>
            </th>
            <th
              className="min-w-[80px] px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => onToggleSort("amount")}
            >
              金額
              <SortIndicator field="amount" />
            </th>
            <th className="w-fit px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              {/* 単位 */}
            </th>
            <th className="min-w-[100px] px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              勘定科目
            </th>
            <th className="min-w-[120px] px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              備考
            </th>
            <th className="min-w-[40px] px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              検証
            </th>
            <th className="min-w-[40px] px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
              {/* 操作 */}
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
              isFilenameCollapsed={isFilenameColumnCollapsed}
              isMerchantCollapsed={isMerchantColumnCollapsed}
              isReceiverNameCollapsed={isReceiverNameColumnCollapsed}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-200">
            <td colSpan={11} className="px-2 py-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>合計: {receipts.length}件</span>
                <span>
                  ¥{receipts.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
