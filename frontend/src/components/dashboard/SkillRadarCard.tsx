import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import type { SkillSnapshotItem } from "../../api";

const ALL_SKILLS = ["listening", "speaking", "reading", "writing", "knm"];

interface Props {
  snapshots: SkillSnapshotItem[];
}

export default function SkillRadarCard({ snapshots }: Props) {
  const bySkill = Object.fromEntries(snapshots.map(s => [s.skill, s]));
  const data = ALL_SKILLS.map(skill => ({
    skill: skill.charAt(0).toUpperCase() + skill.slice(1),
    score: bySkill[skill]?.avg_score ?? 0,
  }));

  const hasData = snapshots.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Skill Radar</h3>
      {!hasData ? (
        <p className="text-sm text-slate-400 py-8 text-center">Complete assessments to see your skill profile.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "#64748b" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
            <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
