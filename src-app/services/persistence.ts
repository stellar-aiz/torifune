/**
 * 永続化サービス
 * 申請データのファイルシステムへの保存・読み込みを担当
 */

import { nanoid } from "nanoid";
import type { ApplicationMonth, ReceiptData } from "../types/receipt";
import {
  listMonthDirectories,
  listFilesInDirectory,
  ensureMonthDirectory,
  readThumbnail,
} from "./tauri/commands";
import {
  loadReceiptsFromExcel,
  saveReceiptsToExcel,
} from "./excel/exporter";

/**
 * ディレクトリをスキャンして既存の申請月を読み込む（遅延読み込み）
 */
export async function loadApplicationMonths(): Promise<ApplicationMonth[]> {
  const directories = await listMonthDirectories();
  const months: ApplicationMonth[] = [];

  for (const dir of directories) {
    months.push({
      id: nanoid(6),
      yearMonth: dir.yearMonth,
      receipts: [],
      directoryPath: dir.path,
      isLoaded: false,
    });
  }

  return months;
}

/**
 * 申請月のレシートを読み込む（遅延読み込み用）
 */
export async function loadApplicationMonthReceipts(
  yearMonth: string,
  directoryPath: string
): Promise<ReceiptData[]> {
  // まずExcelから読み込みを試みる（directoryPathを渡して壊れたパスを復元）
  const excelReceipts = await loadReceiptsFromExcel(yearMonth, directoryPath);

  if (excelReceipts && excelReceipts.length > 0) {
    // Excelからデータが読み込めた場合、サムネイルを読み込む
    const receiptsWithThumbnails = await Promise.all(
      excelReceipts.map(async (receipt) => {
        const thumbnailDataUrl = await loadThumbnail(yearMonth, receipt.file);
        return { ...receipt, thumbnailDataUrl };
      })
    );
    return receiptsWithThumbnails;
  }

  // Excelがない場合はディレクトリをスキャンしてpendingレシートを作成
  const files = await listFilesInDirectory(directoryPath);

  const receipts: ReceiptData[] = await Promise.all(
    files.map(async (file) => {
      const thumbnailDataUrl = await loadThumbnail(yearMonth, file.name);
      return {
        id: nanoid(6),
        file: file.name,
        filePath: file.path,
        status: "pending" as const,
        thumbnailDataUrl,
      };
    })
  );

  return receipts;
}

/**
 * サムネイルを読み込む
 */
async function loadThumbnail(
  yearMonth: string,
  fileName: string
): Promise<string | undefined> {
  try {
    const thumbnail = await readThumbnail(yearMonth, fileName);
    return thumbnail ?? undefined;
  } catch (error) {
    console.warn("Failed to read thumbnail:", error);
    return undefined;
  }
}

/**
 * 申請月のデータをExcelとして保存
 */
export async function saveApplicationMonth(
  month: ApplicationMonth
): Promise<void> {
  // ディレクトリを確保
  await ensureMonthDirectory(month.yearMonth);

  // Excelに保存
  await saveReceiptsToExcel(month.receipts, month.yearMonth);
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
    isLoaded: true,
  };
}
