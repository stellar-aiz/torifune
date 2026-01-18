import { useState, useRef, useEffect, useCallback } from "react";

interface EditableCellProps {
  value: string;
  type: "text" | "date" | "number";
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableCell({
  value,
  type,
  placeholder = "",
  onChange,
  className = "",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

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
