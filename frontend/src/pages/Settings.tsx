import { useEffect, useState } from "react";
import { syncVocab, getPlannerProfile, enablePlanner, disablePlanner, PlannerProfile } from "../api";

export default function Settings() {
  const username = localStorage.getItem("username") ?? "learner";
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
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
