# Repairs completed November 8, 2026

## Booking form

- Corrected the misspelled non-alcoholic checkbox name, which prevented its selected state from reaching the submit handler.
- Replaced the broad payload truthiness loop with an explicit list of required fields, so optional fields and structured add-ons do not determine whether a submission is allowed.
- Kept the return section's reversed route, editable addresses, required return date/time and chronology validation. Hidden sections are disabled and do not block submission. All eight combinations of the three options were submitted successfully in Chrome on desktop and mobile.
- Corrected liquor preference labels, placeholder text and validation messages. Liquor and non-alcoholic preferences stay independent and are required only while selected.
- Included complete return and drink details in both the team and customer email, with escaping and without duplicating details already supplied by older clients.
- Added visible submission errors, retained form values after a delivery failure, blocked duplicate clicks and reused request IDs on retries.
- Fixed Client Care submissions referencing a nonexistent return-trip checkbox and ambiguous form properties. Added validation, busy state, useful errors and retry IDs there too.
- Preserved the site design. Updated changed script versions so browsers reload the repaired code.

## Backend and safety

- Removed the chatbot, OpenAI dependency, knowledge endpoints and unrestricted image proxy. Fixed backend startup.
- Added shared server-side type, contact, calendar date, passenger count, time and conditional-field validation.
- Added restricted origins, request-size limits, request throttling, external-service timeouts and event-response caching.
- Saved booking requests before sending mail, recorded delivery status and added retry deduplication. Failed email delivery returns an accurate error and request reference.
- Removed customer-data debug logs. Email assets and environment files resolve relative to the backend module.
- Updated vulnerable dependencies; both full and production dependency audits reported zero vulnerabilities at verification time.
- Nodemon ignores new runtime records to avoid restarting whenever a booking is saved.

## Events and other files

- Preserved Ticketmaster classification/genre for category filters; nightlife fetches both cities with correct labels.
- Provider failures now produce error responses instead of empty success results.
- Escaped external event HTML and booking summary values.
- Corrected calendar timezone handling, escaped calendar text and disabled export on undated nightlife venues. Fixed date-only booking summaries shifting back one day.
- Corrected filter reset and applied search state.
- Notification preferences are actually saved. Automated event notification delivery remains outside the implemented project; there is no sender or scheduler.
- Removed unused chatbot styling and the missing Cloudflare-generated script reference.
- Archived historical backup pages, unused backup scripts/styles, saved browser resources and chatbot knowledge under `output/archive/legacy-source`; preserved a source ZIP at `output/pre-repair-source.zip`.
- Added setup/deployment documentation, environment example, tests, private-data ignore rules and a reproducible deployment packaging script. Refreshed `output/deploy-review` from current source, without runtime data or credentials.

## Verification

- Ten automated tests: all eight backend add-on combinations, validation rejection, durable failures, idempotent retry, client care, removed routes, throttling, origins, provider errors/cache, both nightlife cities, saved subscriptions, event escaping/calendar behavior, and real Nodemailer MIME generation with the inline logo.
- Chrome desktop and mobile: all eight add-on combinations submitted through the actual UI to a real local HTTP backend using a fake mail transport; checked return-time errors, missing liquor preferences, toggling off invalid options, delivery failure/retry, client care, missing chatbot, and horizontal overflow across current pages.
- Five existing verification scripts passed.
- JavaScript syntax, inline script syntax, current HTML local references/duplicate IDs and CSS parse checks passed. Desktop/mobile screenshots are in `output/repair-checks`.

No live email was sent and nothing was deployed. Actual SMTP and provider credentials were not available in this folder, so live delivery and provider accounts remain unverified. Configure the settings in `BackEnd/.env.example`, persistent private `DATA_DIR` storage and the exact production origins before deploying. The file-backed store supports one backend process; see README for deployment and recovery limits.


## Quote receipt email update

Replaced decorative email panels and logo artwork with a restrained invoice-style quote request receipt: typographic branding, thin muted gold rules, a readable reference, submission date and awaiting-quote status. Customer emails show the requested service, route, date/time in Alberta time, passengers, supplied luggage/flight/vehicle preferences, return journey and selected drink extras. Notes use the customer-entered content rather than repeating internal generated summaries. The receipt explains that pricing will follow, no payment is requested and the ride requires written confirmation. Customer replies go to the bookings mailbox. Team and service-enquiry templates share the same styling.

Actual rendered previews are in `output/email-preview`, including desktop/mobile PNGs and HTML. No live emails were sent during previewing.


### Paper receipt refinement

Reworked the email into a printed retail request slip after reviewing a photographed Calvin Klein retail receipt and fashion-stationery examples. Uses cream paper, light coffee trim, espresso type, a compact fashion-style Executive Driving wordmark, monospaced receipt details, dashed separators and a ruled quote-total row. Includes customer contact information, journey details, return trip and selected extras; remains clearly a quote request awaiting pricing, with no payment requested. All 11 automated tests passed; actual desktop/mobile templates were rendered and visually checked, including a mobile overflow check. No live emails sent.

Design references:
- https://www.ozbargain.com.au/node/522822
- https://www.behance.net/gallery/238296355/SUBJCT-BRAND-IDENTITY
- https://www.behance.net/gallery/202377181/ANC-Fashion-brand-Visual-Identity


### Logo, star dividers and notification wording

