import { useState } from "react";
import { syncVocab } from "../api";

export default function Settings() {
  const username = localStorage.getItem("username") ?? "learner";
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

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

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold mb-2">Account</h3>
        <p className="text-sm text-slate-600">Logged in as <span className="font-medium">{username}</span></p>
      </div>

      {/* Vocab sync */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Sync Vocab</h3>
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
      </div>

      {/* Preferences placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold mb-3">Preferences</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Auto-play audio on flashcards</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Show English translations</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
        </div>
      </div>
    </div>
  );
}
