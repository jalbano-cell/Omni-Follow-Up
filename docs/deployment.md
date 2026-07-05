# Deployment

Vercel (Next.js) + Supabase (Postgres). No staging environment — `main` is production.

## The standard change workflow

1. Make the code change, typecheck (`npx tsc --noEmit`), lint (`npm run lint`), build (`npm run build`).
2. If the change touches the schema: write a new numbered file in `supabase/migrations/` (never edit an existing one), apply it with `supabase db push`, then regenerate `types/supabase.ts` (`supabase gen types typescript --linked > types/supabase.ts`) — it's generated, never hand-edited.
3. Smoke-test against real Supabase using a throwaway test business (create it, exercise the feature via a direct `tsx` script or a local `next dev` server, clean up every row it created — see any recent commit's description for the exact pattern). Server Actions can't be easily curl-tested since they use Next's internal encoding — test the underlying service function directly, or hit the page through a real `next dev` server with `fetch`.
4. Commit, push to `origin main`.
5. Deploy: `vercel --prod --yes`. Verify with a couple of `curl` checks (e.g. homepage returns a redirect/200, not a 500; an unauthenticated API call returns 401, not a crash).

## Supabase CLI

Linked via `supabase link --project-ref <project-ref>` (one-time). `supabase migration list` should show local/remote in sync before pushing a new migration — if it doesn't, investigate before proceeding rather than forcing a push. `supabase db push` needs the project's **database password** (Project Settings → Database in the Supabase dashboard), which is a different secret from the publishable/service-role API keys.

## Vercel specifics

- **Git integration auto-deploys** on push to `main` in addition to any manual `vercel --prod` — it's normal to see two deployments in flight after a push; both build the same commit, either one going `Ready` is fine.
- **Cron** (`vercel.json`) only runs once deployed — see `docs/cron-jobs.md`.
- Environment variables are managed via `vercel env ls`/`add`/`rm` or the dashboard — see `docs/environment-variables.md`.
- No preview-branch workflow is in active use for this project; every deploy targets Production directly.

## Rollback

There's no automated rollback tooling beyond Vercel's own deployment history (`vercel ls`, then re-promote an older deployment via the dashboard or `vercel promote <url>`) and standard `git revert` + redeploy for code. Schema migrations are forward-only — there's no down-migration convention in this repo; reverting a schema change means writing a new migration that undoes it.
