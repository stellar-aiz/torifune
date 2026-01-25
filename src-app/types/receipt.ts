/**
 * レシート関連の型定義
 */

/** バリデーションイシュー */
export interface ValidationIssue {
  field: "date" | "amount" | "merchant" | "file" | "duplicate" | "note";
  type: "format" | "range" | "outlier" | "duplicate-file" | "duplicate-data" | "missing-field";
  severity: "warning" | "error";
  message: string;
}

/** レシートデータ */
export interface ReceiptData {
  id: string;
  file: string;
  filePath: string;
  merchant?: string;
  date?: string; // YYYY-MM-DD
  amount?: number;
  currency?: string; // "JPY", "USD" など
  receiverName?: string;
  accountCategory?: string;
  note?: string;
  issues?: ValidationIssue[];
  status: "pending" | "processing" | "success" | "error";
  errorMessage?: string;
  thumbnailDataUrl?: string;
}

/** 申請月 */
export interface ApplicationMonth {
  id: string; // short UUID (6桁)
  yearMonth: string; // "202501" 形式（ソート・表示用）
  receipts: ReceiptData[];
  directoryPath?: string; // 実際のディレクトリパス
  isLoaded?: boolean; // 遅延読み込み管理用
}

/** サイドバー用：月アイテム */
export interface MonthItem {
  month: string; // "01" 形式
  yearMonth: string; // "202401" 形式（ApplicationMonthへの参照キー）
  monthId: string; // ApplicationMonth.id
  receiptCount: number;
  successCount: number;
}

/** サイドバー用：年グループ */
export interface YearGroup {
  year: string; // "2024" 形式
  months: MonthItem[]; // 月一覧（降順ソート）
  isExpanded: boolean; // UI展開状態
}

/** 年月から表示名を生成 (YYYY年MM月、zero padding) */
export function formatMonthName(yearMonth: string): string {
  const year = yearMonth.slice(0, 4);
  const month = yearMonth.slice(4, 6);
  return `${year}年${month}月`;
}

/** 現在の年月を取得 (YYYYMM形式) */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/** OCRプロバイダ */
export type OcrProvider = "googledocumentai" | "veryfi";

/** OCR設定 */
export interface OcrSettings {
  provider?: OcrProvider;
  // Google Document AI
  projectId?: string;
  location?: string;
  processorId?: string;
  serviceAccountJson?: string;
  // Veryfi
  veryfiClientId?: string;
  veryfiClientSecret?: string;
  veryfiUsername?: string;
  veryfiApiKey?: string;
}

/** OCR結果 */
export interface OcrResult {
  success: boolean;
  data?: {
    file: string;
    merchant?: string;
    date?: string;
    amount?: number;
    currency?: string;
    receiverName?: string;
  };
  error?: string;
}

/** OCR進捗イベント */
export interface OcrProgressEvent {
  current: number;
  total: number;
  fileName: string;
  result?: OcrResult;
}

/** ディレクトリ検証結果 */
export interface DirectoryValidation {
  exists: boolean;
  isDirectory: boolean;
  isWritable: boolean;
}

/** ApplicationMonth[] から YearGroup[] への変換 */
export function groupByYear(
  months: ApplicationMonth[],
  expandedYears: Set<string> = new Set()
): YearGroup[] {
  const yearMap = new Map<string, MonthItem[]>();

  for (const m of months) {
    const year = m.yearMonth.slice(0, 4);
    const month = m.yearMonth.slice(4, 6);
    const successCount = m.receipts.filter((r) => r.status === "success").length;

    const item: MonthItem = {
      month,
      yearMonth: m.yearMonth,
      monthId: m.id,
      receiptCount: m.receipts.length,
      successCount,
    };

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    yearMap.get(year)!.push(item);
  }

  const result: YearGroup[] = [];
  for (const [year, items] of yearMap) {
    items.sort((a, b) => b.month.localeCompare(a.month)); // 降順
    result.push({
      year,
      months: items,
      isExpanded: expandedYears.has(year),
    });
  }

  result.sort((a, b) => b.year.localeCompare(a.year)); // 降順
  return result;
}

/** ソート可能なフィールド */
export type SortField = "date" | "amount" | "merchant";

/** ソート順序 */
export type SortOrder = "asc" | "desc";

/** ソート設定 */
export interface SortConfig {
  field: SortField | null;
  order: SortOrder;
}
