/**
 * レシートストアフック
 * レシートデータの管理とOCR処理を担当
 */

import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ReceiptData, OcrProgressEvent } from "../types/receipt";
import { batchOcrReceipts } from "../services/tauri/commands";
import { readFileAsBase64, getMimeType, generateThumbnail } from "../services/pdf/pdfExtractor";
import { validateAllReceipts } from "../services/validation";

export interface ReceiptStoreState {
  receipts: ReceiptData[];
  isProcessing: boolean;
}

export interface ReceiptStoreActions {
  addReceipts: (filePaths: string[]) => Promise<void>;
  removeReceipt: (id: string) => void;
  updateReceipt: (id: string, updates: Partial<ReceiptData>) => void;
  startOcr: () => Promise<void>;
  clearAll: () => void;
}

export type UseReceiptStoreReturn = ReceiptStoreState & ReceiptStoreActions;

export function useReceiptStore(): UseReceiptStoreReturn {
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  /** レシートを追加 */
  const addReceipts = useCallback(async (filePaths: string[]) => {
    const newReceipts: ReceiptData[] = [];

    for (const filePath of filePaths) {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

      // サムネイル生成
      let thumbnailDataUrl: string | undefined;
      try {
        thumbnailDataUrl = await generateThumbnail(filePath);
      } catch (error) {
        console.warn("Failed to generate thumbnail:", error);
      }

      newReceipts.push({
        id: nanoid(),
        file: fileName,
        filePath,
        status: "pending",
        thumbnailDataUrl,
      });
    }

    setReceipts((prev) => [...prev, ...newReceipts]);
  }, []);

  /** レシートを削除 */
  const removeReceipt = useCallback((id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** レシートを更新 */
  const updateReceipt = useCallback(
    (id: string, updates: Partial<ReceiptData>) => {
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    },
    []
  );

  /** OCR処理を開始 */
  const startOcr = useCallback(async () => {
    const pendingReceipts = receipts.filter((r) => r.status === "pending");
    if (pendingReceipts.length === 0) return;

    setIsProcessing(true);

    // すべてのpendingレシートをprocessingに更新
    setReceipts((prev) =>
      prev.map((r) =>
        r.status === "pending" ? { ...r, status: "processing" as const } : r
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
            setReceipts((prev) =>
              prev.map((r) => {
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
              })
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
      setReceipts((prev) => {
        const successReceipts = prev.filter((r) => r.status === "success");
        if (successReceipts.length === 0) return prev;

        const targetSegment = new Date()
          .toISOString()
          .slice(0, 7)
          .replace("-", "");
        const validated = validateAllReceipts(successReceipts, targetSegment);

        return prev.map((r) => {
          const validatedReceipt = validated.find((v) => v.id === r.id);
          return validatedReceipt ?? r;
        });
      });
    } catch (error) {
      console.error("OCR processing failed:", error);

      // エラー時はすべてのprocessingをerrorに更新
      setReceipts((prev) =>
        prev.map((r) =>
          r.status === "processing"
            ? { ...r, status: "error" as const, errorMessage: String(error) }
            : r
        )
      );
    } finally {
      unlisten?.();
      setIsProcessing(false);
    }
  }, [receipts]);

  /** すべてクリア */
  const clearAll = useCallback(() => {
    setReceipts([]);
  }, []);

  return {
    receipts,
    isProcessing,
    addReceipts,
    removeReceipt,
    updateReceipt,
    startOcr,
    clearAll,
  };
}
