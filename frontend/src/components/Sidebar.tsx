import { useSidebar } from "../hooks/useSidebar";
import { useActiveExercises } from "../contexts/ExerciseProvider";
import {
  BookIcon,
  ChartIcon,
  ClipboardIcon,
  CogIcon,
  HomeIcon,
  LayersIcon,
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

export default function Sidebar() {
  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const active = useActiveExercises();
  const username = localStorage.getItem("username") ?? "U";
  const avatarLetter = username.charAt(0).toUpperCase();

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
        className={`fixed top-0 left-0 h-full bg-sidebar-bg z-50 flex flex-col transition-all duration-200 shadow-xl shadow-black/20
          ${width}
          lg:relative lg:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Top — Avatar + Title (click to toggle) */}
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
          {/* Mobile: show avatar (non-interactive) + close button */}
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
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          <SidebarItem to="/" icon={<HomeIcon />} label="Dashboard" />

          <SidebarItem icon={<BookIcon />} label="Study" submenuKey="study">
            <SidebarSubItem to="/study/listening" label="Listening" badge={active.listening ? <ActiveDot /> : undefined} />
            <SidebarSubItem to="/study/speaking" label="Speaking" />
            <SidebarSubItem to="/study/reading" label="Reading" />
            <SidebarSubItem to="/study/writing" label="Writing" />
            <SidebarSubItem to="/study/knm" label="KNM" />
          </SidebarItem>

          <SidebarItem to="/planner" icon={<PlannerIcon />} label="Learning Planner" />
          <SidebarItem to="/vocab-refresh" icon={<LayersIcon />} label="Vocab Refresh" badge={active.flashcards ? <ActiveDot /> : undefined} />
          <SidebarItem to="/study-material" icon={<ChartIcon />} label="Study Material" />
          <SidebarItem to="/exam" icon={<ClipboardIcon />} label="Mock Exam" badge={active.mockExam ? <ActiveDot /> : undefined} />
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 py-3 space-y-1">
          <SidebarItem to="/settings" icon={<CogIcon />} label="Settings" />
        </div>
      </aside>
    </>
  );
}
