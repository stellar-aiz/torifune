/**
 * Excelサマリー生成サービス
 * ExcelJS を使用してレシートデータをxlsxファイルに出力する
 */

import ExcelJS from "exceljs";
import {
  writeFile,
  readFile,
  exists,
  readDir,
  remove,
} from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { nanoid } from "nanoid";
import type { ReceiptData, ValidationIssue } from "../../types/receipt";
import {
  ExcelColumnLabel,
  getColumnIndex,
  generateSheetColumns,
} from "../../types/excel";
import { isPdf } from "../pdf/pdfExtractor";
import { getRootDirectory } from "../tauri/commands";

type SupportedImageExtension = "jpeg" | "png";

/** 合計行の A 列ラベル */
const TOTAL_ROW_LABEL = "合計金額";

/**
 * JPY 合計金額を計算する
 * - currency が undefined または "JPY" のレシートのみ集計対象
 * - amount が undefined の場合は 0 として扱う
 */
export function calculateJpyTotal(receipts: ReceiptData[]): number {
  return receipts.reduce((sum, r) => {
    if (r.currency && r.currency !== "JPY") return sum;
    return sum + (r.amount ?? 0);
  }, 0);
}

/**
 * ファイルパスから画像拡張子を取得
 */
function getImageExtension(
  filePath: string,
): SupportedImageExtension | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  return undefined;
}

/**
 * レシートを日付順（昇順）でソートする
 * 日付が undefined または空文字の場合は末尾に配置
 */
function sortReceiptsByDate(receipts: ReceiptData[]): ReceiptData[] {
  return [...receipts].sort((a, b) => {
    const dateA = a.date ?? "";
    const dateB = b.date ?? "";

    // 両方空の場合は元の順序を維持
    if (dateA === "" && dateB === "") return 0;
    // dateA が空なら末尾へ
    if (dateA === "") return 1;
    // dateB が空なら末尾へ
    if (dateB === "") return -1;

    // YYYY-MM-DD 形式は文字列比較で正しくソートできる
    return dateA.localeCompare(dateB);
  });
}

/** サマリー Excel ファイルの基本プレフィックス（"YYYYMM-summary"） */
function getSummaryFileNamePrefix(yearMonth: string): string {
  return `${yearMonth}-summary`;
}

/**
 * サマリー Excel が格納されるディレクトリのパスを返す
 * （${rootDir}/${year}/${month}）
 */
async function getSummaryDirectory(yearMonth: string): Promise<string> {
  const rootDir = await getRootDirectory();
  const year = yearMonth.slice(0, 4);
  const month = yearMonth.slice(4, 6);
  return `${rootDir}/${year}/${month}`;
}

/**
 * 合計金額入りのファイル名を生成する
 * 例: yearMonth="202603", jpyTotal=2100 → "202603-summary-2100円.xlsx"
 */
export function buildSummaryFileName(
  yearMonth: string,
  jpyTotal: number,
): string {
  return `${getSummaryFileNamePrefix(yearMonth)}-${jpyTotal}円.xlsx`;
}

/**
 * 新規保存用のフルパスを返す（合計金額入りファイル名）
 */
async function getNewSummaryPath(
  yearMonth: string,
  jpyTotal: number,
): Promise<string> {
  const dir = await getSummaryDirectory(yearMonth);
  return `${dir}/${buildSummaryFileName(yearMonth, jpyTotal)}`;
}

/**
 * 既存のサマリー Excel ファイルパスを検索する
 * - 新フォーマット (yearMonth-summary-XX,XXX円.xlsx) を優先
 * - 旧フォーマット (yearMonth-summary.xlsx) も後方互換でヒット
 * - 該当なしの場合は null を返す
 */
async function findExistingSummaryPath(
  yearMonth: string,
): Promise<string | null> {
  const dir = await getSummaryDirectory(yearMonth);
  if (!(await exists(dir))) return null;

  const entries = await readDir(dir);
  const prefix = getSummaryFileNamePrefix(yearMonth);

  const matches = entries
    .filter(
      (e) =>
        !e.isDirectory &&
        e.name.startsWith(prefix) &&
        e.name.endsWith(".xlsx"),
    )
    .map((e) => e.name);

  if (matches.length === 0) return null;

  // 新フォーマット（"円.xlsx" で終わる）を優先
  matches.sort((a, b) => {
    const aHasTotal = a.endsWith("円.xlsx");
    const bHasTotal = b.endsWith("円.xlsx");
    if (aHasTotal && !bHasTotal) return -1;
    if (!aHasTotal && bHasTotal) return 1;
    return 0;
  });

  return `${dir}/${matches[0]}`;
}

