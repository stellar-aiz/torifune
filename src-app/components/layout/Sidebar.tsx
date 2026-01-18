import { useState, useMemo, useEffect } from "react";
import {
  FiPlus,
  FiSettings,
  FiCalendar,
  FiTrash2,
  FiChevronRight,
  FiChevronDown,
} from "react-icons/fi";
import type { ApplicationMonth, YearGroup } from "../../types/receipt";
import { groupByYear } from "../../types/receipt";
import { CreateMonthModal } from "../month/CreateMonthModal";

interface SidebarProps {
  months: ApplicationMonth[];
  currentMonthId: string | null;
  onSelectMonth: (monthId: string) => void;
  onCreateMonth: (yearMonth: string) => void;
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
  // モーダル表示状態
  const [isCreateMonthModalOpen, setIsCreateMonthModalOpen] = useState(false);

  // 展開されている年を管理
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => {
    // 初期状態: 現在選択中の月がある年を展開
    const currentMonth = months.find((m) => m.id === currentMonthId);
    if (currentMonth) {
      return new Set([currentMonth.yearMonth.slice(0, 4)]);
    }
    // データがあれば最新の年を展開
    if (months.length > 0) {
      const sortedMonths = [...months].sort((a, b) =>
        b.yearMonth.localeCompare(a.yearMonth)
      );
      return new Set([sortedMonths[0].yearMonth.slice(0, 4)]);
    }
    return new Set();
  });

  // 選択された月の年を自動展開
  useEffect(() => {
    const currentMonth = months.find((m) => m.id === currentMonthId);
    if (currentMonth) {
      const year = currentMonth.yearMonth.slice(0, 4);
      setExpandedYears((prev) => {
        if (prev.has(year)) return prev;
        return new Set([...prev, year]);
      });
    }
  }, [currentMonthId, months]);

  // 年グループに変換
  const yearGroups: YearGroup[] = useMemo(
    () => groupByYear(months, expandedYears),
    [months, expandedYears]
  );

  // 既存のyearMonthリストを計算
  const existingYearMonths = useMemo(
    () => months.map((m) => m.yearMonth),
    [months]
  );

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

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
          onClick={() => setIsCreateMonthModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent hover:bg-blue-600 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          新規申請月
        </button>
      </div>

      {/* 申請月一覧（ネスト形式） */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="py-2">
          <h2 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            申請月一覧
          </h2>
          {yearGroups.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-500 text-center">
              申請月がありません
            </p>
          ) : (
            <ul className="space-y-1 mt-1">
              {yearGroups.map((yearGroup) => (
                <li key={yearGroup.year}>
                  {/* 年ヘッダー */}
                  <button
                    onClick={() => toggleYear(yearGroup.year)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    {yearGroup.isExpanded ? (
                      <FiChevronDown className="w-4 h-4" />
                    ) : (
                      <FiChevronRight className="w-4 h-4" />
                    )}
                    <span>{yearGroup.year}年</span>
                    <span className="text-xs text-gray-500">
                      ({yearGroup.months.length})
                    </span>
                  </button>

                  {/* 月リスト（展開時のみ表示） */}
                  {yearGroup.isExpanded && (
                    <ul className="ml-4 space-y-0.5">
                      {yearGroup.months.map((monthItem) => {
                        const isActive = monthItem.monthId === currentMonthId;

                        return (
                          <li key={monthItem.monthId} className="group relative">
                            <button
                              onClick={() => onSelectMonth(monthItem.monthId)}
                              className={`
                                w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                                ${
                                  isActive
                                    ? "bg-yellow-500/20 text-yellow-300 font-medium"
                                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                                }
                              `}
                            >
                              <FiCalendar className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="flex-1 text-left">
                                {monthItem.month}月
                              </span>
                              {monthItem.receiptCount > 0 && (
                                <span
                                  className={`
                                    text-xs px-1.5 py-0.5 rounded-full
                                    ${isActive ? "bg-yellow-500/30 text-yellow-200" : "bg-gray-700"}
                                  `}
                                >
                                  {monthItem.successCount}/{monthItem.receiptCount}
                                </span>
                              )}
                            </button>
                            {/* 削除ボタン（ホバー時に表示） */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteMonth(monthItem.monthId);
                              }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="削除"
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
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

      {/* 新規申請月作成モーダル */}
      <CreateMonthModal
        isOpen={isCreateMonthModalOpen}
        onClose={() => setIsCreateMonthModalOpen(false)}
        onCreateMonth={onCreateMonth}
        existingYearMonths={existingYearMonths}
      />
    </aside>
  );
}
