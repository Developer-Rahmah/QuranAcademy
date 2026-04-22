# Supabase — Database Source of Truth

All schema + policy changes live in **`migrations/`**. Each file is numbered and
**idempotent** — re-running the whole directory against a populated database is
a safe no-op.

## Layout

```
supabase/
├── migrations/
│   ├── 0001_init_schema.sql              enums, tables, indexes
│   ├── 0002_functions_and_triggers.sql   handle_updated_at, handle_new_user, get_my_role, grants
│   ├── 0003_rls_policies.sql             RLS enable + all policies (drop-then-create)
│   └── 0004_halaqahs_target_audience.sql widen target_audience to preferred_audience (conditional)
├── _archive/                              historical / superseded scripts, kept for reference only
└── README.md
```

> `backend/_archive/` holds another set of earlier SQL drafts. They are **not**
> applied by this workflow — treat them as read-only history.

## Applying migrations

### Option A — Supabase CLI (preferred once linked)

```bash
supabase link --project-ref <ref>
supabase db push
```

### Option B — Manual SQL Editor

Open each file under `migrations/` in order and run it. Because every statement
uses `CREATE ... IF NOT EXISTS`, `DO $$ … duplicate_object`, or
`DROP POLICY IF EXISTS` before `CREATE POLICY`, the scripts won't fail if the
objects already exist.

## Generating TypeScript types

Prefer the CLI when available:

```bash
supabase gen types typescript --project-id <ref> > frontend/src/lib/supabase/database.types.ts
```

The repo ships a hand-authored `database.types.ts` that matches the canonical
schema above. When the schema changes, regenerate via the CLI and overwrite the
file.

## Adding a new migration

1. Create `migrations/NNNN_short_name.sql` where `NNNN` is the next integer.
2. Keep statements idempotent (`IF NOT EXISTS`, `OR REPLACE`, `DROP … IF EXISTS`).
3. Run it against a dev project first.
4. Regenerate `database.types.ts`.

## Never do

- Don't edit `_archive/`.
- Don't add ad-hoc `fix_*.sql` / `FINAL_*.sql` files at the root — put every
  change in a new numbered migration so history stays linear.
