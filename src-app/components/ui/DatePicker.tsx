import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { parseDateParts, getCalendarDays, toIsoDateString } from "../../utils/dateUtils";

interface DatePickerProps {
  value: string;                                    // YYYY-MM-DD
  onSelect: (isoDate: string) => void;              // called when user selects a date
  onCancel: () => void;                             // called when user cancels (Escape, click outside)
  anchorRef: React.RefObject<HTMLDivElement | null>; // element to position relative to
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function getTodayIso(): string {
  const now = new Date();
  return toIsoDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function DatePicker({ value, onSelect, onCancel, anchorRef }: DatePickerProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  const todayIso = useMemo(() => getTodayIso(), []);
  const todayParts = parseDateParts(todayIso)!;

  // Initialize view from the value prop, falling back to today
  const initialParts = parseDateParts(value) ?? todayParts;
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);
  const [focusedIso, setFocusedIso] = useState(value || todayIso);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Navigate to the previous month
  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  // Navigate to the next month
  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  // Ensure the view month/year stays in sync when focusedIso crosses a month boundary
  const syncViewToDate = useCallback((iso: string) => {
    const parts = parseDateParts(iso);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, []);

  // Move the focused date by a given number of days
  const moveFocusedDate = useCallback(
    (days: number) => {
      const parts = parseDateParts(focusedIso);
      if (!parts) return;
      const d = new Date(parts.year, parts.month - 1, parts.day + days);
      const newIso = toIsoDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
      setFocusedIso(newIso);
      syncViewToDate(newIso);
    },
    [focusedIso, syncViewToDate],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveFocusedDate(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveFocusedDate(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocusedDate(-7);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveFocusedDate(7);
          break;
        case "Enter":
          e.preventDefault();
          onSelect(focusedIso);
          break;
        case "Escape":
          e.preventDefault();
          onCancel();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [moveFocusedDate, focusedIso, onSelect, onCancel]);

  // Click-outside handler
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onCancel, anchorRef]);

  // Compute popup position after DOM commit: prefer right side of anchor, fall back to left
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popupWidth = 280;
    const popupHeight = 320;

    // Horizontal: prefer right side of the cell
    let left = rect.right + 4;
    if (left + popupWidth > window.innerWidth - 8) {
      left = rect.left - popupWidth - 4;
    }
    left = Math.max(8, left);

    // Vertical: align top with the cell, adjust if overflowing
    let top = rect.top;
    if (top + popupHeight > window.innerHeight - 8) {
      top = window.innerHeight - popupHeight - 8;
    }
    top = Math.max(8, top);

    setPopupStyle({ position: "fixed", left, top });
  }, [anchorRef]);

  const getDayCellClass = useCallback(
    (isoString: string, isCurrentMonth: boolean): string => {
      const base = "w-9 h-9 flex items-center justify-center text-sm rounded-full cursor-pointer";
      const isSelected = isoString === value;
      const isToday = isoString === todayIso;
      const isFocused = isoString === focusedIso;

      if (isSelected) {
        return `${base} bg-blue-500 text-white font-medium hover:bg-blue-600`;
      }

      const classes: string[] = [base];

      if (isCurrentMonth) {
        classes.push("text-gray-800 hover:bg-gray-100");
      } else {
        classes.push("text-gray-300 hover:bg-gray-50");
      }

      if (isToday) {
        classes.push("ring-1 ring-blue-300");
      }

      if (isFocused) {
        classes.push("bg-blue-50");
      }

      return classes.join(" ");
    },
    [value, todayIso, focusedIso],
  );

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[280px]"
    >
      {/* Header: prev / label / next */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="p-1 rounded hover:bg-gray-100 text-gray-600"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-800">
          {viewYear}年{String(viewMonth).padStart(2, "0")}月
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 rounded hover:bg-gray-100 text-gray-600"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="w-9 h-7 flex items-center justify-center text-xs text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => (
          <div
            key={day.isoString}
            onClick={() => onSelect(day.isoString)}
            className={getDayCellClass(day.isoString, day.isCurrentMonth)}
          >
            {day.date}
          </div>
        ))}
      </div>

      {/* Cancel button */}
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