/**
 * 同月の既存サマリーファイルのうち、keepPath 以外をすべて削除する
 * - 旧フォーマット (yearMonth-summary.xlsx) も対象
 * - 同月で合計値が変わった結果生成された古い "円" 入りファイルも対象
 * - これにより 1 月 1 ファイルが保証される
 */
async function cleanupStaleSummaryFiles(
  yearMonth: string,
  keepPath: string,
): Promise<void> {
  const dir = await getSummaryDirectory(yearMonth);
  if (!(await exists(dir))) return;

  const entries = await readDir(dir);
  const prefix = getSummaryFileNamePrefix(yearMonth);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!entry.name.startsWith(prefix)) continue;
    if (!entry.name.endsWith(".xlsx")) continue;

    const fullPath = `${dir}/${entry.name}`;
    if (fullPath === keepPath) continue;

    try {
      await remove(fullPath);
    } catch (error) {
      console.warn(`Failed to remove stale summary file: ${fullPath}`, error);
    }
  }
}

/**
 * 検証結果テキストをパースしてValidationIssue配列に変換
 */
function parseIssuesText(issuesText: string): ValidationIssue[] {
  if (!issuesText || issuesText.trim() === "") {
    return [];
  }

  const lines = issuesText.split("\n");
  const issues: ValidationIssue[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const errorMatch = trimmed.match(/^\[E\]\s*(.+)$/);
    const warningMatch = trimmed.match(/^\[W\]\s*(.+)$/);

    if (errorMatch) {
      issues.push({
        field: "date",
        type: "format",
        severity: "error",
        message: errorMatch[1],
      });
    } else if (warningMatch) {
      issues.push({
        field: "date",
        type: "format",
        severity: "warning",
        message: warningMatch[1],
      });
    }
  }

  return issues;
}

/**
 * ExcelファイルからReceiptData配列を読み込む
 * @param yearMonth 年月 (YYYYMM形式)
 * @param directoryPath ディレクトリパス（filePathが壊れている場合の復元用）
 */
export async function loadReceiptsFromExcel(
  yearMonth: string,
  directoryPath?: string,
): Promise<ReceiptData[] | null> {
  const savePath = await findExistingSummaryPath(yearMonth);
  if (!savePath) {
    return null;
  }

  const fileData = await readFile(savePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileData);

  const sheet = workbook.getWorksheet("Summary");
  if (!sheet) {
    return null;
  }

  const receipts: ReceiptData[] = [];

  // 1 行目に合計行があるか判定（A1 セルが "合計金額" なら新フォーマット）
  const firstCellValue = String(sheet.getRow(1).getCell(1).value ?? "");
  const hasTotalRow = firstCellValue === TOTAL_ROW_LABEL;
  const headerRowIndex = hasTotalRow ? 2 : 1;

  // ヘッダー行から新フォーマットか判定（"宛名"列の有無）
  const headerRow = sheet.getRow(headerRowIndex);
  let isNewFormat = false;
  headerRow.eachCell((cell) => {
    if (String(cell.value) === "宛名") {
      isNewFormat = true;
    }
  });

  // 旧フォーマットの場合のカラムインデックス（1-indexed）
  // 旧: FileName(1), ImagePreview(2), OriginalFileLink(3), Date(4), Merchant(5), Amount(6), Currency(7), ValidationIssues(8)
  const oldFormatIndices = {
    fileName: 1,
    originalFileLink: 3,
    date: 4,
    merchant: 5,
    amount: 6,
    currency: 7,
    validationIssues: 8,
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const fileColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.FileName)
      : oldFormatIndices.fileName;
    const linkColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.OriginalFileLink)
      : oldFormatIndices.originalFileLink;

    const file = String(row.getCell(fileColIndex).value ?? "");
    const linkCell = row.getCell(linkColIndex);
    const filePathCellValue = linkCell.value;
    const filePathCellHyperlink = linkCell.hyperlink;

    // ハイパーリンクから取得、またはテキストから取得
    let filePath: string;
    if (
      filePathCellHyperlink &&
      !filePathCellHyperlink.includes("[object Object]")
    ) {
      filePath = filePathCellHyperlink;
    } else if (
      typeof filePathCellValue === "object" &&
      filePathCellValue !== null &&
      "text" in filePathCellValue
    ) {
      const text = String((filePathCellValue as { text: unknown }).text);
      if (!text.includes("[object Object]")) {
        filePath = text;
      } else {
        filePath = "";
      }
    } else if (linkCell.text && !linkCell.text.includes("[object Object]")) {
      filePath = linkCell.text;
    } else {
      filePath = "";
    }

    // filePathが壊れている場合、directoryPath + file で復元
    if (
      (!filePath || filePath.includes("[object Object]")) &&
      directoryPath &&
      file
    ) {
      filePath = `${directoryPath}/${file}`;
    }

    const dateColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.Date)
      : oldFormatIndices.date;
    const merchantColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.Merchant)
      : oldFormatIndices.merchant;
    const amountColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.Amount)
      : oldFormatIndices.amount;
    const currencyColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.Currency)
      : oldFormatIndices.currency;
    const issuesColIndex = isNewFormat
      ? getColumnIndex(ExcelColumnLabel.ValidationIssues)
      : oldFormatIndices.validationIssues;

    const dateValue = row.getCell(dateColIndex).value;
    const merchantValue = row.getCell(merchantColIndex).value;
    const amountValue = row.getCell(amountColIndex).value;
    const currencyValue = row.getCell(currencyColIndex).value;
    const issuesValue = row.getCell(issuesColIndex).value;

    const date = dateValue ? String(dateValue) : undefined;
    const merchant = merchantValue ? String(merchantValue) : undefined;
    const amount = amountValue ? Number(amountValue) : undefined;
    const currency = currencyValue ? String(currencyValue) : undefined;
    const issuesText = issuesValue ? String(issuesValue) : "";
    const issues = parseIssuesText(issuesText);

    // 新フォーマットのみ: receiverName, accountCategory, note を読み込む
    let receiverName: string | undefined;
    let accountCategory: string | undefined;
    let note: string | undefined;
    if (isNewFormat) {
      const receiverNameValue = row.getCell(
        getColumnIndex(ExcelColumnLabel.ReceiverName),
      ).value;
      const accountCategoryValue = row.getCell(
        getColumnIndex(ExcelColumnLabel.AccountCategory),
      ).value;
      const noteValue = row.getCell(
        getColumnIndex(ExcelColumnLabel.Note),
      ).value;
      receiverName = receiverNameValue ? String(receiverNameValue) : undefined;
      accountCategory = accountCategoryValue
        ? String(accountCategoryValue)
        : undefined;
      note = noteValue ? String(noteValue) : undefined;
    }

    const hasOcrData =
      date !== undefined || merchant !== undefined || amount !== undefined;
    const status = hasOcrData ? "success" : "pending";

    receipts.push({
      id: nanoid(6),
      file,
      filePath,
      date,
      merchant,
      amount,
      currency,
      receiverName,
      accountCategory,
      note,
      issues: issues.length > 0 ? issues : undefined,
      status,
    });
  });

  return receipts;
}

