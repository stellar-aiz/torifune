/**
 * OCR結果の正規化
 */

import type { OcrResult, ReceiptData } from "../types/receipt";

/** OCR結果データのうちレシートへマージ可能なフィールドのみ */
export type NormalizedOcrData = Pick<
  ReceiptData,
  "merchant" | "date" | "amount" | "currency" | "receiverName"
>;

/**
 * OCR結果（Tauri IPC経由でRustのOption<T>がJSON null化されたもの）を
 * レシートのフィールドとして安全にマージできる形に正規化する。
 * null は undefined に変換し、0 のような falsy だが正当な値は保持する。
 */
export function normalizeOcrResultData(
  data: NonNullable<OcrResult["data"]>,
): NormalizedOcrData {
  return {
    merchant: data.merchant ?? undefined,
    date: data.date ?? undefined,
    amount: data.amount ?? undefined,
    currency: data.currency ?? undefined,
    receiverName: data.receiverName ?? undefined,
  };
}
