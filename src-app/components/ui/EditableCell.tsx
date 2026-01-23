import { useState, useRef, useEffect, useCallback } from "react";

interface EditableCellProps {
  value: string;
  type: "text" | "date" | "number" | "select";
  options?: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableCell({
  value,
  type,
  options,
  placeholder = "",
  onChange,
  className = "",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Sync edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus input/select when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (type === "select" && selectRef.current) {
        selectRef.current.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

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

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  if (isEditing) {
    if (type === "select") {
      return (
        <select
          ref={selectRef}
          value={editValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setEditValue(newValue);
            setIsEditing(false);
            if (newValue !== value) {
              onChange(newValue);
            }
          }}
          onBlur={() => setIsEditing(false)}
          className={`w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${className}`}
        >
          <option value="">選択してください</option>
          {options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

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

  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer hover:bg-gray-50 rounded px-2 py-1 truncate transition-colors duration-150 ${
        isEmpty ? "text-gray-400 italic" : "text-gray-800"
      } ${className}`}
    >
      {displayValue}
    </div>
  );
}
