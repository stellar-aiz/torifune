/**
 * レシートストアフック
 * 申請月（ApplicationMonth）ごとのレシートデータ管理とOCR処理を担当
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { nanoid } from "nanoid";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ReceiptData,
  OcrProgressEvent,
  ApplicationMonth,
} from "../types/receipt";
import { getCurrentYearMonth } from "../types/receipt";
import { batchOcrReceipts, ensureMonthDirectory, copyFileToMonth, saveThumbnail } from "../services/tauri/commands";
import {
  readFileAsBase64,
  getMimeType,
  generateThumbnail,
} from "../services/pdf/pdfExtractor";
import { validateAllReceipts } from "../services/validation";
import {
  loadApplicationMonths,
  loadApplicationMonthReceipts,
  saveApplicationMonth,
} from "../services/persistence";

function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

const debouncedSave = debounce((month: ApplicationMonth) => {
  saveApplicationMonth(month).catch((error) => {
    console.error("Failed to auto-save application month:", error);
  });
}, 500);

export interface ReceiptStoreState {
  months: ApplicationMonth[];
  currentMonthId: string | null;
  isProcessing: boolean;
}

export interface ReceiptStoreActions {
  // 申請月操作
  createMonth: (yearMonth?: string) => Promise<void>;
  selectMonth: (monthId: string) => Promise<void>;
  deleteMonth: (monthId: string) => void;
  // レシート操作
  addReceipts: (filePaths: string[]) => Promise<void>;
  removeReceipt: (id: string) => void;
  updateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
  // OCR操作
  startOcr: () => Promise<void>;
  clearCurrentMonth: () => void;
}

export type UseReceiptStoreReturn = ReceiptStoreState & ReceiptStoreActions;

/** 現在の申請月を取得するヘルパー */
function getCurrentMonth(
  months: ApplicationMonth[],
  currentMonthId: string | null
): ApplicationMonth | undefined {
  return months.find((m) => m.id === currentMonthId);
}

