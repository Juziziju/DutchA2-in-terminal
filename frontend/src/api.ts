/** Typed fetch wrappers for all backend endpoints. */

// In dev: Vite proxy forwards to localhost:8000.
// In prod: same origin — FastAPI serves both API and frontend.
const BASE = "";

// Supabase Storage public URL base for audio files
const SUPABASE_AUDIO = "https://nqkxsfojfovlttqthxnw.supabase.co/storage/v1/object/public/audio";

function sanitizeFilename(filename: string): string {
  // Match backend _sanitize: strip accents, keep ASCII
  return filename.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]/g, "_");
}

export function vocabAudioUrl(filename: string): string {
  return `${SUPABASE_AUDIO}/vocab/${sanitizeFilename(filename)}`;
}

export function listeningAudioUrl(filename: string): string {
  return `${SUPABASE_AUDIO}/listening/${sanitizeFilename(filename)}`;
}

export function speakingAudioUrl(filename: string): string {
  return `${SUPABASE_AUDIO}/speaking/${sanitizeFilename(filename)}`;
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | boolean>
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    url += "?" + qs;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export function register(username: string, password: string) {
  return request<TokenResponse>("POST", "/auth/register", { username, password });
}

export function login(username: string, password: string) {
  return request<TokenResponse>("POST", "/auth/login", { username, password });
}

// ── Vocab ─────────────────────────────────────────────────────────────────────

export interface VocabItem {
  id: number;
  dutch: string;
  english: string;
  category: string;
  example_dutch: string;
  example_english: string;
  audio_file: string;
}

export function getVocab() {
  return request<VocabItem[]>("GET", "/vocab");
}

export function syncVocab() {
  return request<{ detail: string }>("POST", "/vocab/sync");
}

export async function uploadVocabCsv(file: File): Promise<{ added: number; skipped: number; audio_errors?: number; columns_detected?: string[] }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(BASE + "/vocab/upload-csv", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export interface CardOut {
  progress_id: number;
  vocab_id: number;
  dutch: string;
  english: string;
  category: string;
  example_dutch: string;
  example_english: string;
  audio_file: string;
  direction: "nl_en" | "en_nl";
  is_new: boolean;
}

export interface SessionOut {
  cards: CardOut[];
  due_count: number;
  new_count: number;
}

export function getFlashcardSession(directions = "nl_en,en_nl") {
  return request<SessionOut>("GET", "/flashcards/session", undefined, { directions });
}

export type Rating = "again" | "hard" | "good" | "easy" | "mastered";

export interface ReviewOut {
  next_review: string;
  interval: number;
  ease_factor: number;
  mastered: boolean;
}

export function submitReview(
  progress_id: number,
  rating: Rating,
  vocab_id?: number,
  direction?: string,
) {
  return request<ReviewOut>("POST", "/flashcards/review", {
    progress_id,
    rating,
    ...(vocab_id !== undefined && { vocab_id }),
    ...(direction && { direction }),
  });
}

// ── Vocab Notebook ───────────────────────────────────────────────────────────

export type VocabLevel = "new" | "hard" | "learning" | "familiar" | "mastered";

export interface VocabNoteItem {
  vocab_id: number;
  dutch: string;
  english: string;
  category: string;
  example_dutch: string;
  example_english: string;
  audio_file: string;
  level: VocabLevel;
  next_review: string | null;
  ease_factor: number | null;
  interval: number | null;
}

export interface VocabNotebookOut {
  items: VocabNoteItem[];
  counts: Record<VocabLevel, number>;
}

export function getVocabNotebook() {
  return request<VocabNotebookOut>("GET", "/flashcards/notebook");
}

// ── Listening ─────────────────────────────────────────────────────────────────

export interface DialogueLine {
  speaker: string;
  text: string;
  english: string;
  audio_file: string | null;
}

export interface Question {
  question: string;
  options: Record<string, string>;
  answer: string;
}

export interface GenerateResponse {
  session_id: string;
  topic: string;
  speakers: string[];
  dialogue: DialogueLine[];
  questions: Question[];
  vocab_used: string[];
  level: string;
}

export function generateListening(mode?: string, level?: string, topic?: string) {
  return request<GenerateResponse>("POST", "/listening/generate", { mode: mode ?? "quiz", level: level ?? "A2", topic: topic ?? "" });
}

export interface SubmitListeningRequest {
  session_id: string;
  topic: string;
  dialogue: DialogueLine[];
  questions: Question[];
  user_answers: string[];
  vocab_used: string[];
  mode?: string;
  level?: string;
  duration_seconds?: number;
}

export interface SubmitListeningResponse {
  score: number;
  total: number;
  score_pct: number;
  correct: boolean[];
  explanation: string | null;
}

export function submitListening(
  req: SubmitListeningRequest,
  include_explanation = false
) {
  return request<SubmitListeningResponse>(
    "POST",
    "/listening/submit",
    req,
    { include_explanation }
  );
}

export function explainListening(
  topic: string,
  dialogue: DialogueLine[],
  questions: Question[],
  user_answers: string[],
  level?: string
) {
  return request<{ explanation: string }>("POST", "/listening/explain", {
    topic,
    dialogue,
    questions,
    user_answers,
    level: level ?? "A2",
  });
}

// ── Intensive Listening ──────────────────────────────────────────────────────

export interface IntensiveLine {
  speaker: string;
  text: string;
  english: string;
  audio_file: string | null;
}

export interface GenerateIntensiveResponse {
  session_id: string;
  topic: string;
  speakers: string[];
  lines: IntensiveLine[];
  vocab_used: string[];
  level: string;
  content_type: string;
}

export function generateIntensive(level?: string, content_type?: string, topic?: string) {
  return request<GenerateIntensiveResponse>("POST", "/listening/generate-intensive", {
    level: level ?? "A2",
    content_type: content_type ?? "dialogue",
    topic: topic ?? "",
  });
}

export interface IntensiveLineResult {
  original: string;
  user_text: string;
  correct: boolean;
  audio_file: string | null;
}

export interface SubmitIntensiveResponse {
  score_pct: number;
  results: IntensiveLineResult[];
}

export function submitIntensive(req: {
  session_id: string;
  topic: string;
  lines: IntensiveLine[];
  user_texts: string[];
  vocab_used: string[];
  level: string;
  content_type: string;
  duration_seconds?: number;
}) {
  return request<SubmitIntensiveResponse>("POST", "/listening/submit-intensive", req);
}

// ── Exam ──────────────────────────────────────────────────────────────────────

export interface SectionInfo {
  code: string;
  label: string;
  default_minutes: number;
  question_count: number;
}

export interface ExamSessionOut {
  sections: SectionInfo[];
  pass_score: number;
}

export function getExamSession() {
  return request<ExamSessionOut>("GET", "/exam/session");
}

export interface ExamQuestion {
  id: string;
  section: string;
  text_nl?: string;
  text_en?: string;
  scenario_nl?: string;
  scenario_en?: string;
  prompt_nl?: string;
  prompt_en?: string;
  task_nl?: string;
  task_en?: string;
  model_answer?: string;
  key_points?: string[];
  situation_nl?: string;
  situation_en?: string;
  expected_phrases?: string[];
  question_nl?: string;
  question_en?: string;
  options?: Record<string, string>;
}

export function getExamQuestions(sectionCode: string) {
  return request<ExamQuestion[]>("GET", `/exam/questions/${sectionCode}`);
}

export interface GradedItem {
  question_id: string;
  correct: boolean;
  user_answer: string;
  correct_answer: string | null;
  explanation: string | null;
}

export interface SectionGradeOut {
  section: string;
  score: number;
  total: number;
  score_pct: number;
  items: GradedItem[];
}

export function gradeExamSection(sectionCode: string, answers: { question_id: string; answer: string }[]) {
  return request<SectionGradeOut>("POST", `/exam/grade/${sectionCode}`, answers);
}

export interface ExamResultOut {
  id: number;
  date: string;
  source: string;
  scores: Record<string, number | null>;
  avg_score: number | null;
  passed: boolean;
}

export function submitExam(source: string, scores: Record<string, number | null>) {
  return request<ExamResultOut>("POST", "/exam/submit", { source, scores });
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface FlashcardStats {
  total_cards: number;
  mastered: number;
  due_today: number;
  total_reviewed: number;
}

export function getFlashcardResults() {
  return request<FlashcardStats>("GET", "/results/flashcards");
}

export interface ListeningHistoryItem {
  id: number;
  date: string;
  topic: string;
  score_pct: number;
  mode: string;
  level: string | null;
  content_type: string | null;
  duration_seconds: number | null;
}

export function getListeningResults(mode?: string) {
  const params = mode ? { mode } : undefined;
  return request<ListeningHistoryItem[]>("GET", "/results/listening", undefined, params);
}

export interface ExamHistoryItem {
  id: number;
  date: string;
  source: string;
  scores: Record<string, number | null>;
  avg_score: number | null;
  passed: boolean;
}

export function getExamResults() {
  return request<ExamHistoryItem[]>("GET", "/results/exam");
}

// ── Trends ───────────────────────────────────────────────────────────────────

export interface FlashcardTrendPoint { date: string; reviewed: number; correct_pct: number }
export interface ListeningTrendPoint { date: string; avg_score: number; count: number }
export interface ExamTrendPoint { date: string; avg_score: number; count: number }

export function getFlashcardTrend() { return request<FlashcardTrendPoint[]>("GET", "/results/flashcards/trend"); }
export function getListeningTrend(mode?: string) {
  const params = mode ? { mode } : undefined;
  return request<ListeningTrendPoint[]>("GET", "/results/listening/trend", undefined, params);
}
export function getExamTrend() { return request<ExamTrendPoint[]>("GET", "/results/exam/trend"); }

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DailyTrainingItem {
  date: string;
  mode: string;
  count: number;
  total_seconds: number;
  avg_score: number;
}

export interface TrainingSummary {
  total_sessions: number;
  total_minutes: number;
  quiz_sessions: number;
  intensive_sessions: number;
  avg_score_quiz: number | null;
  avg_score_intensive: number | null;
  daily: DailyTrainingItem[];
}

export function getDashboardTraining(days = 30) {
  return request<TrainingSummary>("GET", "/results/dashboard/training", undefined, { days: String(days) });
}

// ── Detail / History ─────────────────────────────────────────────────────────

export interface ListeningDetailItem {
  id: number;
  date: string;
  topic: string;
  score_pct: number;
  mode: string;
  level: string | null;
  content_type: string | null;
  dialogue: { speaker: string; text: string; english: string; audio_file?: string | null }[];
  questions: { question: string; options: Record<string, string>; answer: string; user_answer?: string; correct?: boolean }[];
  vocab_used: string[];
  lines?: { speaker: string; text: string; english: string; audio_file?: string | null }[] | null;
  user_texts?: string[] | null;
  results?: { original: string; user_text: string; correct: boolean; audio_file?: string | null }[] | null;
}

export function getListeningDetail(id: number) {
  return request<ListeningDetailItem>("GET", `/results/listening/${id}`);
}

export interface FlashcardReviewItem {
  id: number;
  date: string;
  dutch: string;
  english: string;
  direction: string;
  rating: string;
}

export function getFlashcardHistory(limit = 50) {
  return request<FlashcardReviewItem[]>("GET", "/results/flashcards/history", undefined, { limit: String(limit) });
}

// ── Planner ─────────────────────────────────────────────────────────────────

export interface PlannerProfile {
  language: string;
  planner_enabled: boolean;
  goal: string | null;
  timeline_months: number | null;
  daily_minutes: number | null;
  current_level: string | null;
  weak_skills: string[];
  onboarding_completed: boolean;
  placement_completed: boolean;
  start_date: string | null;
  exam_date: string | null;
}

export interface PlannerStatus {
  planner_enabled: boolean;
  step: "language" | "goal" | "placement" | "ready";
}

export interface PlannerTask {
  id: number;
  task_index: number;
  task_type: string;
  description: string;
  duration_minutes: number;
  difficulty: string;
  status: "pending" | "completed" | "skipped";
  score: number | null;
  time_spent_seconds: number | null;
}

export interface PlannerDailyPlan {
  id: number;
  plan_date: string;
  focus_headline: string;
  coach_message: string;
  progress_note: string;
  tasks: PlannerTask[];
  retry: boolean;
}

export interface PlannerHistoryItem {
  plan_date: string;
  focus_headline: string;
  total_tasks: number;
  completed_tasks: number;
  completion_pct: number;
}

export interface PlacementQuestions {
  vocab: { question: string; options: Record<string, string>; answer: string }[];
  listening: { text: string; question: string; options: Record<string, string>; answer: string }[];
  reading: { passage: string; question: string; options: Record<string, string>; answer: string }[];
  writing_prompt: string;
}

export interface PlacementSubmitResponse {
  vocab_score: number;
  listening_score: number;
  reading_score: number;
  writing_score: number;
  writing_feedback: { score: number; level_tag: string; errors: string[]; strengths: string[] };
  overall_level: string;
  weak_skills: string[];
}

export interface PlannerWeeklyReport {
  week_start: string;
  week_end: string;
  report: {
    completion_rate: number;
    score_changes: Record<string, string>;
    biggest_improvement: string;
    focus_next_week: string;
    summary_text: string;
  };
}

export interface PlannerRoadmap {
  phases: { month: number; milestone: string; skill_weights: Record<string, number> }[];
  generated_at: string;
}

export function getPlannerProfile() { return request<PlannerProfile>("GET", "/planner/profile"); }
export function updatePlannerProfile(data: Partial<PlannerProfile>) { return request<PlannerProfile>("PUT", "/planner/profile", data); }
export function enablePlanner() { return request<{ ok: boolean }>("POST", "/planner/enable"); }
export function disablePlanner() { return request<{ ok: boolean }>("POST", "/planner/disable"); }
export function getPlannerStatus() { return request<PlannerStatus>("GET", "/planner/status"); }
export function getPlacementQuestions() { return request<PlacementQuestions>("GET", "/planner/placement/start"); }
export function submitPlacement(data: {
  vocab_answers: string[];
  listening_answers: string[];
  reading_answers: string[];
  writing_text: string;
  questions: PlacementQuestions;
}) { return request<PlacementSubmitResponse>("POST", "/planner/placement/submit", data); }
export function getTodayPlan() { return request<PlannerDailyPlan>("GET", "/planner/today"); }
export function regenerateTodayPlan() { return request<PlannerDailyPlan>("POST", "/planner/today/regenerate"); }
export function completeTask(taskId: number, data: { score?: number; time_spent_seconds?: number }) {
  return request<{ ok: boolean }>("POST", `/planner/tasks/${taskId}/complete`, data);
}
export function skipTask(taskId: number) { return request<{ ok: boolean }>("POST", `/planner/tasks/${taskId}/skip`); }
export function getPlannerHistory(days = 7) { return request<PlannerHistoryItem[]>("GET", "/planner/history", undefined, { days: String(days) }); }
export function getWeeklyReport() { return request<PlannerWeeklyReport>("GET", "/planner/report/weekly"); }
export function getRoadmap() { return request<PlannerRoadmap>("GET", "/planner/roadmap"); }
export function regenerateRoadmap() { return request<PlannerRoadmap>("POST", "/planner/roadmap/regenerate"); }

export interface StreakResponse {
  streak: number;
  active_dates: string[];
}

export function getStreak() {
  return request<StreakResponse>("GET", "/results/streak");
}

// ── Speaking ─────────────────────────────────────────────────────────────────

export interface SpeakingSceneSummary {
  id: string;
  title_en: string;
  title_nl: string;
  order: number;
  vocab_count: number;
  sentence_count: number;
  question_count: number;
  unlocked: boolean;
  attempts: number;
  avg_score: number | null;
  is_custom?: boolean;
  level?: string;
}

export interface SpeakingVocabItem {
  dutch: string;
  english: string;
  example: string;
}

export interface SpeakingModelSentence {
  text: string;
  english: string;
}

export interface SpeakingSceneDetail {
  id: string;
  title_en: string;
  title_nl: string;
  vocab: SpeakingVocabItem[];
  model_sentences: SpeakingModelSentence[];
}

export interface SpeakingQuestion {
  id: string;
  prompt_nl: string;
  prompt_en: string;
  prep_seconds: number;
  record_seconds: number;
  expected_phrases: string[];
  model_answer: string;
}

export interface SpeakingQuestions {
  short: SpeakingQuestion[];
  long: SpeakingQuestion[];
}

export interface SpeakingGrammarError {
  error: string;
  correction: string;
}

export interface SpeakingFeedback {
  score: number;
  vocabulary_score: number;
  grammar_score: number;
  completeness_score: number;
  matched_phrases: string[];
  missing_phrases: string[];
  grammar_errors: SpeakingGrammarError[];
  feedback_en: string;
  improved_answer: string;
}

export interface SpeakingSubmitResponse {
  session_id: number;
  transcript: string;
  feedback: SpeakingFeedback;
  score_pct: number;
  model_answer: string;
}

export interface SpeakingHistoryItem {
  id: number;
  scene: string;
  question_id: string;
  question_type: string;
  mode: string;
  transcript: string | null;
  score_pct: number | null;
  date: string;
  feedback: SpeakingFeedback | null;
  audio_file: string | null;
}

export function getSpeakingScenes() {
  return request<SpeakingSceneSummary[]>("GET", "/speaking/scenes");
}

export function getSpeakingSceneDetail(sceneId: string) {
  return request<SpeakingSceneDetail>("GET", `/speaking/scenes/${sceneId}`);
}

export function getSpeakingQuestions(sceneId: string) {
  return request<SpeakingQuestions>("GET", `/speaking/scenes/${sceneId}/questions`);
}

export function getSpeakingSentenceAudio(sceneId: string, index: number) {
  return request<{ audio_file: string }>("GET", `/speaking/tts/${sceneId}/${index}`);
}

export interface CreateCustomSceneResponse {
  scene_id: string;
  title_en: string;
  title_nl: string;
}

export function createCustomScene(topic: string, level: string, adminPassword?: string) {
  return request<CreateCustomSceneResponse>("POST", "/speaking/custom-scenes", {
    topic, level, ...(adminPassword ? { admin_password: adminPassword } : {}),
  });
}

export async function submitSpeakingRecording(
  audio: Blob,
  scene: string,
  questionId: string,
  questionType: string,
  mode: string,
): Promise<SpeakingSubmitResponse> {
  const token = getToken();
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  form.append("scene", scene);
  form.append("question_id", questionId);
  form.append("question_type", questionType);
  form.append("mode", mode);

  const res = await fetch(BASE + "/speaking/submit-recording", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export function getSpeakingHistory() {
  return request<SpeakingHistoryItem[]>("GET", "/speaking/history");
}

export function deleteSpeakingRecording(sessionId: number) {
  return request<void>("DELETE", `/speaking/recordings/${sessionId}`);
}

// ── Speaking Notebook ────────────────────────────────────────────────────────

export interface SpeakingNotebookBestRecording {
  question_id: string;
  audio_file: string | null;
  score_pct: number;
  transcript: string | null;
}

export interface SpeakingNotebookScene {
  id: string;
  title_en: string;
  title_nl: string;
  is_custom: boolean;
  vocab: SpeakingVocabItem[];
  model_sentences: SpeakingModelSentence[];
  best_recordings: SpeakingNotebookBestRecording[];
  stats: { attempts: number; avg_score: number | null; last_practiced: string | null };
}

export function getSpeakingNotebook() {
  return request<{ scenes: SpeakingNotebookScene[] }>("GET", "/speaking/notebook");
}

// ── Speaking History (Paginated) ─────────────────────────────────────────────

export interface SpeakingHistoryPage {
  items: SpeakingHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export function getSpeakingHistoryPaged(
  page: number,
  perPage: number,
  mode?: string,
  scene?: string,
): Promise<SpeakingHistoryPage> {
  const params: Record<string, string> = { page: String(page), per_page: String(perPage) };
  if (mode) params.mode = mode;
  if (scene) params.scene = scene;
  return request<SpeakingHistoryPage>("GET", "/speaking/history", undefined, params);
}

// ── Speaking Progress ────────────────────────────────────────────────────────

export interface WeeklyTrend {
  week: string;
  avg_score: number | null;
  avg_vocab: number | null;
  avg_grammar: number | null;
  avg_completeness: number | null;
  session_count: number;
}

export interface MissedWord {
  phrase: string;
  count: number;
  last_seen: string;
}

export interface ShadowMiss {
  word: string;
  miss_count: number;
}

export interface GrammarPattern {
  error: string;
  correction: string;
  count: number;
}

export interface WeakAreas {
  weakest: string | null;
  strongest: string | null;
  vocab_avg: number | null;
  grammar_avg: number | null;
  completeness_avg: number | null;
}

export interface ModeStats {
  by_mode: Record<string, number>;
  by_scene: Record<string, number>;
}

export interface WeekComparison {
  this_week_avg: number | null;
  last_week_avg: number | null;
  delta: number | null;
}

export interface SpeakingProgressData {
  weekly_trends: WeeklyTrend[];
  weak_areas: WeakAreas;
  missed_words: MissedWord[];
  shadow_misses: ShadowMiss[];
  grammar_patterns: GrammarPattern[];
  mode_stats: ModeStats;
  comparison: WeekComparison;
  total_sessions: number;
}

export interface SpeakingAIInsight {
  summary: string;
  patterns: string[];
  focus_areas: string[];
  suggested_scene_topic: string | null;
}

export function getSpeakingProgress() {
  return request<SpeakingProgressData>("GET", "/speaking/progress");
}

export function getSpeakingAIInsight() {
  return request<SpeakingAIInsight>("GET", "/speaking/progress/ai-insight");
}

export interface ShadowSubmitResponse {
  session_id: number;
  transcript: string;
  similarity_score: number;
  word_matches: string[];
  word_misses: string[];
  feedback: string;
  original_sentence: string;
}

export async function submitShadowRecording(
  audio: Blob,
  sceneId: string,
  sentenceIndex: number,
): Promise<ShadowSubmitResponse> {
  const token = getToken();
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  form.append("scene_id", sceneId);
  form.append("sentence_index", String(sentenceIndex));

  const res = await fetch(BASE + "/speaking/submit-shadow", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

// ── Freestyle Talk ───────────────────────────────────────────────────────

export interface FreestyleEvent {
  type: "transcript" | "sentence" | "done";
  text?: string;
  audio?: string;
  full_text?: string;
}

export async function freestyleChat(
  audio: Blob,
  history: Array<{ role: string; content: string }>,
  onEvent: (event: FreestyleEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  form.append("history", JSON.stringify(history));

  const res = await fetch(BASE + "/speaking/freestyle/chat", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let partial = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    partial += decoder.decode(value, { stream: true });
    const lines = partial.split("\n");
    partial = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as FreestyleEvent;
          onEvent(event);
        } catch { /* skip malformed lines */ }
      }
    }
  }
  // flush remaining
  if (partial.startsWith("data: ")) {
    try {
      const event = JSON.parse(partial.slice(6)) as FreestyleEvent;
      onEvent(event);
    } catch { /* skip */ }
  }
}

// ── Mock Exams ───────────────────────────────────────────────────────────────

export interface MockExamSummary {
  id: string;
  title: string;
  short_count: number;
  long_count: number;
}

export interface MockExamDetail {
  id: string;
  title: string;
  short: SpeakingQuestion[];
  long: SpeakingQuestion[];
}

export function getMockExams() {
  return request<MockExamSummary[]>("GET", "/speaking/mock-exams");
}

export function getMockExamDetail(examId: string) {
  return request<MockExamDetail>("GET", `/speaking/mock-exams/${examId}`);
}

// ── Spreken Exams ───────────────────────────────────────────────────────────

export interface SprekenExamSummary {
  id: string;
  title: string;
  onderdeel_count: number;
  question_count: number;
}

export interface SprekenVraag {
  id: string;
  situatie_nl: string;
  situatie_en: string;
  vraag_nl: string;
  vraag_en: string;
  prep_seconds: number;
  record_seconds: number;
  model_answer: string;
  tips: string[];
  expected_phrases: string[];
  question_type: string;
  image_url?: string;
}

export interface SprekenOnderdeel {
  nummer: number;
  titel: string;
  beschrijving: string;
  beschrijving_en: string;
  vragen: SprekenVraag[];
}

export interface SprekenExamDetail {
  id: string;
  title: string;
  onderdelen: SprekenOnderdeel[];
}

export function getSprekenExams() {
  return request<SprekenExamSummary[]>("GET", "/speaking/spreken-exams");
}

export function getSprekenExamDetail(examId: string) {
  return request<SprekenExamDetail>("GET", `/speaking/spreken-exams/${examId}`);
}

export function getSprekenQuestionAudio(examId: string, questionId: string) {
  return request<{ audio_file: string }>("GET", `/speaking/spreken-tts/${examId}/${questionId}`);
}

// ── Personal Vocab ──────────────────────────────────────────────────────────

export interface PersonalVocabItem {
  id: number;
  dutch: string;
  english: string;
  source: string;
  context_sentence: string;
  notes: string;
  created_at: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string;
  mastered: boolean;
}

export function translatePhrase(text: string, context: string) {
  return request<{ dutch: string; english: string }>("POST", "/personal-vocab/translate", { text, context });
}

export function savePersonalVocab(data: { dutch: string; english: string; source: string; context_sentence: string }) {
  return request<PersonalVocabItem>("POST", "/personal-vocab/save", data);
}

export function getPersonalVocab(source?: string) {
  const params = source ? { source } : undefined;
  return request<PersonalVocabItem[]>("GET", "/personal-vocab", undefined, params);
}

export function deletePersonalVocab(id: number) {
  return request<void>("DELETE", `/personal-vocab/${id}`);
}

export function updatePersonalVocab(id: number, data: { notes?: string; english?: string }) {
  return request<PersonalVocabItem>("PATCH", `/personal-vocab/${id}`, data);
}

export function getPersonalVocabSession() {
  return request<{ cards: PersonalVocabItem[]; due_count: number }>("GET", "/personal-vocab/session");
}

export function reviewPersonalVocab(id: number, rating: Rating) {
  return request<ReviewOut>("POST", "/personal-vocab/review", { id, rating });
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface ReadingQuestion {
  id: string;
  question_nl: string;
  question_en: string;
  options: Record<string, string>;
  answer: string;
  explanation_en: string;
}

export interface ReadingGenerateResponse {
  content_type: string;
  topic: string;
  title_nl: string;
  passage_nl: string;
  passage_en: string;
  questions: ReadingQuestion[];
  level: string;
  vocab_used: string[];
}

export function generateReading(content_type?: string, level?: string, topic?: string) {
  return request<ReadingGenerateResponse>("POST", "/reading/generate", {
    content_type: content_type ?? "short_text",
    level: level ?? "A2",
    topic: topic ?? "",
  });
}

export interface ReadingQuestionResult {
  id: string;
  correct: boolean;
  user_answer: string;
  correct_answer: string;
  explanation_en: string;
}

export interface ReadingSubmitResponse {
  score: number;
  total: number;
  score_pct: number;
  results: ReadingQuestionResult[];
}

export function submitReading(data: {
  content_type: string;
  topic: string;
  title_nl: string;
  passage_nl: string;
  passage_en: string;
  questions: ReadingQuestion[];
  user_answers: string[];
  level: string;
  duration_seconds?: number;
}) {
  return request<ReadingSubmitResponse>("POST", "/reading/submit", data);
}

export function explainReading(data: {
  passage_nl: string;
  passage_en: string;
  questions: ReadingQuestion[];
  user_answers: string[];
  level?: string;
}) {
  return request<{ explanation: string }>("POST", "/reading/explain", data);
}

export interface ReadingHistoryItem {
  id: number;
  date: string;
  content_type: string;
  level: string;
  topic: string;
  score_pct: number;
  total_questions: number;
  correct_count: number;
  duration_seconds: number | null;
}

export function getReadingHistory() {
  return request<ReadingHistoryItem[]>("GET", "/reading/history");
}

export interface ReadingDetailItem extends ReadingHistoryItem {
  title_nl?: string;
  passage_nl?: string;
  passage_en?: string;
  questions?: ReadingQuestion[];
  user_answers?: string[];
}

export function getReadingDetail(id: number) {
  return request<ReadingDetailItem>("GET", `/reading/detail/${id}`);
}

// ── KNM ─────────────────────────────────────────────────────────────────────

export interface KNMCategoryStat {
  category: string;
  label_nl: string;
  label_en: string;
  attempts: number;
  avg_score: number | null;
}

export function getKNMCategories() {
  return request<KNMCategoryStat[]>("GET", "/knm/categories");
}

export interface KNMQuestion {
  id: string;
  question_nl: string;
  question_en: string;
  context_nl: string;
  context_en: string;
  options: Record<string, string>;
  options_en: Record<string, string>;
  answer: string;
  explanation_en: string;
}

export interface KNMGenerateResponse {
  category: string;
  questions: KNMQuestion[];
}

export function generateKNM(category: string, count?: number) {
  return request<KNMGenerateResponse>("POST", "/knm/generate", {
    category,
    count: count ?? 5,
  });
}

export interface KNMQuestionResult {
  id: string;
  correct: boolean;
  user_answer: string;
  correct_answer: string;
  explanation_en: string;
}

export interface KNMSubmitResponse {
  score: number;
  total: number;
  score_pct: number;
  results: KNMQuestionResult[];
}

export function submitKNM(data: {
  category: string;
  questions: KNMQuestion[];
  user_answers: string[];
}) {
  return request<KNMSubmitResponse>("POST", "/knm/submit", data);
}

export interface KNMHistoryItem {
  id: number;
  date: string;
  category: string;
  score_pct: number;
  total_questions: number;
  correct_count: number;
}

export function getKNMHistory() {
  return request<KNMHistoryItem[]>("GET", "/knm/history");
}

export interface KNMDetailItem extends KNMHistoryItem {
  questions?: KNMQuestion[];
  user_answers?: string[];
}

export function getKNMDetail(id: number) {
  return request<KNMDetailItem>("GET", `/knm/detail/${id}`);
}

// ── Dashboard Insights ──────────────────────────────────────────────────────

export interface VocabCategoryItem {
  category: string;
  mastered: number;
  total: number;
}

export interface SkillSnapshotItem {
  skill: string;
  assessed_level: string;
  avg_score: number;
}

export interface DashboardInsights {
  days_until_exam: number | null;
  exam_date: string | null;
  vocab_categories: VocabCategoryItem[];
  listening_trend_7d: number | null;
  speaking_subscores: Record<string, number | null>;
  planner_completion_rate_7d: number | null;
  most_practiced_skill: string | null;
  least_practiced_skill: string | null;
  skill_practice_counts: Record<string, number>;
  review_consistency_30d: number;
  review_dates_30d: string[];
  skill_snapshots: SkillSnapshotItem[];
}

export function getDashboardInsights() {
  return request<DashboardInsights>("GET", "/results/dashboard/insights");
}

// ── Advisor ──────────────────────────────────────────────────────────────────

export interface AdvisorTask {
  task_type: string;
  description: string;
  route: string;
}

export interface AdvisorResponse {
  reply: string;
  suggested_tasks?: AdvisorTask[];
}

export function askAdvisor(message: string) {
  return request<AdvisorResponse>("POST", "/advisor/ask", { message });
}

// ── Writing ─────────────────────────────────────────────────────────────────

export interface WritingBulletPoint { nl: string; en: string }
export interface WritingGuidingQuestion { nl: string; en: string }
export interface WritingFormField {
  label_nl: string;
  label_en: string;
  field_type: "text" | "select" | "textarea";
  placeholder?: string;
  options?: string[];
}

export interface ErrorCorrectionSentence {
  text: string;
  text_en?: string;
  has_error: boolean;
  correct_text: string;
  category: string | null;
  explanation_en: string | null;
}

export interface WritingPrompt {
  task_type: string;
  topic: string;
  // email
  situation_nl?: string;
  situation_en?: string;
  recipient?: string;
  bullet_points?: WritingBulletPoint[];
  // kort_verhaal
  topic_nl?: string;
  topic_en?: string;
  guiding_questions?: WritingGuidingQuestion[];
  // formulier
  form_title_nl?: string;
  form_title_en?: string;
  fields?: WritingFormField[];
  model_answers?: Record<string, string>;
  // error_correction
  sentences?: ErrorCorrectionSentence[];
  // shared
  model_answer?: string;
}

export function generateWritingPrompt(taskType?: string, topic?: string) {
  return request<WritingPrompt>("POST", "/writing/generate", {
    task_type: taskType ?? "email",
    topic: topic ?? "",
  });
}

export interface WritingGrammarError {
  text: string;
  correction: string;
  category: string;
  explanation_en: string;
}

export interface WritingFeedback {
  score: number;
  grammar_score: number;
  vocabulary_score: number;
  completeness_score: number;
  grammar_errors: WritingGrammarError[];
  feedback_nl: string;
  feedback_en: string;
  improved_answer: string;
}

export interface WritingSubmitResponse {
  session_id: number;
  score_pct: number;
  feedback: WritingFeedback;
}

export function submitWriting(data: {
  task_type: string;
  prompt: WritingPrompt;
  response_text: string;
  duration_seconds?: number;
}) {
  return request<WritingSubmitResponse>("POST", "/writing/submit", data);
}

// Error Correction
export interface ErrorCorrectionResult {
  sentence: string;
  has_error: boolean;
  correct_text: string;
  category: string | null;
  explanation_en: string | null;
  user_marked_error: boolean;
  user_correction: string | null;
  found: boolean | null;       // null for correct sentences
  fix_correct: boolean | null;  // null for correct sentences
}

export interface ErrorCorrectionFeedback {
  score: number;
  found_count: number;
  total_errors: number;
  correct_fixes: number;
  correct_judgments: number;
  total_sentences: number;
  results: ErrorCorrectionResult[];
  feedback_en: string;
  feedback_nl: string;
}

export interface ErrorCorrectionSubmitResponse {
  session_id: number;
  score_pct: number;
  feedback: ErrorCorrectionFeedback;
}

export function submitErrorCorrection(data: {
  prompt: WritingPrompt;
  answers: { sentence_index: number; marked_error: boolean; user_correction: string | null }[];
  duration_seconds?: number;
}) {
  return request<ErrorCorrectionSubmitResponse>("POST", "/writing/submit-correction", data);
}

export interface WritingHistoryItem {
  id: number;
  date: string;
  task_type: string;
  topic: string;
  score_pct: number | null;
  duration_seconds: number | null;
}

export interface WritingHistoryPage {
  items: WritingHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export function getWritingHistoryPaged(page: number, perPage: number, taskType?: string) {
  const params: Record<string, string> = { page: String(page), per_page: String(perPage) };
  if (taskType) params.task_type = taskType;
  return request<WritingHistoryPage>("GET", "/writing/history", undefined, params);
}

export interface WritingDetailItem {
  id: number;
  date: string;
  task_type: string;
  topic: string;
  score_pct: number | null;
  duration_seconds: number | null;
  prompt: WritingPrompt;
  response_text: string;
  // feedback shape depends on task_type:
  // - error_correction → ErrorCorrectionFeedback
  // - email/kort_verhaal/formulier → WritingFeedback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedback: any;
}

export function getWritingDetail(id: number) {
  return request<WritingDetailItem>("GET", `/writing/detail/${id}`);
}

export interface WritingErrorCategoryItem {
  category: string;
  count: number;
  last_seen: string;
}

export interface WritingErrorProfile {
  categories: WritingErrorCategoryItem[];
}

export function getWritingErrorProfile() {
  return request<WritingErrorProfile>("GET", "/writing/error-profile");
}

// ── Writing Mock Exams (Official DUO Schrijven) ─────────────────────────────

export interface SchrijvenExamSummary {
  id: string;
  title: string;
  task_count: number;
  task_types: Record<string, number>;
}

export interface SchrijvenExamTask {
  id: string;
  task_type: "email" | "kort_verhaal" | "formulier";
  title: string;
  situation_nl?: string;
  situation_en?: string;
  recipient?: string;
  bullet_points?: WritingBulletPoint[];
  guiding_questions?: WritingGuidingQuestion[];
  form_title_nl?: string;
  form_title_en?: string;
  fields?: WritingFormField[];
  instructions_nl: string;
  instructions_en: string;
  starter_text?: string;
  greeting?: string;
  closing?: string;
  model_answer?: string;
  model_answers?: Record<string, string>;
}

export interface SchrijvenExamDetail {
  id: string;
  title: string;
  tasks: SchrijvenExamTask[];
}

export function getSchrijvenExams() {
  return request<SchrijvenExamSummary[]>("GET", "/writing/mock-exams");
}

export function getSchrijvenExamDetail(examId: string) {
  return request<SchrijvenExamDetail>("GET", `/writing/mock-exams/${examId}`);
}

export async function askAdvisorStream(
  message: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + "/advisor/ask-stream", {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    full += text;
    onChunk(full);
  }
  return full;
}
