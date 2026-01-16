import { useState, useCallback } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { Header } from "./components/layout/Header";
import { ReceiptDropzone } from "./components/receipt/ReceiptDropzone";
import { ReceiptList } from "./components/receipt/ReceiptList";
import { ExportPanel } from "./components/export/ExportPanel";
import { SettingsModal } from "./components/settings/SettingsModal";
import { useReceiptStore } from "./hooks/useReceiptStore";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const receiptStore = useReceiptStore();

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  return (
    <MainLayout>
      <Header onOpenSettings={handleOpenSettings} />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* 左側: ドロップゾーンとリスト */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <ReceiptDropzone
            onFilesAdded={receiptStore.addReceipts}
            isProcessing={receiptStore.isProcessing}
          />

          <div className="flex-1 overflow-auto">
            <ReceiptList
              receipts={receiptStore.receipts}
              onRemove={receiptStore.removeReceipt}
              onUpdateReceipt={receiptStore.updateReceipt}
            />
          </div>
        </div>

        {/* 右側: エクスポートパネル */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <ExportPanel
            receipts={receiptStore.receipts}
            isProcessing={receiptStore.isProcessing}
            onStartOcr={receiptStore.startOcr}
            onClearAll={receiptStore.clearAll}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
      />
    </MainLayout>
  );
}

export default App;
