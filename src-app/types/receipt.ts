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

/** OCR設定 */
export interface OcrSettings {
  projectId?: string;
  location?: string;
  processorId?: string;
  serviceAccountJson?: string;
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
