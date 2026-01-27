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

/** ディレクトリを作成 */
export async function createDirectory(path: string): Promise<void> {
  return invoke<void>("create_directory", { path });
}

/** 月ディレクトリ情報 */
export interface MonthDirectoryInfo {
  year: string;
  month: string;
  yearMonth: string;
  path: string;
  hasExcel: boolean;
}

/** ルートディレクトリ以下の年月ディレクトリ一覧を取得 */
export async function listMonthDirectories(): Promise<MonthDirectoryInfo[]> {
  return invoke<MonthDirectoryInfo[]>("list_month_directories");
}

/** ファイル情報 */
export interface FileInfo {
  name: string;
  path: string;
  isImage: boolean;
  isPdf: boolean;
  size: number;
}

/** ディレクトリ内のファイル一覧を取得 */
export async function listFilesInDirectory(
  directoryPath: string
): Promise<FileInfo[]> {
  return invoke<FileInfo[]>("list_files_in_directory", { directoryPath });
}

/** ファイルコピー結果 */
export interface CopyFileResult {
  originalPath: string;
  destinationPath: string;
  fileName: string;
}

/** ファイルを月別ディレクトリにコピー */
export async function copyFileToMonth(
  sourcePath: string,
  yearMonth: string
): Promise<CopyFileResult> {
  return invoke<CopyFileResult>("copy_file_to_month", { sourcePath, yearMonth });
}

/** サムネイルを保存 */
export async function saveThumbnail(
  yearMonth: string,
  fileName: string,
  dataUrl: string
): Promise<string> {
  return invoke<string>("save_thumbnail", { yearMonth, fileName, dataUrl });
}

/** サムネイルを読み込み */
export async function readThumbnail(
  yearMonth: string,
  fileName: string
): Promise<string | null> {
  return invoke<string | null>("read_thumbnail", { yearMonth, fileName });
}

/**
 * ディレクトリをゴミ箱に移動
 */
export async function moveToTrash(path: string): Promise<void> {
  await invoke<void>("move_to_trash", { path });
}

import type { AccountCategoryRulesSettings } from "../../types/accountCategoryRule";
import type { ValidationRulesSettings } from "../../types/validationRule";

/** 勘定科目ルール設定を取得 */
export async function getAccountCategoryRules(): Promise<AccountCategoryRulesSettings | null> {
  return invoke<AccountCategoryRulesSettings | null>("get_account_category_rules");
}

/** 勘定科目ルール設定を保存 */
export async function saveAccountCategoryRules(
  settings: AccountCategoryRulesSettings
): Promise<void> {
  return invoke<void>("save_account_category_rules", { settings });
}

/** バリデーションルール設定を取得 */
export async function getValidationRules(): Promise<ValidationRulesSettings | null> {
  return invoke<ValidationRulesSettings | null>("get_validation_rules");
}

/** バリデーションルール設定を保存 */
export async function saveValidationRules(
  settings: ValidationRulesSettings
): Promise<void> {
  return invoke<void>("save_validation_rules", { rules: settings });
}

import type { ReceiverNameSettings } from "../../types/receiverNameHistory";

// 旧形式（v1）と新形式（v2）の両方を扱うための型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReceiverNameData = ReceiverNameSettings | { names?: string[]; version?: number } | any;

/** 宛名設定を取得 */
export async function getReceiverNameHistory(): Promise<ReceiverNameData | null> {
  return invoke<ReceiverNameData | null>("get_receiver_name_history");
}

/** 宛名設定を保存 */
export async function saveReceiverNameHistory(
  history: ReceiverNameSettings
): Promise<void> {
  return invoke<void>("save_receiver_name_history", { history });
}
