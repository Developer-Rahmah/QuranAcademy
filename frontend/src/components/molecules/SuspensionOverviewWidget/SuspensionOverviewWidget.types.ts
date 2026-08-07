/**
 * SuspensionOverviewWidget — types.
 */
export interface SuspensionOverviewWidgetProps {
  /**
   * Route to navigate to when the "View audit" link is clicked.
   * Passed in from the caller so the widget stays route-agnostic.
   */
  auditHref: string;
  /**
   * Numeric threshold for the "approaching suspension" metric,
   * in days. When omitted, the widget hides that tile — allows a
   * caller to disable the DB read if it's not applicable (e.g.
   * policy disabled).
   */
  approachingWithinDays?: number;
  /**
   * When `false`, the widget still renders but skips the
   * "approaching" DB query. Lets the caller mirror the current
   * `report_policy.enabled` state without prop-drilling more.
   */
  policyEnabled?: boolean;
}
