import { FiSettings } from "react-icons/fi";

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">Torifune</h1>
          <span className="text-sm text-gray-500">Receipt Analyzer</span>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          title="Settings"
        >
          <FiSettings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
