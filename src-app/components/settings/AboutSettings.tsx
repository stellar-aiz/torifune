import { useState, useEffect } from "react";
import { FiChevronDown, FiChevronRight, FiExternalLink } from "react-icons/fi";
import { getVersion } from "@tauri-apps/api/app";

interface ThirdPartyLicense {
  name: string;
  license: string;
  url?: string;
}

const thirdPartyLicenses: ThirdPartyLicense[] = [
  { name: "Tauri", license: "Apache-2.0 OR MIT", url: "https://tauri.app/" },
  { name: "React", license: "MIT", url: "https://react.dev/" },
  { name: "TypeScript", license: "Apache-2.0", url: "https://www.typescriptlang.org/" },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com/" },
  { name: "pdfjs-dist", license: "Apache-2.0", url: "https://mozilla.github.io/pdf.js/" },
  { name: "react-icons", license: "MIT", url: "https://react-icons.github.io/react-icons/" },
];

export function AboutSettings() {
  const [version, setVersion] = useState<string>("");
  const [isLicensesExpanded, setIsLicensesExpanded] = useState(false);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("不明");
      }
    };
    loadVersion();
  }, []);

  return (
    <div className="space-y-6">
      {/* アプリ情報 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">アプリケーション情報</h3>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">アプリ名</span>
            <span className="text-sm font-medium text-gray-800">トリフネ</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">バージョン</span>
            <span className="text-sm font-medium text-gray-800">{version || "読み込み中..."}</span>
          </div>
        </div>
      </div>

      {/* ライセンス情報 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">ライセンス</h3>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">ライセンス</span>
            <span className="text-sm font-medium text-gray-800">Apache-2.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">著作権</span>
            <span className="text-sm font-medium text-gray-800">Copyright 2025 Stellar AIZ</span>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <a
              href="https://github.com/stellar-aiz/torifune/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              ライセンス全文を表示
              <FiExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* サードパーティライセンス */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">サードパーティライセンス</h3>

        <div className="bg-gray-50 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsLicensesExpanded(!isLicensesExpanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">
              使用しているオープンソースソフトウェア ({thirdPartyLicenses.length})
            </span>
            {isLicensesExpanded ? (
              <FiChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <FiChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {isLicensesExpanded && (
            <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
              {thirdPartyLicenses.map((lib) => (
                <div
                  key={lib.name}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    {lib.url ? (
                      <a
                        href={lib.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {lib.name}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-gray-800">{lib.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                    {lib.license}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
