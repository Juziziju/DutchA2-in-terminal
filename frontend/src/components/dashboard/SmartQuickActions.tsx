import { useNavigate } from "react-router-dom";

interface Props {
  dueToday: number;
  leastPracticedSkill: string | null;
}

const SKILL_ROUTES: Record<string, string> = {
  listening_quiz: "/study/listening",
  intensive: "/study/listening",
  reading: "/study/reading",
  writing: "/study/writing",
  shadow_reading: "/study/speaking",
  vocab_review: "/vocab-refresh",
  speaking: "/study/speaking",
  knm: "/study/knm",
};

export default function SmartQuickActions({ dueToday, leastPracticedSkill }: Props) {
  const nav = useNavigate();

  const weakRoute = leastPracticedSkill ? SKILL_ROUTES[leastPracticedSkill] ?? "/study/listening" : "/study/listening";
  const weakLabel = leastPracticedSkill
    ? leastPracticedSkill.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Study";

  const actions = [
    {
      title: "Vocab Refresh",
      subtitle: `${dueToday} cards due`,
      gradient: "from-blue-500 to-cyan-400",
      route: "/vocab-refresh",
    },
    {
      title: "Listening Practice",
      subtitle: "Quiz or dictation",
      gradient: "from-indigo-500 to-purple-400",
      route: "/study/listening",
    },
    {
      title: `Practice ${weakLabel}`,
      subtitle: "Your weakest skill",
      gradient: "from-orange-500 to-amber-400",
      route: weakRoute,
    },
    {
      title: "AI Advisor",
      subtitle: "Get study tips",
      gradient: "from-violet-500 to-fuchsia-400",
      route: "/advisor",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map(a => (
        <button
          key={a.title}
          onClick={() => nav(a.route)}
          className={`bg-gradient-to-br ${a.gradient} rounded-2xl p-4 text-left text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}
        >
          <p className="font-semibold text-sm">{a.title}</p>
          <p className="text-xs text-white/80 mt-1">{a.subtitle}</p>
        </button>
      ))}
    </div>
  );
}
