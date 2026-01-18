/**
 * PDF/画像処理サービス
 *
 * pdfjs-dist を使用してPDFファイルからサムネイルを生成し、
 * 画像ファイルの読み込みとBase64エンコードを行う。
 */

import * as pdfjsLib from "pdfjs-dist";
import { readFile } from "@tauri-apps/plugin-fs";

// PDF.js Worker の設定（Vite用）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * ファイルをBase64エンコードで読み込む
 */
export async function readFileAsBase64(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return uint8ArrayToBase64(data);
}

/**
 * Uint8ArrayをBase64文字列に変換
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * ファイルパスからMIMEタイプを取得
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

/**
 * ファイルがPDFかどうか判定
 */
export function isPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

/**
 * サムネイルを生成（DataURL形式）
 */
export async function generateThumbnail(filePath: string): Promise<string> {
  const data = await readFile(filePath);

  if (isPdf(filePath)) {
    return generatePdfThumbnail(data);
  } else {
    return generateImageThumbnail(data, getMimeType(filePath));
  }
}

/**
 * PDFのサムネイルを生成
 */
async function generatePdfThumbnail(data: Uint8Array): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const scale = 0.5;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context not available");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL("image/png");
}

/**
 * 画像のサムネイルを生成
 */
async function generateImageThumbnail(
  data: Uint8Array,
  mimeType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const maxSize = 200;
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context not available"));
        return;
      }

      context.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

