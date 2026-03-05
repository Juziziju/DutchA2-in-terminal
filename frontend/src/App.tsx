import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Flashcards from "./pages/Flashcards";
import Home from "./pages/Home";
import Listening from "./pages/Listening";
import Login from "./pages/Login";
import MockExam from "./pages/MockExam";
import Results from "./pages/Results";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <PrivateRoute>
              <Flashcards />
            </PrivateRoute>
          }
        />
        <Route
          path="/listening"
          element={
            <PrivateRoute>
              <Listening />
            </PrivateRoute>
          }
        />
        <Route
          path="/exam"
          element={
            <PrivateRoute>
              <MockExam />
            </PrivateRoute>
          }
        />
        <Route
          path="/results"
          element={
            <PrivateRoute>
              <Results />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
