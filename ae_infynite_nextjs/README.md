# AE Infynite Printing — Next.js project

## Run locally
1. Install Node.js 18.17 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, service-role key, and shared APP_PASSWORD.
4. Run `npm run dev`, then open http://localhost:3000.

## Deploy to Vercel
1. Push this folder to a GitHub repository and import it into Vercel.
2. Vercel should detect the Next.js framework.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_PASSWORD` in Project Settings → Environment Variables.
4. Run `supabase.sql` in Supabase SQL Editor.
5. Redeploy.

The interactive calendar/order interface is in `public/schedule.html`, served inside the Next.js app. The `/api/data` route provides online shared saving. Editable text fields are black.

Security: never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or a `NEXT_PUBLIC_` variable. The app uses a shared password, not individual staff accounts.
