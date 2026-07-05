import { describe, it, expect } from "vitest";
import { normalizeOcrResultData } from "./ocrResult";
import type { OcrResult } from "../types/receipt";

/**
 * Rust側の Option<T> は JSON シリアライズ時に null になるが、
 * OcrResult["data"] の型定義上はあくまで省略可能（T | undefined）としか
 * 表現されていない。実行時には null が渡り得るため、テストでは
 * その実態を再現するために unknown 経由でキャストする。
 */
function asOcrData(
  value: Record<string, unknown>,
): NonNullable<OcrResult["data"]> {
  return value as unknown as NonNullable<OcrResult["data"]>;
}

describe("normalizeOcrResultData", () => {
  it("converts all-null fields (fully-failed OCR extraction) to undefined", () => {
    const input = asOcrData({
      file: "receipt.jpg",
      merchant: null,
      date: null,
      amount: null,
      currency: null,
      receiverName: null,
    });

    const result = normalizeOcrResultData(input);

    expect(result.merchant).toBeUndefined();
    expect(result.date).toBeUndefined();
    expect(result.amount).toBeUndefined();
    expect(result.currency).toBeUndefined();
    expect(result.receiverName).toBeUndefined();
  });

  it("preserves real values as-is, including amount: 0", () => {
    const input = asOcrData({
      file: "receipt.jpg",
      merchant: "セブンイレブン",
      date: "2026-01-15",
      amount: 0,
      currency: "JPY",
      receiverName: "山田太郎",
    });

    const result = normalizeOcrResultData(input);

    expect(result).toEqual({
      merchant: "セブンイレブン",
      date: "2026-01-15",
      amount: 0,
      currency: "JPY",
      receiverName: "山田太郎",
    });
    expect(result.amount).toBe(0);
  });

  it("normalizes each field independently in a mix of real values and nulls", () => {
    const input = asOcrData({
      file: "receipt.jpg",
      merchant: "スターバックス",
      date: null,
      amount: 500,
      currency: null,
      receiverName: null,
    });

    const result = normalizeOcrResultData(input);

    expect(result.merchant).toBe("スターバックス");
    expect(result.date).toBeUndefined();
    expect(result.amount).toBe(500);
    expect(result.currency).toBeUndefined();
    expect(result.receiverName).toBeUndefined();
  });
});
