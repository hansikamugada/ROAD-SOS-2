# ROAD SOS — Smart Roadside Assistance

A fresh Next.js App Router project for connecting drivers and local roadside mechanics. All application pages and REST handlers deploy together as one Vercel project. Supabase provides PostgreSQL and authentication. No service key is used by browser code.

## Current implementation

- Marketing landing page and About page.
- Supabase email/password sign-in, registration, recovery, reset, callback, and protected driver dashboard.
- User vehicle and emergency contact fields in registration (database provisioning requires an authenticated signup session; see setup notes below).
- Mechanic application with admin verification queue.
- Browser GPS and manual coordinate discovery, verified mechanic filtering by service radius and service type, distance calculation, and OpenStreetMap view.
- Assistance request creation, mechanic eligibility checks, legal status transition API, request list, and tracking timeline.
- Emergency SOS confirmation, GPS capture, IndexedDB queue, online retry, and idempotent UUID submission.
- PostgreSQL schema and row level security policies.

Some requested capabilities still need project credentials and additional implementation before this is a complete production service: mechanic availability/profile editing, notification panel and Realtime updates, editable profile and emergency contact settings, full customer/mechanic history details, complete mobile viewport/browser QA, and comprehensive end-to-end tests. Never treat an SOS as a substitute for calling local emergency services. Web applications cannot transmit while the device has no connectivity.

## Requirements

- Node.js 20.9 or newer and npm.
- A Supabase project.
- A Vercel project connected to a **new** Git repository.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. Do not put a secret key in any `NEXT_PUBLIC_` variable.
2. Apply `supabase/migrations/20261031000000_initial_schema.sql` using the Supabase SQL editor (or link this folder to a Supabase project and apply with the Supabase CLI).
3. In Supabase Authentication URL Configuration, set the Site URL to the local app URL for development and add `http://localhost:3000/api/auth/callback` to Redirect URLs. For production, set the Site URL to the Vercel domain and add `https://YOUR_DOMAIN/api/auth/callback`.
4. Install and start:

   ```sh
   npm install
   npm run dev
   ```

5. Visit `http://localhost:3000`.

To enable admin access, create a normal authenticated profile first, then promote its `profiles.role` to `admin` from the Supabase SQL editor using the user's UUID. Do not expose database admin credentials in the app.

## Environment variables

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; safe for browser use. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; safe for browser use. |
| `SUPABASE_SECRET_KEY` | Reserved for server-only administrative tasks; currently not consumed by app routes. Never expose it to the browser. |
| `NEXT_PUBLIC_APP_URL` | Local or production origin for links/configuration. |

The implementation uses authenticated Supabase clients and RLS for user data. The server secret is not required for ordinary application requests.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/mechanics?lat=…&lon=…&service=…` | Return verified, available mechanics inside service radius, ordered by distance. Requires valid coordinates. |
| `POST` | `/api/requests` | Create an assistance request. Requires a signed-in driver and validates mechanic eligibility, radius, service, and vehicle ownership. |
| `PATCH` | `/api/requests/:id/status` | Apply an allowed request state transition as the assigned mechanic; the customer may cancel their own request. |
| `POST` | `/api/sos` | Submit an authenticated SOS record. Idempotent by client-generated UUID for offline retries. |
| `POST` | `/api/admin/mechanics/:id` | Admin-only form action to approve or reject a mechanic application. |
| `GET` | `/api/auth/callback?code=…&next=…` | Exchange the Supabase email confirmation or recovery code for a session. |

## Authentication and roles

Supabase SSR clients refresh cookie sessions in `proxy.ts` and server components call `auth.getUser()` before rendering protected pages or accepting protected API actions. Role checks read the `profiles` table, never editable user metadata. Email-confirmed signup depends on the Supabase confirmation setting and redirect allowlist. Test the deployed domain using a real Supabase project before inviting users; production authentication cannot be tested without project credentials and a deployed domain.

## Vercel deployment

1. Create a new Git repository named for this new app and push this directory as its root. This project has not been pushed anywhere.
2. Import that repository into Vercel as one Next.js project.
3. Add the Supabase URL and publishable key as Vercel environment variables for Preview and Production. Add `NEXT_PUBLIC_APP_URL` with the production domain. Do not set a secret key unless a server-only feature explicitly requires it.
4. Set Supabase Site URL and redirect allowlist to the production domain as above.
5. Apply the SQL migration, deploy, and verify login, email confirmation, recovery, RLS, and request flows against the live Supabase project.

## Verification status

Source and file layout were reviewed during creation. `npm install` and `npm run build` were attempted, but both stopped because npm is not installed in this environment. Typecheck, browser testing, database migration execution, and production login checks therefore could not be run. The direct dependencies are pinned in `package.json`, but an npm lockfile could not be generated without npm; run `npm install` and commit the resulting `package-lock.json` before deployment. Next.js 16.4.3 includes the October 2026 security updates; keep it patched before deployment. No feature should be considered production-verified until those checks run.