export function useReceiptStore(): UseReceiptStoreReturn {
  const [months, setMonths] = useState<ApplicationMonth[]>([]);
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 起動時に既存のディレクトリから申請月を読み込む
  useEffect(() => {
    if (isInitialized) return;

    const initialize = async () => {
      try {
        const loadedMonths = await loadApplicationMonths();
        if (loadedMonths.length > 0) {
          setMonths(loadedMonths);
          // 最新の月を選択
          const sorted = [...loadedMonths].sort((a, b) =>
            b.yearMonth.localeCompare(a.yearMonth)
          );
          setCurrentMonthId(sorted[0].id);
        }
      } catch (error) {
        console.error("Failed to load application months:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [isInitialized]);

  /** 現在の申請月のレシート一覧 */
  const currentReceipts = useMemo(() => {
    const month = getCurrentMonth(months, currentMonthId);
    return month?.receipts ?? [];
  }, [months, currentMonthId]);

  /** 現在の申請月のyearMonth */
  const currentYearMonth = useMemo(() => {
    const month = getCurrentMonth(months, currentMonthId);
    return month?.yearMonth ?? null;
  }, [months, currentMonthId]);

  /** 申請月を作成 */
  const createMonth = useCallback(async (yearMonth?: string) => {
    const newYearMonth = yearMonth ?? getCurrentYearMonth();

    // 同じyearMonthの申請月が既にあればそれを選択
    const existing = months.find((m) => m.yearMonth === newYearMonth);
    if (existing) {
      setCurrentMonthId(existing.id);
      return;
    }

    // Create the physical directory structure
    try {
      await ensureMonthDirectory(newYearMonth);
    } catch (error) {
      console.error("Failed to create month directory:", error);
      // Continue with creating the logical month even if directory creation fails
    }

    // Create new month
    const newMonth: ApplicationMonth = {
      id: nanoid(6),
      yearMonth: newYearMonth,
      receipts: [],
    };

    setMonths((prev) => [...prev, newMonth]);
    setCurrentMonthId(newMonth.id);
  }, [months]);

  /** 申請月を選択（遅延読み込み対応） */
  const selectMonth = useCallback(
    async (monthId: string) => {
      setCurrentMonthId(monthId);

      const month = months.find((m) => m.id === monthId);
      if (!month || month.isLoaded) return;

      // 遅延読み込み実行
      if (month.directoryPath) {
        try {
          const receipts = await loadApplicationMonthReceipts(
            month.yearMonth,
            month.directoryPath
          );
          setMonths((prev) =>
            prev.map((m) =>
              m.id === monthId ? { ...m, receipts, isLoaded: true } : m
            )
          );
        } catch (error) {
          console.error("Failed to load receipts for month:", error);
        }
      }
    },
    [months]
  );

  /** 申請月を削除 */
  const deleteMonth = useCallback(
    (monthId: string) => {
      setMonths((prev) => prev.filter((m) => m.id !== monthId));

      // 削除した申請月が現在選択中の場合、別の申請月を選択
      if (currentMonthId === monthId) {
        const remaining = months.filter((m) => m.id !== monthId);
        setCurrentMonthId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [currentMonthId, months]
  );

  /** レシートを追加 */
  const addReceipts = useCallback(
    async (filePaths: string[]) => {
      if (!currentMonthId || !currentYearMonth) return;

      const newReceipts: ReceiptData[] = [];

      for (const filePath of filePaths) {
        try {
          // ファイルを月別ディレクトリにコピー
          const copyResult = await copyFileToMonth(filePath, currentYearMonth);

          // サムネイル生成（コピー後のパスで）
          let thumbnailDataUrl: string | undefined;
          try {
            thumbnailDataUrl = await generateThumbnail(copyResult.destinationPath);
            // サムネイルをファイルに保存
            if (thumbnailDataUrl) {
              await saveThumbnail(currentYearMonth, copyResult.fileName, thumbnailDataUrl);
            }
          } catch (error) {
            console.warn("Failed to generate thumbnail:", error);
          }

          newReceipts.push({
            id: nanoid(),
            file: copyResult.fileName,
            filePath: copyResult.destinationPath,
            status: "pending",
            thumbnailDataUrl,
          });
        } catch (error) {
          console.error("Failed to copy file:", filePath, error);
        }
      }

      if (newReceipts.length > 0) {
        setMonths((prev) =>
          prev.map((m) =>
            m.id === currentMonthId
              ? { ...m, receipts: [...m.receipts, ...newReceipts] }
              : m
          )
        );
      }
    },
    [currentMonthId, currentYearMonth]
  );

  /** レシートを削除 */
  const removeReceipt = useCallback(
    (id: string) => {
      if (!currentMonthId) return;

      setMonths((prev) =>
        prev.map((m) =>
          m.id === currentMonthId
            ? { ...m, receipts: m.receipts.filter((r) => r.id !== id) }
            : m
        )
      );
    },
    [currentMonthId]
  );

  /** レシートを更新 */
  const updateReceipt = useCallback(
    (id: string, updates: Partial<ReceiptData>) => {
      if (!currentMonthId) return;

      setMonths((prev) => {
        const updated = prev.map((m) =>
          m.id === currentMonthId
            ? {
                ...m,
                receipts: m.receipts.map((r) =>
                  r.id === id ? { ...r, ...updates } : r
                ),
              }
            : m
        );

        // 自動保存をトリガー
        const currentMonth = updated.find((m) => m.id === currentMonthId);
        if (currentMonth) {
          debouncedSave(currentMonth);
        }

        return updated;
      });
    },
    [currentMonthId]
  );

  /** OCR処理を開始 */
  const startOcr = useCallback(async () => {
    if (!currentMonthId || !currentYearMonth) return;

    const pendingReceipts = currentReceipts.filter(
      (r) => r.status === "pending"
    );
    if (pendingReceipts.length === 0) return;

    setIsProcessing(true);

    // すべてのpendingレシートをprocessingに更新
    setMonths((prev) =>
      prev.map((m) =>
        m.id === currentMonthId
          ? {
              ...m,
              receipts: m.receipts.map((r) =>
                r.status === "pending"
                  ? { ...r, status: "processing" as const }
                  : r
              ),
            }
          : m
      )
    );

    // 進捗イベントをリッスン
    let unlisten: UnlistenFn | undefined;
    try {
      unlisten = await listen<OcrProgressEvent>("ocr-progress", (event) => {
        const { current, result } = event.payload;

        if (result) {
          const targetReceipt = pendingReceipts[current];
          if (targetReceipt) {
            setMonths((prev) =>
              prev.map((m) =>
                m.id === currentMonthId
                  ? {
                      ...m,
                      receipts: m.receipts.map((r) => {
                        if (r.id !== targetReceipt.id) return r;

                        if (result.success && result.data) {
                          return {
                            ...r,
                            status: "success" as const,
                            merchant: result.data.merchant,
                            date: result.data.date,
                            total: result.data.total,
                          };
                        } else {
                          return {
                            ...r,
                            status: "error" as const,
                            errorMessage: result.error,
                          };
                        }
                      }),
                    }
                  : m
              )
            );
          }
        }
      });

      // OCRリクエストを準備
      const requests = await Promise.all(
        pendingReceipts.map(async (receipt) => {
          const fileContent = await readFileAsBase64(receipt.filePath);
          const mimeType = getMimeType(receipt.filePath);

          return {
            filePath: receipt.filePath,
            fileContent,
            mimeType,
          };
        })
      );

      // バッチOCR実行
      await batchOcrReceipts(requests);

      // バリデーション実行
      setMonths((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== currentMonthId) return m;

          const successReceipts = m.receipts.filter(
            (r) => r.status === "success"
          );
          if (successReceipts.length === 0) return m;

          const validated = validateAllReceipts(successReceipts, currentYearMonth);

          return {
            ...m,
            receipts: m.receipts.map((r) => {
              const validatedReceipt = validated.find((v) => v.id === r.id);
              return validatedReceipt ?? r;
            }),
          };
        });

        // OCR完了後に自動保存
        const currentMonth = updated.find((m) => m.id === currentMonthId);
        if (currentMonth) {
          saveApplicationMonth(currentMonth).catch((error) => {
            console.error("Failed to save application month after OCR:", error);
          });
        }

        return updated;
      });
    } catch (error) {
      console.error("OCR processing failed:", error);

      // エラー時はすべてのprocessingをerrorに更新
      setMonths((prev) =>
        prev.map((m) =>
          m.id === currentMonthId
            ? {
                ...m,
                receipts: m.receipts.map((r) =>
                  r.status === "processing"
                    ? {
                        ...r,
                        status: "error" as const,
                        errorMessage: String(error),
                      }
                    : r
                ),
              }
            : m
        )
      );
    } finally {
      unlisten?.();
      setIsProcessing(false);
    }
  }, [currentMonthId, currentYearMonth, currentReceipts]);

  /** 現在の申請月をクリア */
  const clearCurrentMonth = useCallback(() => {
    if (!currentMonthId) return;

    setMonths((prev) =>
      prev.map((m) =>
        m.id === currentMonthId ? { ...m, receipts: [] } : m
      )
    );
  }, [currentMonthId]);

  return {
    months,
    currentMonthId,
    isProcessing,
    createMonth,
    selectMonth,
    deleteMonth,
    addReceipts,
    removeReceipt,
    updateReceipt,
    startOcr,
    clearCurrentMonth,
  };
}
