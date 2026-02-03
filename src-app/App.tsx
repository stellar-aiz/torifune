import { useState, useCallback, useMemo, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { ReceiptDropzone } from "./components/receipt/ReceiptDropzone";
import { ReceiptList } from "./components/receipt/ReceiptList";
import { ActionBar } from "./components/action/ActionBar";
import { SettingsModal } from "./components/settings/SettingsModal";
import { DeleteConfirmModal } from "./components/month/DeleteConfirmModal";
import { useReceiptStore } from "./hooks/useReceiptStore";
import { formatMonthName, type ReceiptData } from "./types/receipt";
import { getRootDirectory, moveToTrash } from "./services/tauri/commands";
import { openSummaryExcel } from "./services/excel/exporter";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FaFolderOpen } from "react-icons/fa";
import { Toast } from "./components/common/Toast";
import { AuthProvider } from "./contexts/AuthContext";

/** Main application content */
function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentMonthPath, setCurrentMonthPath] = useState<string | null>(null);
  const [pendingDeleteMonthId, setPendingDeleteMonthId] = useState<
    string | null
  >(null);
  const [pendingDeleteReceipt, setPendingDeleteReceipt] =
    useState<ReceiptData | null>(null);
  const store = useReceiptStore();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | "info";
  } | null>(null);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleCreateMonth = useCallback(
    (yearMonth: string) => {
      store.createMonth(yearMonth);
    },
    [store],
  );

  // 現在の申請月
  const currentMonth = useMemo(() => {
    return store.months.find((m) => m.id === store.currentMonthId);
  }, [store.months, store.currentMonthId]);

  // 現在の申請月のレシート一覧
  const currentReceipts = currentMonth?.receipts ?? [];

  // 申請月名
  const currentMonthName = currentMonth
    ? formatMonthName(currentMonth.yearMonth)
    : null;

  // 現在の申請月のフォルダパスを取得
  useEffect(() => {
    if (!currentMonth) {
      setCurrentMonthPath(null);
      return;
    }
    const fetchPath = async () => {
      const rootDir = await getRootDirectory();
      const year = currentMonth.yearMonth.slice(0, 4);
      const month = currentMonth.yearMonth.slice(4, 6);
      setCurrentMonthPath(`${rootDir}/${year}/${month}`);
    };
    fetchPath();
  }, [currentMonth]);

  // フォルダを開くハンドラ
  const handleOpenFolder = useCallback(async () => {
    if (currentMonthPath) {
      await revealItemInDir(currentMonthPath);
    }
  }, [currentMonthPath]);

  // 進捗計算
  const processingProgress = useMemo(() => {
    if (!store.isProcessing) return undefined;
    const total = currentReceipts.length;
    const completed = currentReceipts.filter(
      (r) => r.status === "success" || r.status === "error",
    ).length;
    return { completed, total };
  }, [store.isProcessing, currentReceipts]);

  // OCR実行可否
  const canStartOcr = useMemo(() => {
    const pendingCount = currentReceipts.filter(
      (r) => r.status === "pending",
    ).length;
    return pendingCount > 0 && !store.isProcessing;
  }, [currentReceipts, store.isProcessing]);

  // 検証実行可否（レシートがあれば可能）
  const canValidate = useMemo(() => {
    return currentReceipts.length > 0 && !store.isProcessing;
  }, [currentReceipts, store.isProcessing]);

  // Excel を開くハンドラ
  const handleOpenExcel = useCallback(async () => {
    if (!currentMonth) return;
    await openSummaryExcel(currentReceipts, currentMonth.yearMonth);
  }, [currentMonth, currentReceipts]);

  // データ検証ハンドラ
  const handleValidate = useCallback(async () => {
    const { warningCount, errorCount } = await store.validateReceipts();
    const totalIssues = warningCount + errorCount;

    if (totalIssues === 0) {
      setToast({
        message: "検証完了: 問題は見つかりませんでした",
        type: "success",
      });
    } else if (errorCount > 0) {
      setToast({
        message: `検証完了: ${errorCount}件のエラー、${warningCount}件の警告`,
        type: "warning",
      });
    } else {
      setToast({
        message: `検証完了: ${warningCount}件の警告`,
        type: "warning",
      });
    }
  }, [store]);

  // 宛名一括更新ハンドラ
  const handleBulkUpdateReceiverName = useCallback(
    (name: string) => {
      currentReceipts.forEach((receipt) => {
        store.updateReceipt(receipt.id, { receiverName: name });
      });
    },
    [currentReceipts, store],
  );

  // 削除リクエストハンドラ（サイドバー・ActionBar共通）
  const handleRequestDeleteMonth = useCallback((monthId: string) => {
    setPendingDeleteMonthId(monthId);
    setIsDeleteModalOpen(true);
  }, []);

  // 削除対象の月名を計算
  const pendingMonthName = useMemo(() => {
    const month = store.months.find((m) => m.id === pendingDeleteMonthId);
    return month ? formatMonthName(month.yearMonth) : "";
  }, [store.months, pendingDeleteMonthId]);

  // 削除確認時のハンドラ
  const handleConfirmDelete = useCallback(
    async (deletePhysically: boolean) => {
      if (!pendingDeleteMonthId) return;

      if (deletePhysically) {
        const monthToDelete = store.months.find(
          (m) => m.id === pendingDeleteMonthId,
        );
        if (monthToDelete) {
          const rootDir = await getRootDirectory();
          const year = monthToDelete.yearMonth.slice(0, 4);
          const month = monthToDelete.yearMonth.slice(4, 6);
          const pathToDelete = `${rootDir}/${year}/${month}`;
          try {
            await moveToTrash(pathToDelete);
          } catch (error) {
            console.error("Failed to move to trash:", error);
            // ゴミ箱移動に失敗してもアプリ上のデータは削除する
          }
        }
      }
      store.deleteMonth(pendingDeleteMonthId);
      setPendingDeleteMonthId(null);
    },
    [pendingDeleteMonthId, store],
  );

  // 個別レシート削除リクエストハンドラ
  const handleRequestDeleteReceipt = useCallback((receipt: ReceiptData) => {
    setPendingDeleteReceipt(receipt);
  }, []);

  // 個別レシート削除確認時のハンドラ
  const handleConfirmDeleteReceipt = useCallback(
    async (deletePhysically: boolean) => {
      if (!pendingDeleteReceipt) return;

      if (deletePhysically) {
        try {
          // 元ファイルをゴミ箱へ
          await moveToTrash(pendingDeleteReceipt.filePath);

          // サムネイルもゴミ箱へ（存在しない場合はエラー無視）
          const rootDir = await getRootDirectory();
          const yearMonth = currentMonth?.yearMonth;
          if (yearMonth) {
            const year = yearMonth.slice(0, 4);
            const month = yearMonth.slice(4, 6);
            const thumbnailPath = `${rootDir}/${year}/${month}/thumbnails/${pendingDeleteReceipt.file}.thumbnail.png`;
            try {
              await moveToTrash(thumbnailPath);
            } catch {
              console.warn("サムネイルの削除に失敗（存在しない可能性）");
            }
          }
        } catch (error) {
          console.error("ファイル削除エラー:", error);
        }
      }

      store.removeReceipt(pendingDeleteReceipt.id);
      setPendingDeleteReceipt(null);
    },
    [pendingDeleteReceipt, currentMonth, store],
  );

  // 個別レシート削除キャンセルハンドラ
  const handleCancelDeleteReceipt = useCallback(() => {
    setPendingDeleteReceipt(null);
  }, []);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* サイドバー */}
      <Sidebar
        months={store.months}
        currentMonthId={store.currentMonthId}
        onSelectMonth={store.selectMonth}
        onCreateMonth={handleCreateMonth}
        onOpenSettings={handleOpenSettings}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {store.currentMonthId ? (
          <>
            {/* 申請月ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  {currentMonthName}
                </h2>
                {currentMonthPath && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="font-mono text-xs">
                      {currentMonthPath}
                    </span>
                    <button
                      onClick={handleOpenFolder}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Finderで開く"
                    >
                      <FaFolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* ActionBar - ヘッダー直下 */}
            <ActionBar
              canStartOcr={canStartOcr}
              isProcessing={store.isProcessing}
              processingProgress={processingProgress}
              onStartOcr={store.startOcr}
              onOpenExcel={handleOpenExcel}
              onDeleteMonth={() =>
                handleRequestDeleteMonth(store.currentMonthId!)
              }
              canDeleteMonth={!!store.currentMonthId}
              onValidate={handleValidate}
              canValidate={canValidate}
            />

            {/* コンテンツエリア - フルワイド */}
            <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
              <ReceiptDropzone
                onFilesAdded={store.addReceipts}
                isProcessing={store.isProcessing}
              />
              <div className="flex-1 min-h-0">
                <ReceiptList
                  receipts={store.sortedReceipts}
                  yearMonth={currentMonth?.yearMonth ?? ""}
                  onUpdateReceipt={store.updateReceipt}
                  onRequestDelete={handleRequestDeleteReceipt}
                  onBulkUpdateReceiverName={handleBulkUpdateReceiverName}
                  sortConfig={store.sortConfig}
                  onToggleSort={store.toggleSort}
                />
              </div>
            </div>
          </>
        ) : (
          /* 未選択時のプレースホルダー */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              {store.months.length > 0 ? (
                // 既存月がある場合
                <>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    申請月を選択してください
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    左側のサイドバーから申請月を選択してください
                  </p>
                  <p className="text-sm text-gray-400 mb-4">または</p>
                  <button
                    onClick={() => store.createMonth()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    新規申請月を作成
                  </button>
                </>
              ) : (
                // 既存月がない場合
                <>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    申請月がまだありません
                  </h3>
                  <button
                    onClick={() => store.createMonth()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    今月の申請を作成
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPendingDeleteMonthId(null);
        }}
        onConfirm={handleConfirmDelete}
        monthName={pendingMonthName}
      />
      <DeleteConfirmModal
        isOpen={pendingDeleteReceipt !== null}
        onClose={handleCancelDeleteReceipt}
        onConfirm={handleConfirmDeleteReceipt}
        monthName={pendingDeleteReceipt?.file ?? ""}
        itemType="receipt"
      />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

/** App wrapped with AuthProvider for settings modal login functionality */
function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth;
