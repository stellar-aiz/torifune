import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FiMenu,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiAlertCircle,
} from "react-icons/fi";
import { useAccountCategoryRulesStore } from "../../hooks/useAccountCategoryRulesStore";
import { validatePattern } from "../../services/accountCategoryMatcher";
import type { AccountCategoryRule } from "../../types/accountCategoryRule";

interface SortableRuleItemProps {
  rule: AccountCategoryRule;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<AccountCategoryRule>) => void;
}

function SortableRuleItem({
  rule,
  onToggleEnabled,
  onDelete,
  onUpdate,
}: SortableRuleItemProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleStartEdit = (field: string, value: string) => {
    setIsEditing(field);
    setEditValue(value);
    setPatternError(null);
  };

  const handleSaveEdit = (field: string) => {
    if (field === "pattern") {
      const flags = rule.flags;
      const validation = validatePattern(editValue, flags);
      if (!validation.valid) {
        setPatternError(validation.error || "無効なパターンです");
        return;
      }
    }
    if (field === "flags") {
      const validation = validatePattern(rule.pattern, editValue);
      if (!validation.valid) {
        setPatternError(validation.error || "無効なフラグです");
        return;
      }
    }
    onUpdate(rule.id, { [field]: editValue });
    setIsEditing(null);
    setPatternError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(null);
    setEditValue("");
    setPatternError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(field);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg
        ${isDragging ? "shadow-lg" : "shadow-sm"}
        ${!rule.enabled ? "opacity-50" : ""}
      `}
    >
      {/* ドラッグハンドル */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="ドラッグして並び替え"
      >
        <FiMenu className="w-4 h-4" />
      </button>

      {/* パターン */}
      {isEditing === "pattern" ? (
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSaveEdit("pattern")}
            onKeyDown={(e) => handleKeyDown(e, "pattern")}
            autoFocus
            className={`w-full px-2 py-0.5 text-sm font-mono border rounded ${patternError ? "border-red-300" : "border-gray-300"} focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
          />
        </div>
      ) : (
        <div
          onClick={() => handleStartEdit("pattern", rule.pattern)}
          className="flex-1 min-w-0 text-sm font-mono text-gray-800 truncate cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded"
          title={`パターン: ${rule.pattern}`}
        >
          /{rule.pattern || "..."}/
        </div>
      )}

      {/* フラグ */}
      {isEditing === "flags" ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit("flags")}
          onKeyDown={(e) => handleKeyDown(e, "flags")}
          autoFocus
          className="w-10 px-1 py-0.5 text-sm font-mono border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
        />
      ) : (
        <div
          onClick={() => handleStartEdit("flags", rule.flags)}
          className="w-8 text-sm font-mono text-gray-500 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-center flex-shrink-0"
          title="フラグ"
        >
          {rule.flags || "-"}
        </div>
      )}

      {/* 矢印 */}
      <span className="text-gray-400 flex-shrink-0">=</span>

      {/* 勘定科目 */}
      {isEditing === "accountCategory" ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit("accountCategory")}
          onKeyDown={(e) => handleKeyDown(e, "accountCategory")}
          autoFocus
          className="w-28 px-2 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      ) : (
        <div
          onClick={() => handleStartEdit("accountCategory", rule.accountCategory)}
          className="w-28 text-sm text-gray-800 truncate cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded flex-shrink-0"
          title={`勘定科目: ${rule.accountCategory}`}
        >
          {rule.accountCategory || "(未設定)"}
        </div>
      )}

      {/* 有効/無効トグル */}
      <button
        onClick={() => onToggleEnabled(rule.id, !rule.enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${rule.enabled ? "bg-blue-500" : "bg-gray-300"}`}
        title={rule.enabled ? "無効にする" : "有効にする"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${rule.enabled ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>

      {/* 削除ボタン */}
      <button
        onClick={() => onDelete(rule.id)}
        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        title="削除"
      >
        <FiTrash2 className="w-4 h-4" />
      </button>

      {/* エラー表示（あれば） */}
      {patternError && (
        <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs text-red-600">
          <FiAlertCircle className="w-3 h-3" />
          {patternError}
        </div>
      )}
    </div>
  );
}

interface NewRuleFormProps {
  onAdd: (rule: Omit<AccountCategoryRule, "id" | "createdAt">) => void;
  onCancel: () => void;
}

function NewRuleForm({ onAdd, onCancel }: NewRuleFormProps) {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("i");
  const [accountCategory, setAccountCategory] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePattern(pattern, flags);
    if (!validation.valid) {
      setPatternError(validation.error || "無効なパターンです");
      return;
    }

    if (!accountCategory.trim()) {
      setPatternError("勘定科目を入力してください");
      return;
    }

    onAdd({
      pattern,
      flags,
      accountCategory,
      enabled: true,
    });
  };

  const handlePatternChange = (value: string) => {
    setPattern(value);
    if (patternError) {
      const validation = validatePattern(value, flags);
      if (validation.valid) {
        setPatternError(null);
      }
    }
  };

  const handleFlagsChange = (value: string) => {
    setFlags(value);
    if (patternError && pattern) {
      const validation = validatePattern(pattern, value);
      if (validation.valid) {
        setPatternError(null);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg"
    >
      {/* スペーサー（ドラッグハンドルの位置合わせ） */}
      <div className="w-6 flex-shrink-0" />

      {/* パターン入力 */}
      <div className="flex-1 min-w-0 flex items-center">
        <span className="text-gray-400 mr-1">/</span>
        <input
          type="text"
          value={pattern}
          onChange={(e) => handlePatternChange(e.target.value)}
          placeholder="パターン"
          className={`flex-1 min-w-0 px-1 py-0.5 text-sm font-mono border rounded ${patternError ? "border-red-300" : "border-gray-300"} focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
        />
        <span className="text-gray-400 ml-1">/</span>
      </div>

      {/* フラグ入力 */}
      <input
        type="text"
        value={flags}
        onChange={(e) => handleFlagsChange(e.target.value)}
        placeholder="i"
        className="w-10 px-1 py-0.5 text-sm font-mono border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center flex-shrink-0"
      />

      {/* 矢印 */}
      <span className="text-gray-400 flex-shrink-0">=</span>

      {/* 勘定科目入力 */}
      <input
        type="text"
        value={accountCategory}
        onChange={(e) => setAccountCategory(e.target.value)}
        placeholder="勘定科目"
        className="w-28 px-2 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 flex-shrink-0"
      />

      {/* ボタン */}
      <button
        type="submit"
        className="px-2 py-0.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors flex-shrink-0"
      >
        追加
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-0.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors flex-shrink-0"
      >
        ×
      </button>

      {/* エラーメッセージ */}
      {patternError && (
        <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs text-red-600">
          <FiAlertCircle className="w-3 h-3" />
          {patternError}
        </div>
      )}
    </form>
  );
}

