import { FiPlus, FiSettings, FiCalendar, FiTrash2 } from "react-icons/fi";
import type { ApplicationMonth } from "../../types/receipt";
import { formatMonthName } from "../../types/receipt";

interface SidebarProps {
  months: ApplicationMonth[];
  currentMonthId: string | null;
  onSelectMonth: (monthId: string) => void;
  onCreateMonth: () => void;
  onDeleteMonth: (monthId: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  months,
  currentMonthId,
  onSelectMonth,
  onCreateMonth,
  onDeleteMonth,
  onOpenSettings,
}: SidebarProps) {
  // 申請月を降順（新しい月が上）でソート
  const sortedMonths = [...months].sort((a, b) =>
    b.yearMonth.localeCompare(a.yearMonth)
  );

  return (
    <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col h-full">
      {/* ロゴ・タイトル */}
      <div className="px-4 py-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Torifune</h1>
        <p className="text-xs text-gray-400 mt-0.5">Receipt Analyzer</p>
      </div>

      {/* 新規申請ボタン */}
      <div className="px-3 py-3">
        <button
          onClick={onCreateMonth}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          新規申請月
        </button>
      </div>

      {/* 申請月一覧 */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="py-2">
          <h2 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            申請月一覧
          </h2>
          {sortedMonths.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-500 text-center">
              申請月がありません
            </p>
          ) : (
            <ul className="space-y-1 mt-1">
              {sortedMonths.map((month) => {
                const isActive = month.id === currentMonthId;
                const receiptCount = month.receipts.length;
                const successCount = month.receipts.filter(
                  (r) => r.status === "success"
                ).length;

                return (
                  <li key={month.id} className="group relative">
                    <button
                      onClick={() => onSelectMonth(month.id)}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                        ${isActive
                          ? "bg-gray-700 text-white"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                    >
                      <FiCalendar className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {formatMonthName(month.yearMonth)}
                      </span>
                      {receiptCount > 0 && (
                        <span
                          className={`
                            text-xs px-1.5 py-0.5 rounded-full
                            ${isActive ? "bg-gray-600" : "bg-gray-700"}
                          `}
                        >
                          {successCount}/{receiptCount}
                        </span>
                      )}
                    </button>
                    {/* 削除ボタン（ホバー時に表示） */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMonth(month.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 設定ボタン（下部） */}
      <div className="px-3 py-3 border-t border-gray-700">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg text-sm transition-colors"
        >
          <FiSettings className="w-4 h-4" />
          設定
        </button>
      </div>
    </aside>
  );
}
