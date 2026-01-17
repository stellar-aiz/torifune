/**
 * Tauriコマンド呼び出し
 * Rust側で定義したコマンドをTypeScriptから呼び出すためのラッパー
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  OcrSettings,
  OcrResult,
  DirectoryValidation,
} from "../../types/receipt";

/** OCR設定を取得 */
export async function getOcrSettings(): Promise<OcrSettings> {
  return invoke<OcrSettings>("get_ocr_settings");
}

/** OCR設定を保存 */
export async function saveOcrSettings(settings: OcrSettings): Promise<void> {
  return invoke<void>("save_ocr_settings", { settings });
}

/** プロバイダー接続テスト */
export async function testProviderConnection(): Promise<void> {
  return invoke<void>("test_provider_connection");
}

/** OCRリクエスト */
export interface OcrRequest {
  filePath: string;
  fileContent: string;
  mimeType: string;
}

/** 単一ファイルのOCR処理 */
export async function ocrReceipt(
  filePath: string,
  fileContent: string,
  mimeType: string
): Promise<OcrResult> {
  return invoke<OcrResult>("ocr_receipt", {
    filePath,
    fileContent,
    mimeType,
  });
}

/** バッチOCR処理 */
export async function batchOcrReceipts(
  requests: OcrRequest[]
): Promise<OcrResult[]> {
  return invoke<OcrResult[]>("batch_ocr_receipts", { requests });
}

/** デフォルトのルートディレクトリを取得 */
export async function getDefaultRootDirectory(): Promise<string> {
  return invoke<string>("get_default_root_directory");
}

/** 現在のルートディレクトリを取得 */
export async function getRootDirectory(): Promise<string> {
  return invoke<string>("get_root_directory");
}

/** ルートディレクトリを保存 */
export async function saveRootDirectory(path: string): Promise<void> {
  return invoke<void>("save_root_directory", { path });
}

/** 月別ディレクトリを確保 */
export async function ensureMonthDirectory(yearMonth: string): Promise<string> {
  return invoke<string>("ensure_month_directory", { yearMonth });
}

/** ディレクトリを検証 */
export async function validateDirectory(
  path: string
): Promise<DirectoryValidation> {
  return invoke<DirectoryValidation>("validate_directory", { path });
}
