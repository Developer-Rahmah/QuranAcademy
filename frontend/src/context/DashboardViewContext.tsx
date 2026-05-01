/**
 * DashboardViewContext — exposes the current dashboard view (`student`
 * or `supervisor`) and a setter to dual-role accounts so they can flip
 * between views without logging out.
 *
 * Why a context: the picker state lives in `DashboardDispatcher`, but
 * the switch button is rendered deep inside the rendered dashboard
 * (`StudentDashboard` / `SupervisorDashboard`). A context avoids
 * threading props through every intermediate component.
 *
 * `canSwitch` is true only when the user is BOTH a student-capable
 * profile AND has at least one supervisor assignment. Pure students
 * and pure supervisors get no switcher (it would be a no-op button).
 */
import { createContext, useContext, type ReactNode } from 'react';

export type DashboardView = 'student' | 'supervisor';

interface DashboardViewContextValue {
  view: DashboardView;
  switchTo: (next: DashboardView) => void;
  canSwitch: boolean;
}

const DashboardViewContext = createContext<DashboardViewContextValue | null>(null);

export function DashboardViewProvider({
  value,
  children,
}: {
  value: DashboardViewContextValue;
  children: ReactNode;
}) {
  return (
    <DashboardViewContext.Provider value={value}>
      {children}
    </DashboardViewContext.Provider>
  );
}

/**
 * Read the current view + switcher. Returns `null` when used outside
 * a provider (e.g. someone renders StudentDashboard from a non-
 * dispatcher path) — callers MUST handle that to keep the switcher
 * optional.
 */
export function useDashboardView(): DashboardViewContextValue | null {
  return useContext(DashboardViewContext);
}
