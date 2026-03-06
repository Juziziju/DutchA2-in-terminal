import { createContext, useContext } from "react";

export interface SidebarContextValue {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedMenus: Set<string>;
  toggleCollapse(): void;
  toggleMobile(): void;
  toggleSubmenu(key: string): void;
  closeMobile(): void;
  expandSubmenu(key: string): void;
  setCollapsed(collapsed: boolean): void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be inside SidebarProvider");
  return ctx;
}
