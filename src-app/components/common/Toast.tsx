import { useEffect, useState } from "react";
import { FiCheck, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";

interface ToastProps {
  message: string;
  type?: "success" | "warning" | "info";
  onClose: () => void;
}

export function Toast({ message, type = "info", onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200); // Wait for fade out
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: "bg-green-600",
    warning: "bg-yellow-500",
    info: "bg-blue-600",
  }[type];

  const Icon = {
    success: FiCheck,
    warning: FiAlertTriangle,
    info: FiInfo,
  }[type];

  function handleClose(): void {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm
          transition-all duration-200
          ${bgColor}
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
        `}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{message}</span>
        <button
          onClick={handleClose}
          className="ml-2 p-0.5 hover:bg-white/20 rounded transition-colors"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
