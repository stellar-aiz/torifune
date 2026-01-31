/**
 * OCR API
 * レシート画像のOCR処理に関するAPI呼び出しを担当
 */

import { post } from "./client";

/** OCR処理リクエストアイテム */
export interface OCRRequestItem {
  /** Base64エンコードされた画像データ */
  imageData: string;
  /** 画像のMIMEタイプ (例: "image/jpeg", "image/png") */
  mimeType: string;
}

/** OCR処理結果 */
export interface OCRResult {
  /** 抽出された日付 (YYYY-MM-DD形式、抽出失敗時はnull) */
  date: string | null;
  /** 抽出された金額 (抽出失敗時はnull) */
  amount: number | null;
  /** 抽出された発行者名 (抽出失敗時はnull) */
  issuer: string | null;
  /** 抽出された摘要・内容 (抽出失敗時はnull) */
  description: string | null;
  /** 抽出の信頼度スコア (0-1) */
  confidence: number;
  /** 処理中にエラーがあった場合のメッセージ */
  error?: string;
}

/** 単一OCR処理レスポンス */
export interface ProcessOCRResponse {
  /** OCR処理結果 */
  result: OCRResult;
}

/** バッチOCR処理レスポンス */
export interface ProcessBatchOCRResponse {
  /** 各画像のOCR処理結果 */
  results: OCRResult[];
}

/**
 * 単一画像のOCR処理を実行
 * @param imageData - Base64エンコードされた画像データ
 * @param mimeType - 画像のMIMEタイプ
 */
export async function processOCR(
  imageData: string,
  mimeType: string,
): Promise<ProcessOCRResponse> {
  return post<ProcessOCRResponse>("/api/v1/ocr/process", {
    imageData,
    mimeType,
  });
}

/**
 * 複数画像のバッチOCR処理を実行
 * @param items - 処理する画像のリスト
 */
export async function processBatchOCR(
  items: OCRRequestItem[],
): Promise<ProcessBatchOCRResponse> {
  return post<ProcessBatchOCRResponse>("/api/v1/ocr/batch", {
    items,
  });
}
