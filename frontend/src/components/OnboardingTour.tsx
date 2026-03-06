import { useCallback, useEffect, useRef, useState } from "react";

export interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
  /** If true, expand sidebar and study submenu before this step */
  needsSidebar?: boolean;
}

interface Props {
  steps: TourStep[];
  onComplete: () => void;
}

const COOKIE_NAME = "dutch_a2_tour_done";

export function isTourDone(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
}

export function setTourDone() {
  document.cookie = `${COOKIE_NAME}=1; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
}

export default function OnboardingTour({ steps, onComplete }: Props) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isLast = current === steps.length - 1;

  const measureTarget = useCallback(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Small delay to let scroll settle
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect(r);
      }, 350);
    } else {
      setRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    measureTarget();
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [measureTarget]);

  const finish = useCallback(() => {
    setTourDone();
    onComplete();
  }, [onComplete]);

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const back = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  if (!rect) {
    // Still loading / target not found — show a minimal overlay
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-2xl max-w-xs text-center">
          <p className="text-sm text-slate-500">Loading tour...</p>
          <button onClick={finish} className="mt-3 text-xs text-slate-400 hover:text-slate-600">
            Skip tour
          </button>
        </div>
      </div>
    );
  }

  // Tooltip positioning
  const gap = 12;
  const isMobile = window.innerWidth < 768;
  const placement = isMobile ? "bottom" : step.placement;

  let tooltipStyle: React.CSSProperties = { position: "fixed", maxWidth: 320, zIndex: 10001 };

  if (placement === "bottom") {
    tooltipStyle.top = rect.bottom + gap;
    tooltipStyle.left = Math.max(16, rect.left + rect.width / 2 - 160);
  } else if (placement === "top") {
    tooltipStyle.bottom = window.innerHeight - rect.top + gap;
    tooltipStyle.left = Math.max(16, rect.left + rect.width / 2 - 160);
  } else if (placement === "right") {
    tooltipStyle.top = rect.top + rect.height / 2 - 60;
    tooltipStyle.left = rect.right + gap;
  } else {
    tooltipStyle.top = rect.top + rect.height / 2 - 60;
    tooltipStyle.right = window.innerWidth - rect.left + gap;
  }

  // Clamp to viewport
  if (isMobile) {
    tooltipStyle.left = 16;
    tooltipStyle.right = 16;
    tooltipStyle.maxWidth = undefined;
  }

  // Arrow style
  const arrowSize = 8;
  let arrowStyle: React.CSSProperties = { position: "absolute", width: 0, height: 0 };
  if (placement === "bottom") {
    arrowStyle.top = -arrowSize;
    arrowStyle.left = Math.min(rect.left + rect.width / 2 - (typeof tooltipStyle.left === "number" ? tooltipStyle.left : 16), 280);
    arrowStyle.borderLeft = `${arrowSize}px solid transparent`;
    arrowStyle.borderRight = `${arrowSize}px solid transparent`;
    arrowStyle.borderBottom = `${arrowSize}px solid white`;
  } else if (placement === "top") {
    arrowStyle.bottom = -arrowSize;
    arrowStyle.left = Math.min(rect.left + rect.width / 2 - (typeof tooltipStyle.left === "number" ? tooltipStyle.left : 16), 280);
    arrowStyle.borderLeft = `${arrowSize}px solid transparent`;
    arrowStyle.borderRight = `${arrowSize}px solid transparent`;
    arrowStyle.borderTop = `${arrowSize}px solid white`;
  } else if (placement === "right") {
    arrowStyle.left = -arrowSize;
    arrowStyle.top = 20;
    arrowStyle.borderTop = `${arrowSize}px solid transparent`;
    arrowStyle.borderBottom = `${arrowSize}px solid transparent`;
    arrowStyle.borderRight = `${arrowSize}px solid white`;
  } else {
    arrowStyle.right = -arrowSize;
    arrowStyle.top = 20;
    arrowStyle.borderTop = `${arrowSize}px solid transparent`;
    arrowStyle.borderBottom = `${arrowSize}px solid transparent`;
    arrowStyle.borderLeft = `${arrowSize}px solid white`;
  }

  const pad = 6;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay — click to skip */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={finish}
      />

      {/* Cutout highlight */}
      <div
        className="absolute rounded-lg"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          zIndex: 10000,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="bg-white rounded-xl shadow-2xl p-5 transition-all duration-300"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        <div style={arrowStyle} />

        {/* Step counter */}
        <p className="text-xs text-slate-400 mb-1">
          {current + 1} / {steps.length}
        </p>

        <h3 className="text-sm font-bold text-slate-800 mb-1">{step.title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>

        {/* Buttons */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={finish}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {current > 0 && (
              <button
                onClick={back}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
