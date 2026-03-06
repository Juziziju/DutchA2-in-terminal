import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askAdvisorStream, AdvisorTask } from "../api";
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from "../constants/taskTypes";

interface Message {
  role: "user" | "advisor";
  content: string;
  tasks?: AdvisorTask[];
  streaming?: boolean;
}

const STORAGE_KEY = "advisor_messages";
const LOADING_KEY = "advisor_loading";

// Module-level state so streaming survives unmount/remount
let _pendingAbort: AbortController | null = null;

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try {
    // Don't save streaming partial messages
    const toSave = msgs.map(m => ({ ...m, streaming: undefined }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

function parseAdvisorTasks(raw: string): { reply: string; tasks: AdvisorTask[] } {
  // Strip <think>...</think> blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Strip markdown fences
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    const end = lines[lines.length - 1].trim() === "```" ? lines.length - 1 : lines.length;
    cleaned = lines.slice(1, end).join("\n");
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === "string") {
      const tasks = (parsed.suggested_tasks ?? []).filter(
        (t: any) => t?.task_type && t?.description && t?.route
      );
      return { reply: parsed.reply, tasks };
    }
  } catch {}
  return { reply: raw, tasks: [] };
}

const SUGGESTIONS = [
  "What should I focus on this week?",
  "How is my listening progress?",
  "Am I ready for the exam?",
  "Analyze my vocabulary weak spots",
];

export default function Advisor() {
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(!!localStorage.getItem(LOADING_KEY));
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const username = localStorage.getItem("username") ?? "You";
  const userInitial = username.charAt(0).toUpperCase();

  // Sync messages from localStorage on mount (picks up results from background requests)
  useEffect(() => {
    const stored = loadMessages();
    setMessages(stored);
    setLoading(!!localStorage.getItem(LOADING_KEY));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save non-streaming messages
  useEffect(() => {
    if (!messages.some(m => m.streaming)) {
      saveMessages(messages);
    }
  }, [messages]);

  // Poll localStorage for updates when loading (background request may have finished)
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      if (!localStorage.getItem(LOADING_KEY)) {
        setMessages(loadMessages());
        setLoading(false);
      } else {
        // Check for streaming partial update
        const stored = loadMessages();
        if (stored.length > messages.length || (stored.length > 0 && stored[stored.length - 1].content !== messages[messages.length - 1]?.content)) {
          setMessages(stored);
        }
      }
    }, 300);
    return () => clearInterval(interval);
  }, [loading, messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: trimmed };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    saveMessages(newMsgs);
    setLoading(true);
    localStorage.setItem(LOADING_KEY, "1");

    // Start streaming in module scope so it survives unmount
    _pendingAbort?.abort();
    const abort = new AbortController();
    _pendingAbort = abort;

    const streamingMsg: Message = { role: "advisor", content: "", streaming: true };
    const withStreaming = [...newMsgs, streamingMsg];

    try {
      const fullText = await askAdvisorStream(
        trimmed,
        (partial) => {
          // Update both state and localStorage with partial content
          const updated = [...newMsgs, { role: "advisor" as const, content: partial, streaming: true }];
          // Only update state if component is still mounted (React handles this gracefully)
          setMessages(updated);
        },
        abort.signal,
      );

      // Parse final response for tasks
      const { reply, tasks } = parseAdvisorTasks(fullText);
      const finalMsgs: Message[] = [...newMsgs, { role: "advisor", content: reply, tasks }];
      setMessages(finalMsgs);
      saveMessages(finalMsgs);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errMsgs: Message[] = [...newMsgs, { role: "advisor", content: `Error: ${err.message}` }];
        setMessages(errMsgs);
        saveMessages(errMsgs);
      }
    } finally {
      localStorage.removeItem(LOADING_KEY);
      setLoading(false);
      _pendingAbort = null;
      inputRef.current?.focus();
    }
  }

  function clearHistory() {
    _pendingAbort?.abort();
    _pendingAbort = null;
    setMessages([]);
    setLoading(false);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOADING_KEY);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-600">AI Advisor</span>
          </div>
          <button
            onClick={clearHistory}
            className="text-xs text-slate-400 hover:text-red-500 transition"
          >
            Clear chat
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">
              AI Learning Advisor
            </h2>
            <p className="text-slate-500 mb-6 max-w-md">
              Ask me anything about your Dutch learning progress. I have access
              to all your study data and can give personalized advice.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "advisor" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-800"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || "\u200B"}
                    </ReactMarkdown>
                    {msg.streaming && <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 rounded-sm align-text-bottom" />}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-xs font-bold">{userInitial}</span>
                </div>
              )}
            </div>

            {msg.tasks && msg.tasks.length > 0 && (
              <div className="mt-2 ml-11 space-y-2 max-w-[80%]">
                {msg.tasks.map((task, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:shadow-sm transition"
                  >
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        TASK_TYPE_COLORS[task.task_type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {TASK_TYPE_LABELS[task.task_type] ?? task.task_type}
                    </span>
                    <span className="text-sm text-slate-700 flex-1">{task.description}</span>
                    <button
                      onClick={() => nav(task.route)}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition font-medium flex-shrink-0"
                    >
                      Go
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && !messages.some(m => m.streaming) && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="animate-bounce [animation-delay:-0.3s]">.</span>
                <span className="animate-bounce [animation-delay:-0.15s]">.</span>
                <span className="animate-bounce">.</span>
                <span className="ml-2">Thinking</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200 bg-white rounded-xl shadow-sm p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your learning progress..."
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 max-h-32"
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
