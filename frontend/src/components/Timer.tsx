import { useEffect, useRef, useState } from "react";

interface Props {
  initialSeconds: number;
  onExpired: () => void;
  onExtend?: (extraSeconds: number) => void;
}

export default function Timer({ initialSeconds, onExpired, onExtend }: Props) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const deadlineRef = useRef(Date.now() + initialSeconds * 1000);
  const expiredRef = useRef(false);

  useEffect(() => {
    deadlineRef.current = Date.now() + initialSeconds * 1000;
    setRemaining(initialSeconds);
    expiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    const id = setInterval(() => {
      const secs = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
    }, 500);
    return () => clearInterval(id);
  }, [onExpired]);

  const extend = (extra: number) => {
    deadlineRef.current += extra * 1000;
    setRemaining((r) => r + extra);
    onExtend?.(extra);
  };

  const m = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const s = (remaining % 60).toString().padStart(2, "0");
  const urgent = remaining < 60;

  return (
    <div className="flex items-center gap-3">
      <span
        className={`font-mono text-2xl font-bold ${urgent ? "text-red-500 animate-pulse" : "text-slate-800"}`}
      >
        {m}:{s}
      </span>
      <button
        onClick={() => extend(300)}
        className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300"
      >
        +5 min
      </button>
    </div>
  );
}