Latest customer-approved direction uses a white receipt with black type, the company logo at top left and a small gold accent. Three horizontal dividers are made of repeating gold asterisks; solid/dashed rules and coffee paper trims are removed. The logo is rendered from the existing company vector, with a gold accent, and embedded by CID for email delivery. The body label is only Customer copy. The customer email subject starts Request received, followed by Executive Driving and the reference; preview text explains that availability and pricing will follow. Eleven automated tests, including subject wording and inline-logo MIME generation, passed. Desktop/mobile previews were regenerated without sending real emails.


### Monochrome compact header

Removed all coloured paper backgrounds and gold accents. Uses a white background, black star dividers and a monochrome logo. The smaller Quote request heading and Customer copy label now sit on the same header row as the logo. Request received remains the customer notification subject. Eleven tests passed and actual desktop/mobile previews were regenerated.

The header star divider was removed at the user's request; the customer receipt retains two star dividers lower down.

Latest email styling restores the original logo colours: red #be1e2d, charcoal #231f20 and grey #666868 on white. The logo remains top right. PAX is labelled Passengers, and the journey headings are Outbound trip and Return trip without numeric prefixes. Eleven tests passed and previews were regenerated.


## Form submission feedback and thank-you page

The original form required a phone number and the team email included it. The phone requirement is preserved, is labelled clearly, and now validates the format before an HTTP request is sent.

Quote and client-care submissions now show a loading button with a small spinner and status text. Quote forms also have an indeterminate progress strip. Success navigates to `thank-you.html`, using the same header/navigation, footer and policy dialogs. The page shows the request reference, journey summary and accurate next steps. It distinguishes receipt-email success from team-only delivery and does not claim that the ride is confirmed. A direct visit without a recent submission shows a neutral prompt instead of a false receipt. Details are stored temporarily in the current browser tab; no contact details are put in the URL. Failure keeps the form filled, displays and focuses a visible error, and restores the submit button. Reduced-motion preferences are respected.

Chrome desktop/mobile checks passed for all eight combinations of return trip, liquor and non-alcoholic drinks, plus phone validation, loading state, successful page navigation, delivery failure/retry and client-care success. Existing five regression scripts passed. Screenshots are in `output/repair-checks`.


## Gez / team ride-request email

Changed only the team ride-request email to match the thank-you page card supplied as a reference: light neutral outer background, off-white rounded card, compact logo/header, reference row and clear horizontal table rows. Shows customer contact details, complete outbound and return trips, passenger/luggage/flight/vehicle information, selected extras and customer notes. The subject begins New ride request. Customer email styling is unchanged. Eleven automated tests passed, including all eight add-on combinations and inline-logo MIME generation. Sample previews were rendered without sending real emails.


## Mobile form entry

Added an early mobile focus guard on the Quote, Events and Home form pages. Initial script/browser-restored editable focus is dismissed before user interaction, including reloads and return navigation. Real taps and keyboard interaction release the guard, preserving typing, accessibility keyboard navigation and validation focus after intentional interaction. Desktop focus is unchanged. Chrome mobile checks passed for quiet initial loads, unprompted-focus prevention, tap-to-type, reload and back-navigation; desktop focus also passed. Source files and deployment output are saved.


## Mobile form consistency / local publication

User clarified that make it live means the local test site only. Public hosting was not changed.

Added a shared form layout layer for Quote and both Client Care forms. Inputs are 48px high, textareas have the same baseline height, paired fields use equal columns, and ordinary vertical field spacing is consistent. Date/time fields now fill their available width; removed the old 85% width restriction. Empty validation slots no longer add inconsistent blank space. Name/Phone remain side by side with the area-code subtitle, and Passengers/Luggage remain side by side. Client Care now uses the same Name/Phone grouping, field spacing and date-picker button. The return-trip and drink sections share the same field geometry. Failure styling resets correctly when retrying.

Verified Quote, Home Client Care and Events Client Care at 320, 360, 390, 430, 768 and 1440 pixels, including expanded extras and no automatic focus or horizontal overflow. All eleven backend/template tests, sixteen desktop/mobile add-on submission combinations, error/retry checks and the five existing regressions passed. No live emails were sent during QA. Updated files are served locally on port 5500, and the latest backend was started on port 3001 with a passing health check. Review screenshots are in output/mobile-layout.

## Event panel focus and mobile navigation stability

Opening “Don't see your event?” no longer focuses its event-name input. Users select a field themselves before typing. Mobile filter opening also avoids automatically focusing search; closing filters restores button focus without scrolling. Form validation, event suggestions and quote prefilling remain intact.

The mobile header previously shrank from 80px to 72px while its logo grew from 60px to 80px on scroll. Both now retain their original mobile sizes, and the mobile header entry animation is disabled. Desktop scroll styling is preserved. Shared stylesheet cache versions were updated on all six pages.

Chrome checks passed at 320, 360, 390, 430, 768 and 1440 pixels: custom-event opening/reopening, field selection, switching from filters, overflow, existing form geometry and stable mobile header/logo sizes. Custom-event validation and suggestion regressions also passed. Screenshot: output/mobile-layout/custom-event-390.png. Changes apply to the local test site only.

## Matching team and customer quote emails

The team quote-request email now shares the customer's receipt layout: white background, compact heading, logo on the right, Courier trip details and two black star dividers. It is labelled TEAM COPY and REQUIRES FOLLOW-UP, retains customer contact details, full trip and extras information, and gives staff instructions for replying with a quote. Internal follow-up notes remain restricted to the team email. The customer email output is unchanged. Thirteen tests passed, and actual desktop/mobile previews were rendered without sending email.
