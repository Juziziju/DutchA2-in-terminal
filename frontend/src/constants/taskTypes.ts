export const TASK_TYPE_LABELS: Record<string, string> = {
  vocab_review: "Vocabulary Review",
  listening_quiz: "Listening Quiz",
  intensive: "Intensive Listening",
  reading: "Reading",
  writing: "Writing",
  shadow_reading: "Shadow Reading",
  speaking: "Speaking",
  knm: "KNM",
  exam: "Mock Exam",
};

export const TASK_TYPE_COLORS: Record<string, string> = {
  vocab_review: "bg-green-100 text-green-700",
  listening_quiz: "bg-blue-100 text-blue-700",
  intensive: "bg-amber-100 text-amber-700",
  reading: "bg-purple-100 text-purple-700",
  writing: "bg-rose-100 text-rose-700",
  shadow_reading: "bg-cyan-100 text-cyan-700",
  speaking: "bg-teal-100 text-teal-700",
  knm: "bg-indigo-100 text-indigo-700",
  exam: "bg-red-100 text-red-700",
};

export const TASK_TYPE_ROUTES: Record<string, string> = {
  vocab_review: "/vocab-refresh",
  listening_quiz: "/study/listening",
  intensive: "/study/listening",
  reading: "/study/reading",
  writing: "/study/writing",
  shadow_reading: "/study/speaking",
  speaking: "/study/speaking",
  knm: "/study/knm",
  exam: "/exam",
};
