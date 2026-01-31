import { useState, useEffect } from "react";
import { FiX, FiChevronDown, FiCalendar } from "react-icons/fi";

interface CreateMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMonth: (yearMonth: string) => void;
  existingYearMonths: string[]; // YYYYMM format list for duplicate check
}

export function CreateMonthModal({
  isOpen,
  onClose,
  onCreateMonth,
  existingYearMonths,
}: CreateMonthModalProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  const [selectedYear, setSelectedYear] = useState<string>(
    currentYear.toString(),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    currentMonth.toString(),
  );

  // Reset to current year/month when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedYear(currentYear.toString());
      setSelectedMonth(currentMonth.toString());
    }
  }, [isOpen, currentYear, currentMonth]);

  // Generate year options: current year - 2 to current year + 1
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  // Generate month options: 1 to 12
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // Format selected year and month as YYYYMM
  const formatYearMonth = (): string => {
    const month = selectedMonth.padStart(2, "0");
    return `${selectedYear}${month}`;
  };

  // Check if the selected year/month already exists
  const yearMonthExists = existingYearMonths.includes(formatYearMonth());

  const handleSubmit = () => {
    const yearMonth = formatYearMonth();
    onCreateMonth(yearMonth);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        style={{
          animation: "modalSlideIn 0.2s ease-out",
        }}
      >
        <style>{`
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
          >
            <FiX className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FiCalendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                新規申請月
              </h2>
              <p className="text-sm text-gray-500">経費申請する月を選択</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          {/* Year and Month dropdowns - side by side */}
          <div className="flex gap-3">
            {/* Year dropdown */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                年
              </label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Month dropdown */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                月
              </label>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month.toString()}>
                      {month}月
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Warning message if year/month already exists */}
          {yearMonthExists && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200/50 rounded-xl">
              <p className="text-sm text-amber-700">
                この申請月は既に存在します。選択すると既存の月が開きます。
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
          >
            {yearMonthExists ? "選択" : "作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
