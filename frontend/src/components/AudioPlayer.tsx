import { useEffect, useRef, useState } from "react";

interface Props {
  src: string | null;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

export default function AudioPlayer({ src, autoPlay = false, onEnded, className = "" }: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(false);
    if (src && autoPlay && ref.current) {
      ref.current.play().catch((err) => {
        if (err.name === "NotAllowedError") {
          setBlocked(true);
        }
        console.warn("[AudioPlayer] autoplay blocked:", err.name);
      });
    }
  }, [src, autoPlay]);

  if (!src) return null;

  return (
    <div>
      {blocked && (
        <button
          onClick={() => {
            setBlocked(false);
            ref.current?.play().catch(() => {});
          }}
          className="w-full mb-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
          Tap to play audio
        </button>
      )}
      <audio
        ref={ref}
        src={src}
        controls
        onEnded={onEnded}
        className={className}
        style={{ width: "100%" }}
      />
    </div>
  );
}

/** Imperative play trigger without showing controls */
export function useAudioPlay(src: string | null) {
  const play = () => {
    if (!src) return;
    const audio = new Audio(src);
    audio.play().catch((err) => {
      console.warn("[useAudioPlay] play failed:", err.name, src);
    });
  };
  return play;
}
