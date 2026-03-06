import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSidebar } from "../hooks/useSidebar";
import { useActiveExercises } from "../contexts/ExerciseProvider";
import { getFlashcardResults } from "../api";
import {
  AdvisorIcon,
  BookIcon,
  ChartIcon,
  ClipboardIcon,
  CogIcon,
  HomeIcon,
  LayersIcon,
  NotebookIcon,
  PlannerIcon,
  XIcon,
} from "./icons";
import SidebarItem, { SidebarSubItem } from "./SidebarItem";

function ActiveDot() {
  return <span className="exercise-active-dot flex-shrink-0" />;
}

function Avatar({ letter, size = "w-8 h-8 text-sm" }: { letter: string; size?: string }) {
  return (
    <span className={`${size} rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0`}>
      {letter}
    </span>
  );
}

function SectionLabel({ children, isCollapsed }: { children: string; isCollapsed: boolean }) {
  if (isCollapsed) return null;
  return (
    <p className="text-[10px] uppercase tracking-widest text-slate-500 px-4 mt-4 mb-2">{children}</p>
  );
}

function AdvisorNavItem({ isCollapsed, closeMobile }: { isCollapsed: boolean; closeMobile: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === "/advisor";

  return (
    <NavLink
      to="/advisor"
      onClick={closeMobile}
      title={isCollapsed ? "AI Advisor" : undefined}
      className={`group relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden ${
        isActive
          ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30"
          : "text-sidebar-text hover:text-white"
      }`}
    >
      {!isActive && (
        <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600/0 via-fuchsia-500/0 to-purple-500/0 group-hover:from-violet-600/80 group-hover:via-fuchsia-500/70 group-hover:to-purple-500/80 transition-all duration-300" />
      )}
      <span className="relative flex-shrink-0">
        <AdvisorIcon />
      </span>
      {!isCollapsed && <span className="relative flex-1">AI Advisor</span>}
    </NavLink>
  );
}

function DueBadge({ count, isCollapsed }: { count: number; isCollapsed: boolean }) {
  if (count === 0 || isCollapsed) return null;
  return (
    <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold leading-none">
      {count}
    </span>
  );
}

export default function Sidebar() {
  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const active = useActiveExercises();
  const username = localStorage.getItem("username") ?? "U";
  const avatarLetter = username.charAt(0).toUpperCase();
  const [dueCount, setDueCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    getFlashcardResults().then(r => setDueCount(r.due_today)).catch(() => {});
  }, [location.pathname]);

  const width = isCollapsed ? "w-16" : "w-60";

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 z-50 flex flex-col transition-all duration-200 shadow-xl shadow-black/20
          ${width}
          lg:relative lg:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Top — Avatar + Title */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10">
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex items-center gap-3 cursor-pointer select-none"
          >
            <Avatar letter={avatarLetter} />
            {!isCollapsed && (
              <span className="font-bold text-white text-sm tracking-wide whitespace-nowrap">
                Dutch A2 Blitz
              </span>
            )}
          </button>
          <span className="lg:hidden flex items-center gap-3">
            <Avatar letter={avatarLetter} />
            {!isCollapsed && (
              <span className="font-bold text-white text-sm tracking-wide whitespace-nowrap">
                Dutch A2 Blitz
              </span>
            )}
          </span>
          <button
            onClick={closeMobile}
            className="lg:hidden text-sidebar-text hover:text-white ml-auto"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <SectionLabel isCollapsed={isCollapsed}>Learn</SectionLabel>
          <div className="space-y-0.5">
            <SidebarItem to="/" icon={<HomeIcon />} label="Dashboard" />
            <SidebarItem icon={<BookIcon />} label="Study" submenuKey="study" data-tour="study-menu">
              <SidebarSubItem to="/study/listening" label="Listening" badge={active.listening ? <ActiveDot /> : undefined} />
              <SidebarSubItem to="/study/speaking" label="Speaking" />
              <SidebarSubItem to="/study/reading" label="Reading" />
              <SidebarSubItem to="/study/writing" label="Writing" />
              <SidebarSubItem to="/study/knm" label="KNM" />
            </SidebarItem>
            <SidebarItem to="/vocab-refresh" icon={<LayersIcon />} label="Vocab Refresh" data-tour="vocab-refresh" badge={dueCount > 0 ? <DueBadge count={dueCount} isCollapsed={isCollapsed} /> : active.flashcards ? <ActiveDot /> : undefined} />
            <SidebarItem to="/vocab-notebook" icon={<NotebookIcon />} label="Vocab Notebook" />
          </div>

          <SectionLabel isCollapsed={isCollapsed}>Prepare</SectionLabel>
          <div className="space-y-0.5">
            <SidebarItem to="/planner" icon={<PlannerIcon />} label="Learning Planner" data-tour="planner" />
            <SidebarItem to="/study-material" icon={<ChartIcon />} label="Study Material" />
            <SidebarItem to="/exam" icon={<ClipboardIcon />} label="Mock Exam" data-tour="mock-exam" badge={active.mockExam ? <ActiveDot /> : undefined} />
          </div>

          <SectionLabel isCollapsed={isCollapsed}>Tools</SectionLabel>
          <div className="space-y-0.5">
            <span data-tour="ai-advisor">
              <AdvisorNavItem isCollapsed={isCollapsed} closeMobile={closeMobile} />
            </span>
            <SidebarItem to="/settings" icon={<CogIcon />} label="Settings" />
          </div>
        </nav>

        {/* Bottom profile section */}
        {!isCollapsed && (
          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Avatar letter={avatarLetter} size="w-7 h-7 text-xs" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{username}</p>
                <p className="text-[10px] text-slate-400">Streak: {/* streakCount would need to be fetched separately or passed via context */}--</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
