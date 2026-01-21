/**
 * Excelサマリー生成サービス
 * ExcelJS を使用してレシートデータをxlsxファイルに出力する
 */

import ExcelJS from "exceljs";
import { writeFile, readFile, exists } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { nanoid } from "nanoid";
import type { ReceiptData, ValidationIssue } from "../../types/receipt";
import { isPdf } from "../pdf/pdfExtractor";
import { getRootDirectory } from "../tauri/commands";

type SupportedImageExtension = "jpeg" | "png";

/**
 * ファイルパスから画像拡張子を取得
 */
function getImageExtension(filePath: string): SupportedImageExtension | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  return undefined;
}

/**
 * サマリーExcelファイルのパスを取得
 */
async function getSummaryExcelPath(yearMonth: string): Promise<string> {
  const rootDir = await getRootDirectory();
  const year = yearMonth.slice(0, 4);
  const month = yearMonth.slice(4, 6);
  return `${rootDir}/${year}/${month}/${yearMonth}-summary.xlsx`;
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
  directoryPath?: string
): Promise<ReceiptData[] | null> {
  const savePath = await getSummaryExcelPath(yearMonth);

  const fileExists = await exists(savePath);
  if (!fileExists) {
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

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const file = String(row.getCell(1).value ?? "");
    const linkCell = row.getCell(3);
    const filePathCellValue = linkCell.value;
    const filePathCellHyperlink = linkCell.hyperlink;

    // ハイパーリンクから取得、またはテキストから取得
    let filePath: string;
    if (filePathCellHyperlink && !filePathCellHyperlink.includes("[object Object]")) {
      filePath = filePathCellHyperlink;
    } else if (typeof filePathCellValue === "object" && filePathCellValue !== null && "text" in filePathCellValue) {
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
    if ((!filePath || filePath.includes("[object Object]")) && directoryPath && file) {
      filePath = `${directoryPath}/${file}`;
    }

    const dateValue = row.getCell(4).value;
    const merchantValue = row.getCell(5).value;
    const amountValue = row.getCell(6).value;
    const issuesValue = row.getCell(7).value;

    const date = dateValue ? String(dateValue) : undefined;
    const merchant = merchantValue ? String(merchantValue) : undefined;
    const amount = amountValue ? Number(amountValue) : undefined;
    const issuesText = issuesValue ? String(issuesValue) : "";
    const issues = parseIssuesText(issuesText);

    const hasOcrData = date !== undefined || merchant !== undefined || amount !== undefined;
    const status = hasOcrData ? "success" : "pending";

    receipts.push({
      id: nanoid(6),
      file,
      filePath,
      date,
      merchant,
      amount,
      issues: issues.length > 0 ? issues : undefined,
      status,
    });
  });

  return receipts;
}

/**
 * サマリーExcelファイルが存在するか確認
 */
export async function checkSummaryExcelExists(yearMonth: string): Promise<boolean> {
  if (!yearMonth) return false;
  const savePath = await getSummaryExcelPath(yearMonth);
  return exists(savePath);
}

/**
 * レシートデータをExcelファイルに保存（ファイルは開かない）
 * 自動保存用：全てのレシート（pending含む）を保存
 */
export async function saveReceiptsToExcel(
  receipts: ReceiptData[],
  yearMonth: string
): Promise<void> {
  if (receipts.length === 0) {
    return;
  }
  const savePath = await getSummaryExcelPath(yearMonth);
  await generateSummaryExcel(receipts, savePath);
}

/**
 * サマリーExcelを生成/更新して開く
 * ユーザー操作用：成功レシートのみを保存してファイルを開く
 */
export async function openSummaryExcel(
  receipts: ReceiptData[],
  yearMonth: string
): Promise<void> {
  const savePath = await getSummaryExcelPath(yearMonth);

  // 処理済みのレシートがあれば新規生成
  const successReceipts = receipts.filter((r) => r.status === "success");
  if (successReceipts.length > 0) {
    await saveReceiptsToExcel(successReceipts, yearMonth);
  } else {
    // レシートがない場合は既存ファイルを確認
    const fileExists = await exists(savePath);
    if (!fileExists) {
      throw new Error("エクスポートするデータがありません");
    }
  }

  // ファイルを開く
  await openPath(savePath);
}

/**
 * サマリーExcelファイルを生成
 */
async function generateSummaryExcel(
  receipts: ReceiptData[],
  savePath: string
): Promise<void> {

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Summary");

  // カラム設定
  sheet.columns = [
    { header: "ファイル名", key: "file", width: 24 },
    { header: "画像プレビュー", key: "preview", width: 32 },
    { header: "元ファイルへのリンク", key: "link", width: 40 },
    { header: "日付", key: "date", width: 18 },
    { header: "店舗", key: "merchant", width: 28 },
    { header: "合計", key: "amount", width: 14 },
    { header: "検証結果", key: "issues", width: 40 },
  ];

  // ヘッダー行のスタイル
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };

  for (const receipt of receipts) {
    // 検証結果テキストを生成
    const issuesText =
      receipt.issues
        ?.map((issue) => {
          const icon = issue.severity === "error" ? "[E]" : "[W]";
          return `${icon} ${issue.message}`;
        })
        .join("\n") ?? "";

    const row = sheet.addRow({
      file: receipt.file,
      preview: "",
      link: receipt.filePath,
      date: receipt.date ?? "",
      merchant: receipt.merchant ?? "",
      amount: receipt.amount ?? null,
      issues: issuesText,
    });

    // 検証結果列の文字色を設定
    if (receipt.issues && receipt.issues.length > 0) {
      const issuesCell = row.getCell(7);
      const hasError = receipt.issues.some((issue) => issue.severity === "error");
      issuesCell.font = {
        color: { argb: hasError ? "FFCC0000" : "FFCC6600" },
      };
    }

    const previewCell = row.getCell(2);
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
          const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          imageId = workbook.addImage({
            buffer: buffer,
            extension: "png",
          });
        }
      }

      if (imageId !== undefined) {
        const rowNumber = row.number;
        sheet.getRow(rowNumber).height = 90;
        sheet.addImage(imageId, {
          tl: { col: 1.1, row: rowNumber - 1 + 0.1 },
          ext: { width: 130, height: 90 },
          editAs: "oneCell",
        });
        previewCell.value = "";
      }
    } catch (error) {
      console.warn("Failed to add image to Excel:", error);
    }

    // ハイパーリンク設定（filePathが文字列であることを保証）
    const linkCell = row.getCell(3);
    const safeFilePath = typeof receipt.filePath === "string" ? receipt.filePath : String(receipt.filePath ?? "");
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
