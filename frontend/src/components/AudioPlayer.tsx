import { useEffect, useRef } from "react";

interface Props {
  src: string | null;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

export default function AudioPlayer({ src, autoPlay = false, onEnded, className = "" }: Props) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (src && autoPlay && ref.current) {
      ref.current.play().catch(() => {});
    }
  }, [src, autoPlay]);

  if (!src) return null;

  return (
    <audio
      ref={ref}
      src={src}
      controls
      onEnded={onEnded}
      className={className}
      style={{ width: "100%" }}
    />
  );
}

/** Imperative play trigger without showing controls */
export function useAudioPlay(src: string | null) {
  const play = () => {
    if (!src) return;
    const audio = new Audio(src);
    audio.play().catch(() => {});
  };
  return play;
}
