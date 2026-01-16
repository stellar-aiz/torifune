/**
 * レシート関連の型定義
 */

/** バリデーションイシュー */
export interface ValidationIssue {
  field: "date" | "total" | "merchant";
  type: "format" | "range" | "outlier";
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
  total?: number;
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
    total?: number;
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
