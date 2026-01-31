import { useState, useRef, useEffect, useCallback } from "react";

interface InputModalProps {
  /** Controls visibility of the modal */
  isOpen: boolean;
  /** Modal title (e.g., "通貨コードを入力") */
  title: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Initial input value */
  defaultValue?: string;
  /** Called when OK is clicked with the input value */
  onConfirm: (value: string) => void;
  /** Called when Cancel is clicked or overlay is clicked */
  onCancel: () => void;
}

export function InputModal({
  isOpen,
  title,
  placeholder = "",
  defaultValue = "",
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  // Reset input value when modal opens with new defaultValue
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if IME composition is in progress (keyCode 229 is IME processing)
      if (isComposingRef.current || e.isComposing || e.keyCode === 229) {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm(inputValue);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, inputValue, onConfirm, onCancel]);

  const handleOverlayClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(inputValue);
  }, [inputValue, onConfirm]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={handleModalClick}
      >
        {/* Title */}
        <h2 className="text-lg font-medium text-gray-800 mb-4">{title}</h2>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors duration-150"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors duration-150"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
