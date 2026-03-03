/** Calendar day cell representation */
export interface CalendarDay {
  date: number;          // day of month (1-31)
  month: number;         // 1-based month (1-12)
  year: number;
  isCurrentMonth: boolean;
  isoString: string;     // "YYYY-MM-DD"
}

/** Convert "2025-01-15" to "2025/01/15" for display */
export function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  return isoDate.replace(/-/g, "/");
}

/** Parse "YYYY-MM-DD" into parts. Returns null if invalid. */
export function parseDateParts(isoDate: string): {
  year: number;
  month: number;  // 1-based
  day: number;
} | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

/** Format parts back to ISO string with zero-padding */
export function toIsoDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Generate calendar grid for a given year/month (1-based month).
 *  Returns a flat array of days including leading/trailing days from adjacent months,
 *  with total length being a multiple of 7 (complete weeks). */
export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month - 1, 1);
  const startDayOfWeek = firstDay.getDay(); // 0=Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const days: CalendarDay[] = [];

  // Leading days from previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    days.push({
      date: d, month: prevMonth, year: prevYear,
      isCurrentMonth: false,
      isoString: toIsoDateString(prevYear, prevMonth, d),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: d, month, year,
      isCurrentMonth: true,
      isoString: toIsoDateString(year, month, d),
    });
  }

  // Trailing days to fill complete weeks
  const totalCells = Math.ceil(days.length / 7) * 7;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let trailingDay = 1;
  while (days.length < totalCells) {
    days.push({
      date: trailingDay, month: nextMonth, year: nextYear,
      isCurrentMonth: false,
      isoString: toIsoDateString(nextYear, nextMonth, trailingDay),
    });
    trailingDay++;
  }

  return days;
}
