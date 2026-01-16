import { useState, useCallback, useMemo } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { ReceiptDropzone } from "./components/receipt/ReceiptDropzone";
import { ReceiptList } from "./components/receipt/ReceiptList";
import { ExportPanel } from "./components/export/ExportPanel";
import { SettingsModal } from "./components/settings/SettingsModal";
import { useReceiptStore } from "./hooks/useReceiptStore";
import { formatMonthName } from "./types/receipt";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const store = useReceiptStore();

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

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

  return (
    <div className="h-screen flex bg-gray-50">
      {/* サイドバー */}
      <Sidebar
        months={store.months}
        currentMonthId={store.currentMonthId}
        onSelectMonth={store.selectMonth}
        onCreateMonth={store.createMonth}
        onDeleteMonth={store.deleteMonth}
        onOpenSettings={handleOpenSettings}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {store.currentMonthId ? (
          <>
            {/* 申請月ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {currentMonthName}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {currentReceipts.length}件のレシート
              </p>
            </header>

            {/* コンテンツエリア */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
              {/* 左側: ドロップゾーンとリスト */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <ReceiptDropzone
                  onFilesAdded={store.addReceipts}
                  isProcessing={store.isProcessing}
                />

                <div className="flex-1 overflow-auto">
                  <ReceiptList
                    receipts={currentReceipts}
                    onRemove={store.removeReceipt}
                    onUpdateReceipt={store.updateReceipt}
                  />
                </div>
              </div>

              {/* 右側: エクスポートパネル */}
              <div className="w-full lg:w-80 flex-shrink-0">
                <ExportPanel
                  receipts={currentReceipts}
                  isProcessing={store.isProcessing}
                  onStartOcr={store.startOcr}
                  onClearAll={store.clearCurrentMonth}
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
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                申請月を選択してください
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                左側のサイドバーから申請月を選択するか、
                <br />
                「新規申請月」ボタンで新しい申請を作成してください。
              </p>
              <button
                onClick={() => store.createMonth()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                今月の申請を作成
              </button>
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
    </div>
  );
}

export default App;
