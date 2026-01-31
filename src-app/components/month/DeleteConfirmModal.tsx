import { useState } from "react";
import { FiX, FiTrash2 } from "react-icons/fi";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deletePhysically: boolean) => void;
  monthName: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  monthName,
}: DeleteConfirmModalProps) {
  const [deletePhysically, setDeletePhysically] = useState(true);

  const handleConfirm = () => {
    onConfirm(deletePhysically);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        style={{
          animation: "modalSlideIn 0.2s ease-out",
        }}
      >
        <style>{`
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
          >
            <FiX className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <FiTrash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                削除の確認
              </h2>
              <p className="text-sm text-gray-500">
                「{monthName}」を削除します
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all duration-200 has-[:checked]:border-red-400 has-[:checked]:bg-red-50/50">
              <input
                type="radio"
                name="deleteOption"
                checked={deletePhysically}
                onChange={() => setDeletePhysically(true)}
                className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  物理ファイルも削除（ゴミ箱へ移動）
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  フォルダごとゴミ箱に移動します
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50/50 transition-all duration-200 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50/50">
              <input
                type="radio"
                name="deleteOption"
                checked={!deletePhysically}
                onChange={() => setDeletePhysically(false)}
                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  torifuneから見えなくするだけ（ファイルは残る）
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  アプリ上のデータのみ削除し、ファイルは残します
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700 transition-all duration-200"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
