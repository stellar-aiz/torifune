import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiChevronRight, FiChevronDown, FiFile, FiShoppingBag, FiUser, FiEdit2 } from "react-icons/fi";
import { ReceiptTableRow } from "./ReceiptTableRow";
import { useReceiverNameHistoryStore } from "../../hooks/useReceiverNameHistoryStore";
import type { ReceiptData, SortConfig, SortField } from "../../types/receipt";

interface ReceiptTableProps {
  receipts: ReceiptData[];
  yearMonth: string;
  onRemove: (id: string) => void;
  onUpdateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
  onBulkUpdateReceiverName?: (name: string) => void;
  sortConfig: SortConfig;
  onToggleSort: (field: SortField) => void;
}

export function ReceiptTable({
  receipts,
  yearMonth,
  onRemove,
  onUpdateReceipt,
  onBulkUpdateReceiverName,
  sortConfig,
  onToggleSort,
}: ReceiptTableProps) {
  const [isFilenameColumnCollapsed, setIsFilenameColumnCollapsed] = useState(true);
  const [isMerchantColumnCollapsed, setIsMerchantColumnCollapsed] = useState(false);
  const [isReceiverNameColumnCollapsed, setIsReceiverNameColumnCollapsed] = useState(false);
  const [isBulkReceiverNameOpen, setIsBulkReceiverNameOpen] = useState(false);
  const [bulkHighlightedIndex, setBulkHighlightedIndex] = useState(-1);
  const bulkDropdownRef = useRef<HTMLDivElement>(null);
  const bulkTriggerRef = useRef<HTMLButtonElement>(null);
  const receiverNameHistoryStore = useReceiverNameHistoryStore();

  // 一括入力用の選択肢
  const bulkReceiverNameOptions = ["", ...receiverNameHistoryStore.names, "その他（手入力）"];

  // 一括入力ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    if (!isBulkReceiverNameOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        bulkTriggerRef.current && !bulkTriggerRef.current.contains(e.target as Node) &&
        bulkDropdownRef.current && !bulkDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBulkReceiverNameOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isBulkReceiverNameOpen]);

  // 一括入力の選択肢をクリック
  const handleBulkReceiverNameSelect = (option: string) => {
    setIsBulkReceiverNameOpen(false);
    if (option === "その他（手入力）") {
      const customName = window.prompt("宛名を入力してください");
      if (customName && customName.trim()) {
        onBulkUpdateReceiverName?.(customName.trim());
        receiverNameHistoryStore.addName(customName.trim());
      }
    } else if (option !== "") {
      onBulkUpdateReceiverName?.(option);
    }
  };

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
              className={`${isReceiverNameColumnCollapsed ? "w-[40px]" : "min-w-[100px]"} px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-100 z-10 transition-all duration-200`}
            >
              <div className="flex items-center gap-1">
                <div
                  className="flex items-center gap-1 cursor-pointer hover:bg-gray-200 rounded px-1 select-none"
                  onClick={() => setIsReceiverNameColumnCollapsed(!isReceiverNameColumnCollapsed)}
                >
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
                {!isReceiverNameColumnCollapsed && onBulkUpdateReceiverName && (
                  <div className="relative">
                    <button
                      ref={bulkTriggerRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBulkReceiverNameOpen(!isBulkReceiverNameOpen);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="宛名を一括入力"
                    >
                      <FiEdit2 className="w-3 h-3" />
                    </button>
                    {isBulkReceiverNameOpen && bulkTriggerRef.current && createPortal(
                      <div
                        ref={bulkDropdownRef}
                        style={{
                          position: "fixed",
                          left: bulkTriggerRef.current.getBoundingClientRect().left,
                          top: bulkTriggerRef.current.getBoundingClientRect().bottom + 4,
                          zIndex: 9999,
                        }}
                        className="bg-white border border-gray-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto py-1 min-w-[160px]"
                      >
                        {bulkReceiverNameOptions.map((option, index) => (
                          <div
                            key={index}
                            onClick={() => handleBulkReceiverNameSelect(option)}
                            onMouseEnter={() => setBulkHighlightedIndex(index)}
                            className={`px-3 py-1.5 text-sm cursor-pointer ${
                              bulkHighlightedIndex === index
                                ? "bg-gray-100 text-gray-800"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {option || "選択なし"}
                          </div>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
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
