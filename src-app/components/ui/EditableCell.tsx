import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FiChevronDown } from "react-icons/fi";
import { InputModal } from "./InputModal";

const CUSTOM_INPUT_OPTION = "その他（手入力）";

interface EditableCellProps {
  value: string;
  type: "text" | "date" | "number" | "select";
  options?: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  allowCustomInput?: boolean;
}

export function EditableCell({
  value,
  type,
  options,
  placeholder = "",
  onChange,
  className = "",
  allowCustomInput = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoize options array to avoid recomputation
  const allOptions = useMemo(() => {
    const baseOptions = ["", ...(options ?? [])];
    return allowCustomInput ? [...baseOptions, CUSTOM_INPUT_OPTION] : baseOptions;
  }, [options, allowCustomInput]);

  // Sync edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Click-outside handler for dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isDropdownOpen]);

  // Keyboard handler for dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsDropdownOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < allOptions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : allOptions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          const selected = allOptions[highlightedIndex];
          setIsDropdownOpen(false);
          if (selected === CUSTOM_INPUT_OPTION) {
            setIsModalOpen(true);
          } else if (selected !== value) {
            onChange(selected);
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen, highlightedIndex, allOptions, value, onChange]);

  // Reset highlightedIndex when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      const currentIndex = allOptions.indexOf(value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : -1);
    }
  }, [isDropdownOpen, allOptions, value]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleClick = () => {
    setIsEditing(true);
  };

  // Select type: custom dropdown (single click to open)
  if (type === "select") {
    const selectDisplayValue = value || placeholder || "選択";
    const selectIsEmpty = !value;

    let dropdownStyle: React.CSSProperties = {};
    if (isDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280) {
        dropdownStyle = {
          position: "fixed",
          left: rect.left,
          bottom: window.innerHeight - rect.top,
          width: Math.max(rect.width, 160),
        };
      } else {
        dropdownStyle = {
          position: "fixed",
          left: rect.left,
          top: rect.bottom + 2,
          width: Math.max(rect.width, 160),
        };
      }
    }

    return (
      <div ref={triggerRef} className="relative">
        <div
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`cursor-pointer hover:bg-gray-50 rounded px-2 py-1 text-sm truncate transition-colors duration-150 flex items-center justify-between gap-1 ${
            selectIsEmpty ? "text-gray-400 italic" : "text-gray-800"
          } ${className}`}
        >
          <span className="truncate">{selectDisplayValue}</span>
          <FiChevronDown
            className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </div>

        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-[280px] overflow-y-auto py-1"
          >
            {allOptions.map((option, index) => {
              const getOptionStyle = (): string => {
                if (option === value) return "bg-blue-50 text-blue-700 font-medium";
                if (highlightedIndex === index) return "bg-gray-100 text-gray-800";
                return "text-gray-700 hover:bg-gray-50";
              };
              return (
                <div
                  key={index}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (option === CUSTOM_INPUT_OPTION) {
                      setIsModalOpen(true);
                    } else if (option !== value) {
                      onChange(option);
                    }
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-1.5 text-sm cursor-pointer ${getOptionStyle()}`}
                >
                  {option || "選択なし"}
                </div>
              );
            })}
          </div>
        )}

        <InputModal
          isOpen={isModalOpen}
          title="通貨コードを入力"
          placeholder="例: CHF"
          defaultValue={value}
          onConfirm={(v) => {
            setIsModalOpen(false);
            if (v !== value) onChange(v);
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  // Text/date/number editing mode
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${className}`}
      />
    );
  }

  // Text/date/number display mode
  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer hover:bg-gray-50 rounded px-2 py-1 text-sm truncate transition-colors duration-150 ${
        isEmpty ? "text-gray-400 italic" : "text-gray-800"
      } ${className}`}
    >
      {displayValue}
    </div>
  );
}
