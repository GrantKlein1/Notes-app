# Notes

iPhone-first notes app: general notes, a monthly budget, and a prayer list. It installs to the home screen, keeps a copy on the phone, and syncs to Supabase.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run build` typechecks and builds the PWA.

## Sign-in

Email one-time code only. Magic links open Safari instead of the installed app, so the Magic Link email template must show the code and not a link.

In the Supabase dashboard for project `aamzidnoqsbcxwjjqfdj`:

1. Open [Email templates](https://supabase.com/dashboard/project/aamzidnoqsbcxwjjqfdj/auth/templates).
2. Edit **Magic Link**.
3. Subject: `Your sign-in code`
4. Body: include `{{ .Token }}` and remove `{{ .ConfirmationURL }}`.
5. Save.

Email sign-in is on by default. The built-in mailer is rate-limited; a custom SMTP provider is only needed if codes stop arriving.

## Phone

In Safari, share the site, then **Add to Home Screen**. The home-screen shortcut **Add expense** opens quick spend.

Prayer focus mode hides the app chrome, keeps the screen awake on iOS 16.4+, and leaves on a triple-tap. The status-bar clock cannot be hidden. The top safe area is painted to match the background; check that contrast on a real iPhone.

## Data

Schema and row-level security live in `supabase/migrations/`. The phone writes to IndexedDB first. Sync is last-write-wins on `updated_at`. Deletes set `deleted_at` so they propagate.

Do not put the service-role key in `.env` or in any `VITE_` variable.
