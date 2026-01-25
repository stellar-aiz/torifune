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
  SortConfig,
  SortField,
} from "../types/receipt";
import { getCurrentYearMonth } from "../types/receipt";
import { batchOcrReceipts, ensureMonthDirectory, copyFileToMonth, saveThumbnail, getAccountCategoryRules, getValidationRules } from "../services/tauri/commands";
import {
  readFileAsBase64,
  getMimeType,
  generateThumbnail,
} from "../services/pdf/pdfExtractor";
import { validateAllReceipts } from "../services/validation";
import type { ValidationRule } from "../types/validationRule";
import { mergeWithDefaultRules } from "../types/validationRule";
import {
  loadApplicationMonths,
  loadApplicationMonthReceipts,
  saveApplicationMonth,
} from "../services/persistence";
import { matchAccountCategory } from "../services/accountCategoryMatcher";
import type { AccountCategoryRule } from "../types/accountCategoryRule";

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

/** バリデーションルールを読み込むヘルパー */
async function loadValidationRules(): Promise<ValidationRule[]> {
  try {
    const settings = await getValidationRules();
    if (settings && settings.rules && settings.rules.length > 0) {
      // 新しい組み込みルールがあればマージ
      const { rules } = mergeWithDefaultRules(settings.rules);
      return rules;
    }
  } catch (error) {
    console.warn("Failed to load validation rules:", error);
  }
  return [];
}

export interface ReceiptStoreState {
  months: ApplicationMonth[];
  currentMonthId: string | null;
  isProcessing: boolean;
  sortConfig: SortConfig;
  sortedReceipts: ReceiptData[];
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
  validateReceipts: () => Promise<{ warningCount: number; errorCount: number }>;
  clearCurrentMonth: () => void;
  // ソート操作
  toggleSort: (field: SortField) => void;
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, order: "asc" });

  // 起動時に既存のディレクトリから申請月を読み込む
  useEffect(() => {
    if (isInitialized) return;

    const initialize = async () => {
      try {
        const loadedMonths = await loadApplicationMonths();
        if (loadedMonths.length > 0) {
          setMonths(loadedMonths);
          // currentMonthId は null のまま（ユーザーに選択させる）
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

  /** ソート済みレシート一覧 */
  const sortedReceipts = useMemo(() => {
    if (!sortConfig.field) return currentReceipts;

    return [...currentReceipts].sort((a, b) => {
      const field = sortConfig.field!;
      const aVal = a[field];
      const bVal = b[field];

      // nullish は末尾に
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (field === "amount") {
        comparison = (aVal as number) - (bVal as number);
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.order === "asc" ? comparison : -comparison;
    });
  }, [currentReceipts, sortConfig]);

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

    // 勘定科目ルールを読み込み
    let accountCategoryRules: AccountCategoryRule[] = [];
    try {
      const rulesSettings = await getAccountCategoryRules();
      if (rulesSettings?.rules) {
        accountCategoryRules = rulesSettings.rules;
      }
    } catch (error) {
      console.warn("Failed to load account category rules:", error);
    }

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
        const { fileName, result } = event.payload;

        if (result) {
          // fileName でマッチング（並列処理対応）
          const targetReceipt = pendingReceipts.find((r) => r.file === fileName);
          if (targetReceipt) {
            setMonths((prev) =>
              prev.map((m) =>
                m.id === currentMonthId
                  ? {
                      ...m,
                      receipts: m.receipts.map((r) => {
                        if (r.id !== targetReceipt.id) return r;

                        if (result.success && result.data) {
                          // 勘定科目の自動推測（既存値がなければマッチング）
                          let accountCategory = r.accountCategory;
                          if (!accountCategory && result.data.merchant) {
                            accountCategory = matchAccountCategory(
                              result.data.merchant,
                              accountCategoryRules
                            );
                          }
                          return {
                            ...r,
                            status: "success" as const,
                            merchant: result.data.merchant,
                            date: result.data.date,
                            amount: result.data.amount,
                            currency: result.data.currency,
                            receiverName: result.data.receiverName,
                            accountCategory,
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

      // バリデーションルールを読み込み
      const validationRules = await loadValidationRules();

      // バリデーション実行
      setMonths((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== currentMonthId) return m;

          const successReceipts = m.receipts.filter(
            (r) => r.status === "success"
          );
          if (successReceipts.length === 0) return m;

          const validated = validateAllReceipts(successReceipts, currentYearMonth, validationRules);

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

  /** ソートをトグル */
  const toggleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        // 同じフィールド: 昇順 → 降順 → ソートなし のトグル
        if (prev.order === "asc") return { field, order: "desc" };
        return { field: null, order: "asc" };
      }
      // 新しいフィールド: 昇順から開始
      return { field, order: "asc" };
    });
  }, []);

  /** 手動バリデーション実行 */
  const validateReceipts = useCallback(async (): Promise<{ warningCount: number; errorCount: number }> => {
    if (!currentMonthId || !currentYearMonth) {
      return { warningCount: 0, errorCount: 0 };
    }

    // 現在の月のレシートを取得
    const currentMonth = months.find((m) => m.id === currentMonthId);
    if (!currentMonth) {
      return { warningCount: 0, errorCount: 0 };
    }

    const successReceipts = currentMonth.receipts.filter((r) => r.status === "success");
    if (successReceipts.length === 0) {
      return { warningCount: 0, errorCount: 0 };
    }

    // バリデーションルールを読み込み
    const validationRules = await loadValidationRules();

    // 既存のissueをクリアしてから検証（setMonthsの外で実行）
    const clearedReceipts = successReceipts.map((r) => ({ ...r, issues: undefined }));
    const validated = validateAllReceipts(clearedReceipts, currentYearMonth, validationRules);

    // カウントを計算（setMonthsの外で実行）
    let warningCount = 0;
    let errorCount = 0;
    for (const receipt of validated) {
      if (receipt.issues) {
        for (const issue of receipt.issues) {
          if (issue.severity === "warning") warningCount++;
          if (issue.severity === "error") errorCount++;
        }
      }
    }

    // 状態を更新
    setMonths((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== currentMonthId) return m;

        return {
          ...m,
          receipts: m.receipts.map((r) => {
            const validatedReceipt = validated.find((v) => v.id === r.id);
            return validatedReceipt ?? r;
          }),
        };
      });

      // Auto-save after validation
      const updatedMonth = updated.find((m) => m.id === currentMonthId);
      if (updatedMonth) {
        debouncedSave(updatedMonth);
      }

      return updated;
    });

    return { warningCount, errorCount };
  }, [currentMonthId, currentYearMonth, months]);

  return {
    months,
    currentMonthId,
    isProcessing,
    sortConfig,
    sortedReceipts,
    createMonth,
    selectMonth,
    deleteMonth,
    addReceipts,
    removeReceipt,
    updateReceipt,
    startOcr,
    validateReceipts,
    clearCurrentMonth,
    toggleSort,
  };
}
