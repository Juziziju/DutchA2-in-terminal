import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { LogoutIcon, MenuIcon } from "../components/icons";
import { SidebarContext, SidebarContextValue } from "../hooks/useSidebar";
import { useNavigate } from "react-router-dom";
import { ExerciseProvider } from "../contexts/ExerciseProvider";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/study/listening": "Listening",
  "/study/reading": "Reading",
  "/study/writing": "Writing",
  "/study/knm": "KNM Exercise",
  "/vocab-refresh": "Vocab Refresh",
  "/study-material": "Study Material",
  "/exam": "Mock Exam",
  "/settings": "Settings",
};

export default function AppLayout() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username") ?? "learner";
  const nav = useNavigate();
  const location = useLocation();

  const [isCollapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    if (location.pathname.startsWith("/study/")) return new Set(["study"]);
    return new Set();
  });

  // Close mobile sidebar on route change
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  }, []);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleSubmenu = useCallback((key: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!token) return <Navigate to="/login" replace />;

  const ctx: SidebarContextValue = {
    isCollapsed,
    isMobileOpen,
    expandedMenus,
    toggleCollapse,
    toggleMobile,
    toggleSubmenu,
    closeMobile,
  };

  const pageTitle = TITLES[location.pathname] ?? "";

  function logout() {
    localStorage.clear();
    nav("/login");
  }

  return (
    <SidebarContext.Provider value={ctx}>
      <ExerciseProvider>
        <div className="flex h-screen bg-slate-50">
          <Sidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMobile}
                  className="lg:hidden text-slate-500 hover:text-slate-800"
                >
                  <MenuIcon />
                </button>
                <h1 className="font-semibold text-slate-800">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{username}</span>
                <button
                  onClick={logout}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                  title="Log out"
                >
                  <LogoutIcon className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Scrollable content */}
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </ExerciseProvider>
    </SidebarContext.Provider>
  );
}
