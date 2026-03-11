import { useCallback, useEffect, useRef, useState } from "react";
import { translatePhrase, savePersonalVocab } from "../api";

interface TextSelectionPopupProps {
  containerRef: React.RefObject<HTMLElement | null>;
  source: "reading" | "knm";
  getContext?: (selectedText: string) => string;
}

export default function TextSelectionPopup({ containerRef, source, getContext }: TextSelectionPopupProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef("");

  const close = useCallback(() => {
    setVisible(false);
    setSelectedText("");
    setTranslation("");
    setSaved(false);
    setLoading(false);
    setSaving(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSelection = (e: Event) => {
      // Ignore events from within the popup itself (e.g. clicking Save)
      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return;
      }

      const text = sel.toString().trim();
      if (text.length < 1 || text.length > 200) return;

      // Make sure selection is inside our container
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setPos({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
      setSelectedText(text);
      contextRef.current = getContext ? getContext(text) : "";
      setTranslation("");
      setSaved(false);
      setVisible(true);

      // Auto-translate
      setLoading(true);
      translatePhrase(text, contextRef.current)
        .then((res) => setTranslation(res.english))
        .catch(() => setTranslation("Translation failed"))
        .finally(() => setLoading(false));
    };

    container.addEventListener("mouseup", handleSelection);
    container.addEventListener("touchend", handleSelection);

    return () => {
      container.removeEventListener("mouseup", handleSelection);
      container.removeEventListener("touchend", handleSelection);
    };
  }, [containerRef, getContext, close]);

  // Close on escape or click outside
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Delay to avoid catching the same mouseup
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(timer);
    };
  }, [visible, close]);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!translation || saving || saved) return;
    setSaving(true);
    savePersonalVocab({
      dutch: selectedText,
      english: translation,
      source,
      context_sentence: contextRef.current,
    })
      .then(() => setSaved(true))
      .catch((err) => { console.error("Save personal vocab failed:", err); })
      .finally(() => setSaving(false));
  };

  if (!visible) return null;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3 w-64 transform -translate-x-1/2 -translate-y-full"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />

      <p className="text-sm font-semibold text-blue-700 mb-1 truncate">{selectedText}</p>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Translating...
        </div>
      )}

      {!loading && translation && (
        <>
          <p className="text-sm text-slate-700 mb-2">{translation}</p>
          {saved ? (
            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved to notebook
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full text-xs bg-blue-600 text-white py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save to Notebook"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
