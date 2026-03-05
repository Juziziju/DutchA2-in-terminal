import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:8000",
      "/vocab": "http://localhost:8000",
      "/flashcards": "http://localhost:8000",
      "/listening": "http://localhost:8000",
      "/exam": "http://localhost:8000",
      "/results": "http://localhost:8000",
      "/planner": "http://localhost:8000",
      "/audio": "http://localhost:8000",
      "/audio_listening": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
