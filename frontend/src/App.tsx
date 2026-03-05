import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Flashcards from "./pages/Flashcards";
import KNMExercise from "./pages/KNMExercise";
import Listening from "./pages/Listening";
import Login from "./pages/Login";
import MockExam from "./pages/MockExam";
import Planner from "./pages/Planner";
import Reading from "./pages/Reading";
import Settings from "./pages/Settings";
import StudyMaterial from "./pages/StudyMaterial";
import Writing from "./pages/Writing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="study/listening" element={<Listening />} />
          <Route path="study/reading" element={<Reading />} />
          <Route path="study/writing" element={<Writing />} />
          <Route path="study/knm" element={<KNMExercise />} />
          <Route path="vocab-refresh" element={<Flashcards />} />
          <Route path="study-material" element={<StudyMaterial />} />
          <Route path="planner" element={<Planner />} />
          <Route path="exam" element={<MockExam />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
