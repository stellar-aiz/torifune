import { FaGoogle, FaMicrosoft, FaSlack } from "react-icons/fa";
import { FiLoader } from "react-icons/fi";

type Provider = "google" | "microsoft" | "slack";

interface LoginButtonProps {
  provider: Provider;
  onClick: () => void;
  isLoading?: boolean;
}

const providerConfig: Record<
  Provider,
  {
    label: string;
    icon: React.ReactNode;
    className: string;
  }
> = {
  google: {
    label: "Googleでログイン",
    icon: <FaGoogle className="w-5 h-5" />,
    className: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  },
  microsoft: {
    label: "Microsoftでログイン",
    icon: <FaMicrosoft className="w-5 h-5" />,
    className: "bg-[#2F2F2F] text-white hover:bg-[#404040]",
  },
  slack: {
    label: "Slackでログイン",
    icon: <FaSlack className="w-5 h-5" />,
    className: "bg-[#4A154B] text-white hover:bg-[#5C1E5E]",
  },
};

export function LoginButton({
  provider,
  onClick,
  isLoading,
}: LoginButtonProps) {
  const config = providerConfig[provider];

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      aria-label={config.label}
      className={`
        w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg text-sm font-medium transition-colors
        ${config.className}
        ${isLoading ? "opacity-70 cursor-wait" : "cursor-pointer"}
      `}
    >
      {isLoading ? <FiLoader className="w-5 h-5 animate-spin" /> : config.icon}
      <span>{config.label}</span>
    </button>
  );
}
