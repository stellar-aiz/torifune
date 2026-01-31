import { useState, useRef, useCallback, type ReactNode } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Tooltip content - can be a string or ReactNode */
  content: ReactNode;
  /** Position of the tooltip relative to the trigger element */
  position?: TooltipPosition;
  /** Delay in milliseconds before showing the tooltip */
  delay?: number;
  /** The trigger element */
  children: ReactNode;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-gray-700 border-x-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-gray-700 border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-gray-700 border-y-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-gray-700 border-y-transparent border-l-transparent",
};

export function Tooltip({
  content,
  position = "top",
  delay = 300,
  children,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      <div
        role="tooltip"
        className={`
          absolute z-50 px-2 py-1 text-xs text-white bg-gray-700 rounded shadow-md
          whitespace-nowrap pointer-events-none
          transition-opacity duration-150
          ${positionStyles[position]}
          ${isVisible ? "opacity-100" : "opacity-0"}
        `}
      >
        {content}
        {/* Arrow */}
        <span
          className={`
            absolute w-0 h-0 border-4
            ${arrowStyles[position]}
          `}
        />
      </div>
    </div>
  );
}
