# Executive Driving

The website is in `FrontEnd`. The Express booking and events server is in `BackEnd`. The chatbot, OpenAI integration, knowledge maintenance routes and unrestricted image proxy have been removed.

## Run locally

Use Node.js 22 or newer. In `BackEnd`, run `npm ci`, copy `.env.example` to `.env`, and enter your actual mail and event-provider settings. Then run `npm start`. The backend listens on port 3001 by default; `/health` reports whether the process is responding.

Serve `FrontEnd` as the website root, for example with `python -m http.server 5500 --directory FrontEnd` from this folder. Open `http://localhost:5500`. Local booking and event requests use the local backend. Google address suggestions need an appropriately restricted browser API key; the form also accepts typed addresses when suggestions are unavailable.

You can also run `npm start` directly from the main project folder; its root script starts `BackEnd/server.js` and loads `BackEnd/.env`.

## Booking behavior

Return trips have their own pickup, destination, date and time. The route starts reversed from the outbound journey. Return pickup must be later than outbound pickup. Liquor and non-alcoholic drinks have independent preference fields, required only when their option is selected. All options can be combined. These details are included in the team and customer emails.

The server validates submissions, saves each request before attempting email, and deduplicates retries with an idempotency key. While submitting, a spinner, progress strip and status message show that the request is in progress. Successful submissions open a dedicated thank-you page with the same site navigation and footer, a request reference and next steps. A failed delivery leaves the form filled and shows a reference plus retry/contact instructions. Customer email failure does not undo successful delivery to the team. Requests are subject to availability and final confirmation.

Client care requests on Home and Events use the same validated delivery system. Notification preferences are saved, but there is no automated marketing-email scheduler or notification sender in this project.

## Production configuration

- Deploy `FrontEnd` as the public site root; keep the backend, `.env`, runtime data, logs, archives and review output private.
- Set `ALLOWED_ORIGINS` to the exact website origins used by the deployment, including any preview host you intend to support. Configure `TRUST_PROXY_HOPS` only for the actual trusted proxy chain. Without it, rate limits use the direct connection address.
- Set `DATA_DIR` to an absolute path on persistent private storage. The default is `BackEnd/data`; files on ephemeral hosting disks do not survive replacement or redeployment. Back up this directory and apply your retention policy.
- `bookings/*.json` stores delivery status and the reference ID; failed deliveries require a retry or manual follow-up. There is no automatic retry worker. `subscriptions/*.json` stores notification preferences.
- This file-backed store and in-memory limits are intended for one backend process. Multiple instances require a shared database/queue and distributed limits. SMTP delivery cannot guarantee exactly once across a process crash after the provider accepts mail but before the sent status is saved.
- Keep browser Google Maps credentials restricted to the intended origins and APIs. Backend provider credentials belong only in environment settings.
- Default booking limit is 10 requests per client IP per minute; the shared API limit is 120 per minute. These controls reduce casual abuse; production bot protection can be added at the hosting edge.

## Checks

From `BackEnd`, run `npm test`, `npm audit`, and `npm run test:browser`. The browser check uses installed Windows Chrome by default; set `CHROME_PATH` to another Chrome/Chromium executable if needed. Browser tests use temporary storage and a fake mail transport: no real emails are sent. Screenshots are saved under `output/repair-checks`.

With the local site running on port 5500, `npm run test:mobile` from `BackEnd` checks form widths, heights, spacing and mobile focus across six viewport sizes.

The five older `output/verify-*.cjs` regression scripts are also retained. They use mocked DOM controls; the new browser check exercises actual desktop and mobile form submission against the HTTP backend.

Run `python tools/prepare_deploy.py` from the project root to refresh `output/deploy-review` from the current source. Previous output is archived before replacement. Do not deploy `output` itself. Historical pages, unused backup code, saved web-page resources and the pre-repair source ZIP are retained under `output` for recovery, outside the public source tree.
