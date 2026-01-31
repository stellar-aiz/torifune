import { useState, useEffect } from "react";
import { FiAlertCircle, FiZap } from "react-icons/fi";
import {
  getCurrentUsage,
  type CurrentUsageResponse,
} from "../../services/api/usage";

/** 使用量の状態に応じた色設定 */
type UsageLevel = "normal" | "warning" | "critical";

function getUsageLevel(percentage: number): UsageLevel {
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "warning";
  return "normal";
}

const levelStyles: Record<
  UsageLevel,
  { bar: string; text: string; bg: string }
> = {
  normal: {
    bar: "bg-green-500",
    text: "text-green-600",
    bg: "bg-green-50",
  },
  warning: {
    bar: "bg-yellow-500",
    text: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  critical: {
    bar: "bg-red-500",
    text: "text-red-600",
    bg: "bg-red-50",
  },
};

interface UsageIndicatorProps {
  /** アップグレードボタンクリック時のハンドラ */
  onUpgrade?: () => void;
  /** コンパクト表示モード（サイドバー用） */
  compact?: boolean;
}

export function UsageIndicator({
  onUpgrade,
  compact = false,
}: UsageIndicatorProps) {
  const [usage, setUsage] = useState<CurrentUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCurrentUsage();
        setUsage(data);
      } catch (err) {
        console.error("Failed to fetch usage:", err);
        setError("使用量を取得できませんでした");
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className={`${compact ? "px-3 py-2" : "p-4"}`}>
        <div className="animate-pulse">
          <div className="h-2 bg-gray-200 rounded w-full mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className={`${compact ? "px-3 py-2" : "p-4"} text-xs text-gray-500`}>
        <div className="flex items-center gap-1">
          <FiAlertCircle className="w-3 h-3" />
          <span>{error || "使用量を取得できませんでした"}</span>
        </div>
      </div>
    );
  }

  const percentage =
    usage.limit > 0
      ? Math.min((usage.processedCount / usage.limit) * 100, 100)
      : 0;
  const level = getUsageLevel(percentage);
  const styles = levelStyles[level];
  const isOverLimit = usage.processedCount >= usage.limit;

  if (compact) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">今月の使用量</span>
          <span className={`text-xs font-medium ${styles.text}`}>
            {usage.processedCount}/{usage.limit}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${styles.bar}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isOverLimit && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded transition-colors"
          >
            <FiZap className="w-3 h-3" />
            Upgrade
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg ${styles.bg} border border-gray-100`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">今月の使用量</h3>
        <span className={`text-sm font-semibold ${styles.text}`}>
          {usage.processedCount} / {usage.limit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${styles.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {Math.round(percentage)}% 使用中
        </span>
        {isOverLimit && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1 px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <FiZap className="w-3 h-3" />
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}
