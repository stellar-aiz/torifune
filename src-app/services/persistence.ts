/**
 * 永続化サービス
 * 申請データのファイルシステムへの保存・読み込みを担当
 */

import { nanoid } from "nanoid";
import type { ApplicationMonth, ReceiptData } from "../types/receipt";
import {
  listMonthDirectories,
  readSummaryJson,
  writeSummaryJson,
  listFilesInDirectory,
  ensureMonthDirectory,
  readThumbnail,
} from "./tauri/commands";

/** サマリーJSONの構造 */
export interface SummaryJson {
  yearMonth: string;
  generatedAt: string;
  receipts: SummaryReceipt[];
  summary: {
    totalAmount: number;
    receiptCount: number;
    successCount: number;
    errorCount: number;
  };
}

/** サマリー内のレシート情報 */
export interface SummaryReceipt {
  file: string;
  merchant?: string;
  date?: string;
  total?: number;
  issues?: Array<{
    field: string;
    type: string;
    severity: string;
    message: string;
  }>;
}

/**
 * ディレクトリをスキャンして既存の申請月を読み込む
 */
export async function loadApplicationMonths(): Promise<ApplicationMonth[]> {
  const directories = await listMonthDirectories();
  const months: ApplicationMonth[] = [];

  for (const dir of directories) {
    try {
      const month = await loadApplicationMonth(dir.yearMonth, dir.path);
      if (month) {
        months.push(month);
      }
    } catch (error) {
      console.warn(`Failed to load month ${dir.yearMonth}:`, error);
      // エラーがあっても空のApplicationMonthとして追加
      months.push({
        id: nanoid(6),
        yearMonth: dir.yearMonth,
        receipts: [],
        directoryPath: dir.path,
      });
    }
  }

  return months;
}

/**
 * 単一の申請月を読み込む
 */
async function loadApplicationMonth(
  yearMonth: string,
  directoryPath: string
): Promise<ApplicationMonth | null> {
  // ディレクトリ内のファイルを取得
  const files = await listFilesInDirectory(directoryPath);

  // サマリーJSONを読み込み（存在する場合）
  let summaryData: SummaryJson | null = null;
  try {
    const jsonContent = await readSummaryJson(yearMonth);
    summaryData = JSON.parse(jsonContent) as SummaryJson;
  } catch {
    // サマリーがない場合は無視
  }

  // レシートデータを構築（サムネイルも読み込み）
  const receipts: ReceiptData[] = await Promise.all(
    files.map(async (file) => {
      // サマリーから既存データを探す
      const existingReceipt = summaryData?.receipts.find(
        (r) => r.file === file.name
      );

      // サムネイルを読み込み
      let thumbnailDataUrl: string | undefined;
      try {
        const thumbnail = await readThumbnail(yearMonth, file.name);
        if (thumbnail) {
          thumbnailDataUrl = thumbnail;
        }
      } catch (error) {
        console.warn("Failed to read thumbnail:", error);
      }

      return {
        id: nanoid(6),
        file: file.name,
        filePath: file.path,
        merchant: existingReceipt?.merchant,
        date: existingReceipt?.date,
        total: existingReceipt?.total,
        issues: existingReceipt?.issues?.map((issue) => ({
          field: issue.field as "date" | "total" | "merchant",
          type: issue.type as "format" | "range" | "outlier",
          severity: issue.severity as "warning" | "error",
          message: issue.message,
        })),
        status: existingReceipt ? "success" : "pending",
        thumbnailDataUrl,
      };
    })
  );

  return {
    id: nanoid(6),
    yearMonth,
    receipts,
    directoryPath,
  };
}

/**
 * 申請月のデータをJSONとして保存
 */
export async function saveApplicationMonth(
  month: ApplicationMonth
): Promise<string> {
  // ディレクトリを確保
  await ensureMonthDirectory(month.yearMonth);

  // サマリーデータを構築
  const summary: SummaryJson = {
    yearMonth: month.yearMonth,
    generatedAt: new Date().toISOString(),
    receipts: month.receipts.map((r) => ({
      file: r.file,
      merchant: r.merchant,
      date: r.date,
      total: r.total,
      issues: r.issues?.map((issue) => ({
        field: issue.field,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
      })),
    })),
    summary: {
      totalAmount: month.receipts.reduce((sum, r) => sum + (r.total || 0), 0),
      receiptCount: month.receipts.length,
      successCount: month.receipts.filter((r) => r.status === "success").length,
      errorCount: month.receipts.filter((r) => r.status === "error").length,
    },
  };

  const jsonContent = JSON.stringify(summary, null, 2);
  const filePath = await writeSummaryJson(month.yearMonth, jsonContent);

  return filePath;
}

/**
 * 新規申請月を作成（ディレクトリも作成）
 */
export async function createNewApplicationMonth(
  yearMonth: string
): Promise<ApplicationMonth> {
  const directoryPath = await ensureMonthDirectory(yearMonth);

  return {
    id: nanoid(6),
    yearMonth,
    receipts: [],
    directoryPath,
  };
}
