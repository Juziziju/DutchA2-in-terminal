import { NavLink, useLocation } from "react-router-dom";
import { useSidebar } from "../hooks/useSidebar";
import { ChevronIcon } from "./icons";

interface SidebarItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  submenuKey?: string;
  children?: React.ReactNode;
  badge?: React.ReactNode;
}

export default function SidebarItem({ to, icon, label, submenuKey, children, badge }: SidebarItemProps) {
  const { isCollapsed, expandedMenus, toggleSubmenu, closeMobile } = useSidebar();
  const location = useLocation();
  const isExpanded = submenuKey ? expandedMenus.has(submenuKey) : false;

  const base = "flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 text-sm font-medium text-sidebar-text hover:shadow-md hover:shadow-black/25 transition-all duration-150";
  const active = "bg-gradient-to-r from-blue-600/80 to-blue-500/60 text-white border-l-[3px] border-blue-400 shadow-lg shadow-blue-500/20";

  // Parent with submenu
  if (submenuKey && children) {
    const isChildActive = location.pathname.startsWith("/study/");
    return (
      <div>
        <button
          onClick={() => toggleSubmenu(submenuKey)}
          className={`${base} w-[calc(100%-16px)] ${isChildActive && !isExpanded ? active : ""}`}
          title={isCollapsed ? label : undefined}
        >
          <span className="flex-shrink-0">{icon}</span>
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">{label}</span>
              <ChevronIcon className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
        {!isCollapsed && (
          <div className={`submenu-content overflow-hidden transition-all ${isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
            {children}
          </div>
        )}
      </div>
    );
  }

  // Regular nav item
  if (to) {
    return (
      <NavLink
        to={to}
        end={to === "/"}
        onClick={closeMobile}
        className={({ isActive }) => `${base} ${isActive ? active : ""}`}
        title={isCollapsed ? label : undefined}
      >
        <span className="flex-shrink-0">{icon}</span>
        {!isCollapsed && <span className="flex-1">{label}</span>}
        {!isCollapsed && badge}
      </NavLink>
    );
  }

  return null;
}

export function SidebarSubItem({ to, label, badge }: { to: string; label: string; badge?: React.ReactNode }) {
  const { closeMobile } = useSidebar();

  return (
    <NavLink
      to={to}
      onClick={closeMobile}
      className={({ isActive }) =>
        `flex items-center pl-11 pr-4 py-2 mx-2 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? "bg-gradient-to-r from-blue-600/80 to-blue-500/60 text-white font-medium border-l-[3px] border-blue-400 shadow-lg shadow-blue-500/20"
            : "text-sidebar-text hover:shadow-md hover:shadow-black/25"
        }`
      }
    >
      <span className="flex-1">{label}</span>
      {badge}
    </NavLink>
  );
}
