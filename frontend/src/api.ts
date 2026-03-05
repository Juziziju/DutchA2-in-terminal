/** Typed fetch wrappers for all backend endpoints. */

// In dev: Vite proxy forwards to localhost:8000.
// In prod: same origin — FastAPI serves both API and frontend.
const BASE = "";

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

export function submitReview(progress_id: number, rating: Rating) {
  return request<ReviewOut>("POST", "/flashcards/review", { progress_id, rating });
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
}

export function generateListening() {
  return request<GenerateResponse>("POST", "/listening/generate");
}

export interface SubmitListeningRequest {
  session_id: string;
  topic: string;
  dialogue: DialogueLine[];
  questions: Question[];
  user_answers: string[];
  vocab_used: string[];
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
  user_answers: string[]
) {
  return request<{ explanation: string }>("POST", "/listening/explain", {
    topic,
    dialogue,
    questions,
    user_answers,
  });
}

// ── Exam ──────────────────────────────────────────────────────────────────────

export interface SectionInfo {
  code: string;
  label: string;
  default_minutes: number;
}

export interface ExamSessionOut {
  sections: SectionInfo[];
  pass_score: number;
}

export function getExamSession() {
  return request<ExamSessionOut>("GET", "/exam/session");
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
}

export function getListeningResults() {
  return request<ListeningHistoryItem[]>("GET", "/results/listening");
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
