import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlashcardStats, getFlashcardResults, syncVocab } from "../api";

export default function Home() {
  const nav = useNavigate();
  const username = localStorage.getItem("username") ?? "learner";
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    getFlashcardResults().then(setStats).catch(() => {});
  }, []);

  function logout() {
    localStorage.clear();
    nav("/login");
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await syncVocab();
      setSyncMsg(r.detail);
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const tiles = [
    {
      label: "Flashcards",
      desc: "Spaced repetition",
      icon: "🗂️",
      path: "/flashcards",
      badge: stats ? `${stats.due_today} due` : undefined,
    },
    {
      label: "Listening",
      desc: "AI dialogue + quiz",
      icon: "🎧",
      path: "/listening",
    },
    {
      label: "Mock Exam",
      desc: "Inburgeringsexamen A2",
      icon: "📋",
      path: "/exam",
    },
    {
      label: "Results",
      desc: "History & progress",
      icon: "📊",
      path: "/results",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">Dutch A2 Blitz</h1>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm">{username}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {/* Flashcard stats strip */}
        {stats && (
          <div className="flex gap-4 mb-6 text-center">
            {[
              { label: "Due today", value: stats.due_today },
              { label: "Mastered", value: stats.mastered },
              { label: "Reviewed", value: stats.total_reviewed },
            ].map((s) => (
              <div
                key={s.label}
                className="flex-1 bg-white rounded-xl border border-slate-200 py-3"
              >
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Navigation tiles */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {tiles.map((t) => (
            <button
              key={t.path}
              onClick={() => nav(t.path)}
              className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <span className="text-3xl">{t.icon}</span>
              <p className="font-semibold mt-2">{t.label}</p>
              <p className="text-sm text-slate-500">{t.desc}</p>
              {t.badge && (
                <span className="mt-2 inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sync vocab */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Sync Vocab</p>
            <p className="text-xs text-slate-500">Import latest vocab_input.csv into the database</p>
            {syncMsg && <p className="text-xs text-blue-600 mt-1">{syncMsg}</p>}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </main>
    </div>
  );
}
