# Original folder code review

**Historical findings from before repairs. See [FIXES.md](FIXES.md) for the completed changes and current validation, and [README.md](README.md) for setup.**

Reviewed November 8, 2026. This is a review, with no application code changed.

## Highest priority findings

1. **Backend cannot start.** `BackEnd/server.js:1` begins with `fff// server.js`. Running `node server.js` reproduces `ReferenceError: fff is not defined` and exits before listening. The deployment copy does not contain this typo.

2. **Unrestricted server-side URL fetching.** `BackEnd/server.js:89` accepts any `url` in `/api/tm-image` and fetches it, follows redirects, and streams the response. There is no destination allowlist, private-network protection, response-size limit, or timeout. This permits requests from the server to destinations chosen by a caller. Restrict this to explicitly approved image hosts and validate redirects, response types, sizes, and timeouts.

3. **Public booking and chat endpoints lack abuse controls.** `/book` and `/chat` can trigger email and paid external API calls without rate limiting or other abuse protection. Reflected unrestricted CORS also allows arbitrary browser origins to call them. Public booking is expected, but request throttling, concurrency limits, and suitable bot protection are needed; CORS alone cannot prevent direct HTTP abuse.

4. **Failed chat bookings claim to be saved when they are not.** The email failure handlers around `BackEnd/server.js:1267` and `:1431` promise that the request is safe and will be escalated. There is no durable booking write or escalation queue in either path. A failed email can therefore lose the booking while telling the customer it succeeded operationally. Persist requests before delivery and accurately report pending/failed delivery.

5. **Booking validation is missing on the server.** `/book` at `BackEnd/server.js:855` mostly checks truthiness. Invalid dates, arbitrary times, negative/fractional passenger counts, invalid contact details, non-string values, and incomplete return journeys can bypass frontend validation. The concierge branch has similar gaps. Validate types, lengths, formats, chronology, and capacity on the server before sending mail. Share validation across form and chat paths.

6. **Unescaped values enter browser HTML.** `FrontEnd/js/event.js:484` onward interpolates external event IDs, names, venues, and image attributes into HTML. `FrontEnd/js/script.js:808` puts booking values into `li.innerHTML`. Use textContent and DOM attribute setters, with explicit URL validation for remote images. The booking summary issue is a confirmed unsafe sink; exploitability depends on how an attacker can influence the submitted values.

## Functional and reliability findings

- **Subscriptions are not saved.** `BackEnd/server.js:1586` returns success but only logs the subscription. Restarting the process loses it, and no notification delivery workflow exists.
- **Invalid chat dates and times pass validation.** `parseDateSmart` accepts any ISO-shaped date and permits nonexistent dates such as February 31. `invalidReason` accepts numeric-shaped dates without calendar validation. `timeNeedsAmPm` does not reject arbitrary strings such as `banana`; past pickup dates are not rejected either.
- **Chat submissions are not idempotent.** Replaying a complete conversation can send another booking email. Add a persisted request identifier and deduplication.
- **Nightlife for all cities only queries Edmonton.** The frontend requests `city=all`; the nightlife endpoint falls back to Edmonton coordinates and labels results with `city: all`. Grande Prairie results are never fetched by this request, and city filtering can discard these records.
- **Ticketmaster categories are discarded.** The backend maps events without their classification/genre fields, while frontend categorization expects them. Many events fall back to name heuristics or `other`, making category filters incomplete.
- **Upstream failures can look like empty results.** Ticketmaster and nightlife handlers parse JSON without checking HTTP success and may respond successfully with empty arrays on provider errors. Add status checks, timeouts, and clear failure responses.
- **Calendar exports use the visitor's timezone.** Event times are local to the venue, but `generateICS` constructs a Date in the browser's timezone before converting to UTC. A visitor in another timezone exports the wrong instant. Nightlife cards also expose calendar export with null dates, which can throw. Use venue timezone data and disable export for undated listings.
- **Booking date summaries can show the preceding day.** `FrontEnd/js/script.js:753` parses a date-only ISO value as UTC and formats it locally. In Canadian timezones this can display the previous date. Parse date components as a calendar date.
- **Runtime paths depend on the launch directory.** Email logo and knowledge file paths use `process.cwd()`. Launching from the repository root can break the logo attachment and read/write a different knowledge file. Resolve paths relative to the module.
- **A dependency is imported without being declared.** `server.js:87` imports `node-fetch`, absent from package.json. It currently resolves transitively through installed dependencies, but should be a declared dependency or replaced with the supported Node native fetch API. Native fetch requires adapting the image proxy's Node stream handling.
- **Public maintenance route.** Anyone can call `/kb/reset`; remove the development endpoint from production or authenticate it.
- **Customer data appears in logs.** The backend logs complete booking bodies and subscription contact details; the frontend logs the full booking payload. Remove these debug logs or redact personal data.
- **Uncaught exceptions are swallowed.** The global uncaughtException handler logs and leaves the process running. This can leave an unhealthy process active; use deliberate shutdown and process supervision.

## Folder and deployment findings

- The folder has no Git repository metadata, README, standard test script, or documented environment setup. There is no .env in the backend folder, so external integrations cannot be validated from the supplied configuration.
- `output/deploy-review` contains a divergent backend copy. Most primary frontend source files match; backend files and older backup pages differ. Choose a single source and generate deployment artifacts from it to avoid deploying inconsistent fixes.
- `FrontEnd/images/cmd.html` and `cmd_files` contain a saved web page and its resources, not normal site image assets. Review whether they contain private content and remove them from any public artifact if unnecessary. Their contents were not treated as instructions.
- SQLite database, WAL/SHM, and backend logs are present at the backend root. The .gitignore database patterns target `BackEnd/data/`, so they do not cover these actual database locations. Their private contents were not included in this review.
- Old `B.*` HTML pages and backup JavaScript/CSS remain alongside current pages. `B.fleet.html` references nonexistent `contact.html`. Separate archival material from public assets.
- `fleet.html` references a Cloudflare-generated `/cdn-cgi/.../email-decode.min.js` that is absent locally; verify whether the actual hosting platform provides it. Root-relative favicon paths are valid when FrontEnd is the site root and should not be mistaken for missing assets.

## Validation and limitations

- Inventoried 608 files excluding node_modules at review time; included current source, backups, and deployment output in automated checks. Binary media was inventoried, not visually reviewed, and third-party dependency source was not manually audited.
- Checked 37 JavaScript/CJS files outside saved-page image resources: all pass `node --check`. Runtime startup fails as described above.
- Ran all five existing `output/verify-*.cjs` checks: custom event required fields, event suggestions, form controls, refreshments, and return trip all pass. These use mocked environments; they do not establish full browser or external integration correctness.
- Scanned top-level frontend HTML references and duplicate IDs: no duplicate IDs found. Root-relative favicon references resolve when FrontEnd is served as root.
- `npm audit --json` reported 10 affected dependency entries: 1 critical, 8 high, and 1 moderate. These are registry audit classifications, including transitive and development dependencies, not proof that each advisory is exploitable here. Review compatible upgrades and test them; the suggested nodemailer upgrade crosses major versions.
- No email was sent, no subscription was created, and no deployed endpoint was changed. Browser layout, SMTP, OpenAI, Google, and Ticketmaster integrations have not been verified end to end. CSS has not received a full visual or accessibility audit.

Recommended order: restore startup; restrict the proxy and public endpoint abuse; persist requests and validate server input; eliminate unsafe HTML sinks; repair event/notification behavior; then consolidate deployment and documentation.