/**
 * サマリーExcelファイルが存在するか確認
 */
export async function checkSummaryExcelExists(
  yearMonth: string,
): Promise<boolean> {
  if (!yearMonth) return false;
  const savePath = await findExistingSummaryPath(yearMonth);
  return savePath !== null;
}

/**
 * レシートデータをExcelファイルに保存（ファイルは開かない）
 * 自動保存用：全てのレシート（pending含む）を保存
 */
export async function saveReceiptsToExcel(
  receipts: ReceiptData[],
  yearMonth: string,
): Promise<void> {
  if (receipts.length === 0) {
    return;
  }
  const jpyTotal = calculateJpyTotal(receipts);
  const savePath = await getNewSummaryPath(yearMonth, jpyTotal);
  await generateSummaryExcel(receipts, savePath);
  // 同月の他のサマリーファイル（旧フォーマット・古い合計値の旧ファイル）を削除
  await cleanupStaleSummaryFiles(yearMonth, savePath);
}

/**
 * サマリーExcelを生成/更新して開く
 * ユーザー操作用：成功レシートのみを保存してファイルを開く
 */
export async function openSummaryExcel(
  receipts: ReceiptData[],
  yearMonth: string,
): Promise<void> {
  // 処理済みのレシートがあれば新規生成（同時に旧ファイルを cleanup）
  const successReceipts = receipts.filter((r) => r.status === "success");
  if (successReceipts.length > 0) {
    await saveReceiptsToExcel(successReceipts, yearMonth);
  }

  // 保存後の実パスを取得（新規生成・既存ファイル両方カバー）
  const savePath = await findExistingSummaryPath(yearMonth);
  if (!savePath) {
    throw new Error("エクスポートするデータがありません");
  }

  // ファイルを開く
  await openPath(savePath);
}

/**
 * サマリーExcelファイルを生成
 */
