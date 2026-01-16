/**
 * Excelエクスポートサービス
 * ExcelJS を使用してレシートデータをxlsxファイルに出力する
 */

import ExcelJS from "exceljs";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import type { ReceiptData } from "../../types/receipt";
import { isPdf } from "../pdf/pdfExtractor";

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
 * レシートデータをExcelファイルにエクスポート
 */
export async function exportToExcel(receipts: ReceiptData[]): Promise<void> {
  if (receipts.length === 0) {
    throw new Error("エクスポートするデータがありません");
  }

  // 保存先を選択
  const savePath = await save({
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
    defaultPath: `receipts_${new Date().toISOString().slice(0, 10)}.xlsx`,
  });

  if (!savePath) {
    return; // キャンセルされた
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Summary");

  // カラム設定
  sheet.columns = [
    { header: "ファイル名", key: "file", width: 24 },
    { header: "画像プレビュー", key: "preview", width: 32 },
    { header: "元ファイルへのリンク", key: "link", width: 40 },
    { header: "日付", key: "date", width: 18 },
    { header: "店舗", key: "merchant", width: 28 },
    { header: "合計", key: "total", width: 14 },
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
      total: receipt.total ?? null,
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

    // ハイパーリンク設定
    const linkCell = row.getCell(3);
    linkCell.value = {
      text: receipt.filePath,
      hyperlink: receipt.filePath,
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