export function AccountCategoryRulesSettings() {
  const {
    rules,
    isLoading,
    error,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
    resetToDefault,
  } = useAccountCategoryRulesStore();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = rules.findIndex((r) => r.id === active.id);
        const newIndex = rules.findIndex((r) => r.id === over.id);
        const newRules = arrayMove(rules, oldIndex, newIndex);
        reorderRules(newRules);
      }
    },
    [rules, reorderRules]
  );

  const handleToggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      updateRule(id, { enabled });
    },
    [updateRule]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteRule(id);
    },
    [deleteRule]
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<AccountCategoryRule>) => {
      updateRule(id, updates);
    },
    [updateRule]
  );

  const handleAddRule = useCallback(
    async (rule: Omit<AccountCategoryRule, "id" | "createdAt">) => {
      await addRule(rule);
      setIsAddingNew(false);
    },
    [addRule]
  );

  const handleResetToDefault = useCallback(async () => {
    if (window.confirm("すべてのルールをデフォルトに戻しますか？")) {
      setIsResetting(true);
      try {
        await resetToDefault();
      } finally {
        setIsResetting(false);
      }
    }
  }, [resetToDefault]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">
          勘定科目自動設定ルール
        </h3>
        <p className="text-xs text-gray-500">
          店舗名に正規表現パターンがマッチした場合、勘定科目を自動設定します。
          上位のルールが優先されます。
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* ヘッダー行 */}
      {rules.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
          <div className="w-6 flex-shrink-0" />
          <div className="flex-1 min-w-0">パターン</div>
          <div className="w-8 text-center flex-shrink-0">フラグ</div>
          <div className="w-4 flex-shrink-0" />
          <div className="w-28 flex-shrink-0">勘定科目</div>
          <div className="w-9 text-center flex-shrink-0">有効</div>
          <div className="w-6 flex-shrink-0" />
        </div>
      )}

      {/* ルールリスト */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rules.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {rules.map((rule) => (
              <SortableRuleItem
                key={rule.id}
                rule={rule}
                onToggleEnabled={handleToggleEnabled}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 新規ルール追加フォーム */}
      {isAddingNew && (
        <NewRuleForm
          onAdd={handleAddRule}
          onCancel={() => setIsAddingNew(false)}
        />
      )}

      {/* ボタン群 */}
      <div className="flex gap-2">
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            ルールを追加
          </button>
        )}

        <button
          onClick={handleResetToDefault}
          disabled={isResetting}
          className={`
            flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${
              isResetting
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }
          `}
        >
          <FiRefreshCw className={`w-4 h-4 ${isResetting ? "animate-spin" : ""}`} />
          デフォルトに戻す
        </button>
      </div>

      {/* 空の状態 */}
      {rules.length === 0 && !isAddingNew && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">ルールが設定されていません</p>
          <p className="text-xs mt-1">
            「ルールを追加」ボタンで新しいルールを作成してください
          </p>
        </div>
      )}
    </div>
  );
}
