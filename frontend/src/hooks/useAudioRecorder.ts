import { useCallback, useRef, useState } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const preAcquiredStreamRef = useRef<MediaStream | null>(null);

  /** Call from a user gesture to acquire mic early. Returns null on success, error string on failure. */
  const acquireStream = useCallback(async (): Promise<string | null> => {
    try {
      // Release any previous pre-acquired stream
      if (preAcquiredStreamRef.current) {
        preAcquiredStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      preAcquiredStreamRef.current = stream;
      setPermissionDenied(false);
      setError(null);
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setPermissionDenied(true);
      }
      setError(msg);
      return msg;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setPermissionDenied(false);
    chunksRef.current = [];
    try {
      // Use pre-acquired stream if available, otherwise request new one
      const stream = preAcquiredStreamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      preAcquiredStreamRef.current = null;
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const actualType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setPermissionDenied(true);
      }
      setError(msg);
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    setPermissionDenied(false);
    chunksRef.current = [];
    // Also release any pre-acquired stream
    if (preAcquiredStreamRef.current) {
      preAcquiredStreamRef.current.getTracks().forEach((t) => t.stop());
      preAcquiredStreamRef.current = null;
    }
  }, []);

  return { isRecording, audioBlob, error, permissionDenied, start, stop, reset, acquireStream, streamRef };
}