async function generateSummaryExcel(
  receipts: ReceiptData[],
  savePath: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Summary");

  // カラム設定（types/excel.ts の定義から生成）
  // この時点で 1 行目にヘッダー行が自動配置される
  sheet.columns = generateSheetColumns();

  // 合計行を 1 行目に挿入し、ヘッダー行を 2 行目へシフト
  // データ行の addRow は 3 行目以降に積まれるので、画像アンカーも自然に追従する
  const jpyTotal = calculateJpyTotal(receipts);
  sheet.spliceRows(1, 0, [TOTAL_ROW_LABEL, jpyTotal]);

  // 合計行（1 行目）のスタイル
  const totalRow = sheet.getRow(1);
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell(2).numFmt = '"¥"#,##0';

  // ヘッダー行（2 行目）のスタイル + 合計行とヘッダー行の 2 行を固定
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.getRow(2).font = { bold: true };

  // 日付順でソート（昇順、undefined は末尾）
  const sortedReceipts = sortReceiptsByDate(receipts);

  for (const receipt of sortedReceipts) {
    // 検証結果テキストを生成
    const issuesText =
      receipt.issues
        ?.map((issue) => {
          const icon = issue.severity === "error" ? "[E]" : "[W]";
          return `${icon} ${issue.message}`;
        })
        .join("\n") ?? "";

    const row = sheet.addRow({
      [ExcelColumnLabel.FileName]: receipt.file,
      [ExcelColumnLabel.ImagePreview]: "",
      [ExcelColumnLabel.OriginalFileLink]: receipt.filePath,
      [ExcelColumnLabel.Date]: receipt.date ?? "",
      [ExcelColumnLabel.Merchant]: receipt.merchant ?? "",
      [ExcelColumnLabel.ReceiverName]: receipt.receiverName ?? "",
      [ExcelColumnLabel.Amount]: receipt.amount ?? null,
      [ExcelColumnLabel.Currency]: receipt.currency ?? "",
      [ExcelColumnLabel.AccountCategory]: receipt.accountCategory ?? "",
      [ExcelColumnLabel.Note]: receipt.note ?? "",
      [ExcelColumnLabel.ValidationIssues]: issuesText,
    });

    // 通貨コードがJPY以外の場合は赤字で太字にする
    if (receipt.currency && receipt.currency !== "JPY") {
      const currencyCell = row.getCell(
        getColumnIndex(ExcelColumnLabel.Currency),
      );
      currencyCell.font = { color: { argb: "FFCC0000" }, bold: true };
    }

    // 検証結果列の文字色を設定
    if (receipt.issues && receipt.issues.length > 0) {
      const issuesCell = row.getCell(
        getColumnIndex(ExcelColumnLabel.ValidationIssues),
      );
      const hasError = receipt.issues.some(
        (issue) => issue.severity === "error",
      );
      issuesCell.font = {
        color: { argb: hasError ? "FFCC0000" : "FFCC6600" },
      };
    }

    const previewCell = row.getCell(
      getColumnIndex(ExcelColumnLabel.ImagePreview),
    );
    previewCell.value = "プレビューなし";
    previewCell.alignment = { vertical: "middle", horizontal: "center" };

    let imageId: number | undefined;
    const imageExtension = getImageExtension(receipt.filePath);

    try {
      if (imageExtension) {
        // 画像ファイルを読み込み
        const imageData = await readFile(receipt.filePath);
        imageId = workbook.addImage({
          buffer: imageData,
          extension: imageExtension,
        });
      } else if (isPdf(receipt.filePath)) {
        // PDFの場合はサムネイルがあれば使用
        if (receipt.thumbnailDataUrl) {
          // DataURLからBase64部分を抽出
          const base64Data = receipt.thumbnailDataUrl.split(",")[1];
          const buffer = Uint8Array.from(atob(base64Data), (c) =>
            c.charCodeAt(0),
          );
          imageId = workbook.addImage({
            buffer: buffer,
            extension: "png",
          });
        }
      }

      if (imageId !== undefined) {
        const rowNumber = row.number;
        sheet.getRow(rowNumber).height = 90;
        // col は 0-indexed なので -1
        const imageCol = getColumnIndex(ExcelColumnLabel.ImagePreview) - 1;
        sheet.addImage(imageId, {
          tl: { col: imageCol + 0.1, row: rowNumber - 1 + 0.1 },
          ext: { width: 130, height: 90 },
          editAs: "oneCell",
        });
        previewCell.value = "";
      }
    } catch (error) {
      console.warn("Failed to add image to Excel:", error);
    }

    // ハイパーリンク設定（filePathが文字列であることを保証）
    const linkCell = row.getCell(
      getColumnIndex(ExcelColumnLabel.OriginalFileLink),
    );
    const safeFilePath =
      typeof receipt.filePath === "string"
        ? receipt.filePath
        : String(receipt.filePath ?? "");
    linkCell.value = {
      text: safeFilePath,
      hyperlink: safeFilePath,
    };
    linkCell.font = {
      color: { argb: "FF1155CC" },
      underline: true,
    };
  }

  // ファイルに保存
  const buffer = await workbook.xlsx.writeBuffer();
  await writeFile(savePath, new Uint8Array(buffer));
}
