/**
 * ローカルエラーログサービス
 *
 * 外部送信は一切行わない。フロントエンドで発生したエラーをRust側の
 * ログファイル（error.log）に書き込むための薄いラッパー。
 *
 * 重要な制約: 領収書内容（店名・金額・日付・ファイルパス/ファイル名）や
 * 認証情報・トークンなど機微な情報は絶対に含めないこと。
 * ここで記録するのはエラーメッセージ・スタックトレース・コンポーネント
 * スタック・件数のみのコンテキスト文字列に限る。
 */

import { writeErrorLog } from "./tauri/commands";

/** 現在の操作コンテキストを保持する薄いモジュール変数（パンくず） */
let currentBreadcrumb: string | undefined;

/**
 * 現在の操作コンテキストを設定/クリアする。
 * 例: "OCR batch (3 receipts)" のように件数のみを記録し、
 * 店名・金額・ファイル名などの領収書内容は含めないこと。
 */
export function setBreadcrumb(text?: string): void {
  currentBreadcrumb = text;
}

/** logError のデフォルトcontextとして使う内部ゲッター */
function getBreadcrumb(): string | undefined {
  return currentBreadcrumb;
}

/** 任意の値をエラーメッセージ・スタックに正規化する */
function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * エラーをローカルログファイルに記録する。
 * 書き込み自体が失敗しても再スローせず、コンソールに出力するのみ。
 *
 * @returns 書き込まれたログファイルのパス。失敗時は null。
 */
export async function logError(
  error: unknown,
  extra?: { componentStack?: string; context?: string },
): Promise<string | null> {
  try {
    const { message, stack } = normalizeError(error);
    const context = extra?.context ?? getBreadcrumb();

    return await writeErrorLog({
      message,
      stack,
      componentStack: extra?.componentStack,
      context,
    });
  } catch (loggingError) {
    console.error("Failed to write error log:", loggingError);
    return null;
  }
}

/**
 * グローバルなエラー捕捉を登録する。
 * ErrorBoundaryが捕捉できないイベントハンドラ内例外・未処理のPromise
 * rejectionをログに残すためのもの。main.tsxの描画前に一度だけ呼ぶ。
 */
export function installGlobalErrorLogging(): void {
  window.addEventListener("error", (event: ErrorEvent) => {
    logError(event.error ?? event.message);
  });

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      logError(event.reason);
    },
  );
}
