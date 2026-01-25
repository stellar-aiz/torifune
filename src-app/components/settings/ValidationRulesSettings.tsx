import { useState, useCallback } from "react";
import {
  FiRefreshCw,
  FiAlertCircle,
  FiAlertTriangle,
  FiXCircle,
  FiChevronDown,
  FiChevronUp,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiTrendingUp,
  FiFile,
  FiCopy,
  FiSettings,
  FiEdit3,
} from "react-icons/fi";
import { useValidationRulesStore } from "../../hooks/useValidationRulesStore";
import type { ValidationRule } from "../../types/validationRule";

/** ルールタイプごとのアイコンと色 */
const ruleTypeConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  "date-format": {
    icon: <FiCalendar className="w-4 h-4" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  "date-range": {
    icon: <FiClock className="w-4 h-4" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  "amount-decimal": {
    icon: <FiDollarSign className="w-4 h-4" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  "amount-outlier": {
    icon: <FiTrendingUp className="w-4 h-4" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  "duplicate-file": {
    icon: <FiFile className="w-4 h-4" />,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  "duplicate-data": {
    icon: <FiCopy className="w-4 h-4" />,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  "entertainment-note-required": {
    icon: <FiEdit3 className="w-4 h-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
};

interface RuleItemProps {
  rule: ValidationRule;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onChangeSeverity: (id: string, severity: "warning" | "error") => void;
  onUpdateParams: (
    id: string,
    params: Record<string, number | string | boolean>
  ) => void;
}

function RuleItem({
  rule,
  onToggleEnabled,
  onChangeSeverity,
  onUpdateParams,
}: RuleItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = ruleTypeConfig[rule.type] || {
    icon: <FiSettings className="w-4 h-4" />,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
  };

  const hasParams = Object.keys(rule.params).length > 0;

  const handleParamChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdateParams(rule.id, { ...rule.params, [key]: numValue });
    }
  };

  return (
    <div
      className={`
        border rounded-lg transition-all duration-200
        ${rule.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}
      `}
    >
      {/* メイン行 */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* アイコン */}
        <span
          className={`
          flex items-center justify-center w-8 h-8 rounded-lg
          ${config.bgColor} ${config.color}
        `}
        >
          {config.icon}
        </span>

        {/* ルール名と説明 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-800">{rule.name}</h4>
            {rule.isBuiltIn && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded">
                組込
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{rule.description}</p>
        </div>

        {/* パラメータ展開ボタン（またはスペーサー） */}
        {hasParams ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title={isExpanded ? "閉じる" : "パラメータを編集"}
          >
            {isExpanded ? (
              <FiChevronUp className="w-4 h-4" />
            ) : (
              <FiChevronDown className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-7 flex-shrink-0" />
        )}

        {/* 重大度セレクタ */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChangeSeverity(rule.id, "warning")}
            disabled={!rule.enabled}
            className={`
              flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-l-md border transition-colors
              ${
                rule.severity === "warning"
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
              }
              ${!rule.enabled ? "cursor-not-allowed" : "cursor-pointer"}
            `}
            title="警告"
          >
            <FiAlertTriangle className="w-3 h-3" />
          </button>
          <button
            onClick={() => onChangeSeverity(rule.id, "error")}
            disabled={!rule.enabled}
            className={`
              flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-r-md border-y border-r transition-colors
              ${
                rule.severity === "error"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
              }
              ${!rule.enabled ? "cursor-not-allowed" : "cursor-pointer"}
            `}
            title="不正"
          >
            <FiXCircle className="w-3 h-3" />
          </button>
        </div>

        {/* 有効/無効トグル */}
        <button
          onClick={() => onToggleEnabled(rule.id, !rule.enabled)}
          className={`
            relative w-10 h-5 rounded-full transition-colors flex-shrink-0
            ${rule.enabled ? "bg-blue-500" : "bg-gray-300"}
          `}
          title={rule.enabled ? "無効にする" : "有効にする"}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200
              ${rule.enabled ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      {/* パラメータ編集パネル */}
      {hasParams && isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100">
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <h5 className="text-xs font-medium text-gray-600 mb-2">
              パラメータ設定
            </h5>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(rule.params).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">
                    {getParamLabel(key)}:
                  </label>
                  <input
                    type="number"
                    value={value as number}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    disabled={!rule.enabled}
                    step={key.includes("Multiplier") ? "0.1" : "1"}
                    className={`
                      w-20 px-2 py-1 text-xs border border-gray-200 rounded
                      focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                      ${!rule.enabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
                    `}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** パラメータキーの日本語ラベル */
function getParamLabel(key: string): string {
  const labels: Record<string, string> = {
    maxYearDiff: "年差上限",
    maxMonthDiff: "月差上限",
    lowerMultiplier: "下限IQR倍率",
    upperMultiplier: "上限IQR倍率",
    minSampleSize: "最小サンプル数",
  };
  return labels[key] || key;
}

export function ValidationRulesSettings() {
  const { rules, isLoading, error, updateRule, resetToDefault } =
    useValidationRulesStore();

  const [isResetting, setIsResetting] = useState(false);

  const handleToggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      updateRule(id, { enabled });
    },
    [updateRule]
  );

  const handleChangeSeverity = useCallback(
    (id: string, severity: "warning" | "error") => {
      updateRule(id, { severity });
    },
    [updateRule]
  );

  const handleUpdateParams = useCallback(
    (id: string, params: Record<string, number | string | boolean>) => {
      updateRule(id, { params });
    },
    [updateRule]
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

  // グループ化: 日付関連、金額関連、重複関連、勘定科目関連
  const dateRules = rules.filter((r) => r.type.startsWith("date-"));
  const amountRules = rules.filter((r) => r.type.startsWith("amount-"));
  const duplicateRules = rules.filter((r) => r.type.startsWith("duplicate-"));
  const accountRules = rules.filter((r) => r.type.startsWith("entertainment-"));

  const ruleGroups = [
    { title: "日付チェック", rules: dateRules },
    { title: "金額チェック", rules: amountRules },
    { title: "重複チェック", rules: duplicateRules },
    { title: "勘定科目チェック", rules: accountRules },
  ].filter((g) => g.rules.length > 0);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">
          バリデーションルール
        </h3>
        <p className="text-xs text-gray-500">
          レシートデータの検証ルールを設定します。ルールごとに有効/無効、重大度（警告・エラー）、パラメータを調整できます。
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* ルールグループ */}
      {ruleGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {group.title}
          </h4>
          <div className="space-y-2">
            {group.rules.map((rule) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                onToggleEnabled={handleToggleEnabled}
                onChangeSeverity={handleChangeSeverity}
                onUpdateParams={handleUpdateParams}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ボタン群 */}
      <div className="flex gap-2 pt-2">
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
          <FiRefreshCw
            className={`w-4 h-4 ${isResetting ? "animate-spin" : ""}`}
          />
          デフォルトに戻す
        </button>
      </div>

      {/* 空の状態 */}
      {rules.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">ルールが設定されていません</p>
          <p className="text-xs mt-1">
            「デフォルトに戻す」ボタンで初期ルールを復元してください
          </p>
        </div>
      )}
    </div>
  );
}
