import { useEffect, useRef, useState } from "react";
import { syncVocab, previewVocabCsv, confirmVocabCsv, PreviewWord, getPlannerProfile, enablePlanner, disablePlanner, PlannerProfile } from "../api";

const CATEGORIES = [
  "General",
  "Greetings & Phrases",
  "Family & People",
  "Food & Drink",
  "Shopping & Money",
  "Numbers",
  "Time & Calendar",
  "Colors",
  "Places & Directions",
  "Countries & Nationality",
  "Transport & Travel",
  "Daily Life",
  "Sports & Hobbies",
  "Describing Things",
  "Language & Communication",
  "Weather & Seasons",
  "Celebrations",
  "Hotel & Accommodation",
];

export default function Settings() {
  const username = localStorage.getItem("username") ?? "learner";
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewWords, setPreviewWords] = useState<PreviewWord[] | null>(null);
  const [previewSkipped, setPreviewSkipped] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [plannerProfile, setPlannerProfile] = useState<PlannerProfile | null>(null);
  const [togglingPlanner, setTogglingPlanner] = useState(false);

  useEffect(() => {
    getPlannerProfile().then(setPlannerProfile).catch(() => {});
  }, []);

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

      {/* Upload vocab CSV */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Upload Vocab CSV</h3>
            <p className="text-xs text-slate-500">Upload a CSV with columns: dutch, english, category, example_dutch, example_english</p>
            {uploadMsg && <p className="text-xs text-blue-600 mt-1">{uploadMsg}</p>}
          </div>
          {!previewWords && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadMsg("");
                  try {
                    const r = await previewVocabCsv(file);
                    if (r.preview.length === 0) {
                      setUploadMsg(`No new words found (${r.skipped} skipped/duplicate)`);
                    } else {
                      setPreviewWords(r.preview);
                      setPreviewSkipped(r.skipped);
                      setUploadMsg("");
                    }
                  } catch (err: unknown) {
                    setUploadMsg(err instanceof Error ? err.message : "Preview failed");
                  } finally {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {uploading ? "Parsing..." : "Upload"}
              </button>
            </div>
          )}
        </div>

        {/* Preview table */}
        {previewWords && (
          <>
            <p className="text-xs text-slate-500">
              {previewWords.length} new word{previewWords.length !== 1 && "s"} to add
              {previewSkipped > 0 && `, ${previewSkipped} skipped (duplicate/empty)`}
            </p>
            <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Dutch</th>
                    <th className="text-left px-2 py-1 font-medium">English</th>
                    <th className="text-left px-2 py-1 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {previewWords.map((w, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1">{w.dutch}</td>
                      <td className="px-2 py-1">{w.english}</td>
                      <td className="px-2 py-1">
                        <select
                          value={w.category}
                          onChange={(e) => {
                            const updated = [...previewWords];
                            updated[i] = { ...w, category: e.target.value };
                            setPreviewWords(updated);
                          }}
                          className="text-xs border border-slate-200 rounded px-1 py-0.5 w-full"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPreviewWords(null); setPreviewSkipped(0); setUploadMsg(""); }}
                className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={confirming}
                onClick={async () => {
                  setConfirming(true);
                  try {
                    const r = await confirmVocabCsv(previewWords);
                    let msg = `Added ${r.added} word${r.added !== 1 ? "s" : ""}`;
                    if (r.skipped) msg += `, ${r.skipped} skipped`;
                    if (r.audio_errors) msg += `, ${r.audio_errors} audio errors`;
                    setUploadMsg(msg);
                    setPreviewWords(null);
                    setPreviewSkipped(0);
                  } catch (err: unknown) {
                    setUploadMsg(err instanceof Error ? err.message : "Confirm failed");
                  } finally {
                    setConfirming(false);
                  }
                }}
                className="text-sm bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {confirming ? "Saving..." : `Confirm ${previewWords.length} words`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Learning Planner */}
      {plannerProfile && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Learning Planner</h3>
              <p className="text-xs text-slate-500">
                {plannerProfile.planner_enabled ? (
                  <>
                    Enabled · Level: <span className="font-medium">{plannerProfile.current_level ?? "—"}</span>
                    {plannerProfile.goal && <> · Goal: <span className="font-medium">{plannerProfile.goal}</span></>}
                  </>
                ) : "Disabled — enable for personalized daily plans"}
              </p>
            </div>
            <button
              onClick={async () => {
                setTogglingPlanner(true);
                try {
                  if (plannerProfile.planner_enabled) {
                    await disablePlanner();
                    setPlannerProfile({ ...plannerProfile, planner_enabled: false });
                  } else {
                    await enablePlanner();
                    setPlannerProfile({ ...plannerProfile, planner_enabled: true });
                  }
                } catch {} finally { setTogglingPlanner(false); }
              }}
              disabled={togglingPlanner}
              className={`text-sm px-3 py-1.5 rounded-lg disabled:opacity-50 transition ${
                plannerProfile.planner_enabled
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              {togglingPlanner ? "..." : plannerProfile.planner_enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      )}

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
