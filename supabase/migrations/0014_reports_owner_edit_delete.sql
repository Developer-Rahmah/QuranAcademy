-- ============================================================
-- 0014_reports_owner_edit_delete
--
-- Lets a student edit / delete reports they previously submitted.
--
-- Before this migration:
--   - reports_update_own restricted UPDATE to `report_date = CURRENT_DATE`
--     (i.e. only same-day edits were allowed at the DB layer).
--   - There was no DELETE policy on reports/report_items, so even though
--     ON DELETE CASCADE existed, students could not remove their own rows.
--   - report_items had only INSERT/SELECT policies for owners, so a
--     student could not modify the items of an existing report.
--
-- After this migration:
--   - A student may UPDATE / DELETE their own report rows AT ANY TIME
--     for past dates and TODAY. Future-dated edits are still blocked
--     (frontend enforces the same rule, but RLS is the source of truth).
--   - A student may UPDATE / DELETE the items belonging to one of their
--     reports — a prerequisite for the "edit" flow that re-syncs items
--     by deleting old ones and inserting fresh ones inside a single
--     transaction.
--
-- Teachers / supervisors / admins keep their existing visibility +
-- admin-all rules unchanged.
-- ============================================================

-- -----------------------------------------------------------
-- reports
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "reports_update_own"  ON reports;
DROP POLICY IF EXISTS "reports_delete_own"  ON reports;

-- Students may edit only their own reports, and only on a date
-- that is not in the future (matches the frontend rule). Past-day
-- corrections are explicitly allowed.
CREATE POLICY "reports_update_own"
    ON reports FOR UPDATE TO authenticated
    USING (
        student_id = auth.uid()
        AND report_date <= CURRENT_DATE
    )
    WITH CHECK (
        student_id = auth.uid()
        AND report_date <= CURRENT_DATE
    );

CREATE POLICY "reports_delete_own"
    ON reports FOR DELETE TO authenticated
    USING (student_id = auth.uid());

-- -----------------------------------------------------------
-- report_items
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "report_items_update_own" ON report_items;
DROP POLICY IF EXISTS "report_items_delete_own" ON report_items;

CREATE POLICY "report_items_update_own"
    ON report_items FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
    );

CREATE POLICY "report_items_delete_own"
    ON report_items FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
    );
