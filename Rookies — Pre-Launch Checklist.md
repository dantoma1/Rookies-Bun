# Rookies — Pre-Launch Checklist

Pre-deployment work needed before sharing the URL with TiU and inviting the first real students. Items numbered to match your list. Each one has a short *what*, a short *why it matters*, and concrete *next steps*. Add a `[x]` next to a step when it's done so you can track progress.

> **Suggested order**
> Day 1: items 1, 12, 4 (security, mobile/laptop polish, validation visuals — they're the highest-leverage / quickest wins).
> Day 2: items 2, 3, 5, 8 (data hygiene + GDPR docs + forgot-password flow).
> Day 3: items 7, 9, 10 (email — these are dependent on each other).
> Day 4: items 6, 11 (onboarding + analytics).

---

## 1. Set up security

**What this is.** Lock down what an anonymous visitor can read or write through the public Supabase anon key, decide who can log in from where, and harden the basics.

**Why it matters.** The anon key is in the public HTML — that's normal — but it means anyone in the world can hit your Supabase as long as Row-Level Security policies allow it. Without a tight RLS audit, someone could read every student's email, edit other students' profiles, post fake jobs, etc. For a TiU partnership pitch, this needs to be airtight before going live.

**Steps.**
- [ ] Audit every table's RLS policies: `students`, `employers`, `jobs`, `applications`, `messages`, `company_recruiters`, `contact_messages`. For each, confirm: who can SELECT, INSERT, UPDATE, DELETE — both as authenticated user and as anonymous visitor. The Supabase MCP can dump this for review.
- [ ] Set Auth → URL Configuration → Site URL + Redirect URLs to your final domain (e.g. `https://rookies.app`). Otherwise login redirects break in production.
- [ ] Set Auth → Email confirmation **required** for new signups (currently may be off).
- [ ] Set a sensible password policy: min 8 chars, prevent compromised passwords (Supabase has a built-in HaveIBeenPwned check — turn it on).
- [ ] Add a captcha to the public signup forms — Supabase supports hCaptcha and Turnstile out of the box.
- [ ] Storage buckets (`avatars`, `cvs`): confirm policies are not "anyone can write" — only the authenticated student should be able to upload their own files.

**Effort.** Half a day if I do the audit through the MCP and propose policy changes for you to approve.

---

## 2. Set up max characters in all the fields

**What this is.** Every text input and textarea should have a sensible `maxlength` attribute. The bio shouldn't accept 50,000 characters; the company name shouldn't accept 200; etc.

**Why it matters.** Right now nothing prevents a single student from pasting a novel into their bio. That breaks UI layouts (cards overflow), inflates database storage, and creates a vector for abuse. Limits should match how the data is rendered — bio is shown in 2-3 lines on cards, so 280 chars is plenty.

**Steps.**
- [ ] Decide a length budget for each field. Suggested baseline:
  - Names, titles, role labels: **80** chars
  - One-line fields (location, university, division): **100** chars
  - Email, URLs: **150** chars
  - Bio, short description: **280–400** chars (tweet-length-ish)
  - Long-form description, qualifications, message templates: **2,000** chars
  - Education / experience / org `desc` text: **600** chars
- [ ] Add `maxlength="N"` to every `<input>` and `<textarea>` accordingly.
- [ ] Add a small live counter under the textareas (e.g. "120 / 280") so students see the limit before they hit it.
- [ ] Mirror these limits server-side via Supabase column constraints or check constraints — client-side maxlength can be bypassed.

**Effort.** ~2 hours if I do all forms in one pass.

---

## 3. Make fields compulsory in both student and company profile

**What this is.** Decide which fields are required for a profile to be considered "complete enough to be visible," and prevent saving a half-empty profile.

**Why it matters.** A profile with no skills, no degree and no location is invisible to the matching formula and useless to companies. The pitch promises "verified student talent" — verified can mean many things, but a minimum baseline of completeness is the floor.

**Steps.**
- [ ] Decide which fields are **required** vs **recommended**. Suggested student required: name, university, level, current_status, field_of_study, pref_type, pref_locations, pref_sectors, work_auth, at least 1 education entry, at least 3 skills total, language. Suggested company required: company_name, sector, size, description, website.
- [ ] Add a visible "Required" indicator on those fields (an orange asterisk in the existing form-label style).
- [ ] On Save, validate all required fields are non-empty; refuse to save and scroll the user to the first missing field.
- [ ] On Browse Rookies / job listings, hide profiles/jobs that don't meet the minimum bar — or show them with a "Profile incomplete" badge.
- [ ] Connect this to the existing **profile completeness bar** in the student profile (already shows a percentage) — make 100% mean "all required fields filled."

**Effort.** Half a day. Best done together with item 4.

---

## 4. Add message under the field with red-ish text if field wasn't filled

**What this is.** Inline validation feedback. When a required field is empty (or invalid), show a small red message right under it.

**Why it matters.** Without this, users hit Save, see nothing happen, and don't know why. Inline messages are the modern standard — Supabase, GitHub, Stripe, every well-designed product does it.

**Steps.**
- [ ] Add a CSS class `.field-error` (red message, 12px, bottom margin) and `.form-input.error` (red border).
- [ ] Define validators per field: required, min length, valid email, valid URL.
- [ ] Trigger validation on **blur** (when user leaves the field) and on **submit**. Don't shame people the second they start typing — only after they've moved on.
- [ ] Specific error messages, not generic ones: "Please add your university" vs "This field is required."
- [ ] Clear the error state automatically once they fix it.

**Effort.** A day if done thoroughly across both signup forms + the profile editor + the post-listing form. Great pairing with item 3.

---

## 5. Research GDPR and Terms & Conditions

**What this is.** Legal documents you must publish and link from every screen before processing real EU students' data: a Privacy Policy and Terms of Service. Plus the underlying compliance work that backs them up.

**Why it matters.** Non-negotiable for an EU platform handling student data. The TiU dean's office will check before signing anything. Penalties for ignoring this can be up to 4% of annual revenue, but the realistic risk is much simpler: TiU walks away.

**Steps.**
- [ ] Use a generator (Termly, iubenda, free tier ~€10/month) to draft Privacy Policy + ToS + Cookie Policy. They produce something legitimate-looking in 30 minutes.
- [ ] Read through and adapt: name yourself as data controller, list the categories of data you collect (profile info, application data, messages), state retention period (e.g. 24 months after account deletion), and cite the legal bases (consent for marketing, contract for the service itself).
- [ ] Build a `/privacy` and `/terms` route — for a single-file app, simply a new screen `screen-privacy` / `screen-terms` showing the rendered markdown.
- [ ] Link from the footer of every screen and from the signup forms (small "By creating an account you agree to our Terms and Privacy Policy" with both linked).
- [ ] Implement a working **Delete my account** path (already done in the new Settings page).
- [ ] Implement a working **Download my data** path (already done in the new Settings page).
- [ ] Cookie consent banner: only needed if you add analytics or marketing trackers. If you stick to Plausible (privacy-friendly, no consent required under GDPR's "strictly necessary" exemption), you can skip the banner. PostHog or GA4 — banner required.

**Effort.** A full day if you want it solid. The actual writing is fast; the thinking takes time. Worth doing properly because once published, it's the document a regulator or a journalist would read.

---

## 6. Think about some introductory page where everything is explained

**What this is.** A first-time-user onboarding experience. Either a guided tour, a 30-second video, or an "About Rookies" page that explains the platform's promise and how to use it.

**Why it matters.** First impressions are made in 10 seconds. The landing page sells the *idea*; the post-signup screen needs to teach the *product*. Right now after signup, students drop straight into the empty browse view. Companies into an empty dashboard. Both feel cold.

**Steps.** Pick **one** of these patterns — don't over-build:

- [ ] **Pattern A — Welcome modal.** A 3-step modal that pops once after first signup. "1. Set up your profile · 2. Browse listings · 3. Apply." Closes for good after dismissed. Lightweight, ~2 hours.
- [ ] **Pattern B — Empty-state CTAs.** No modal, but every empty section ("No applications yet" / "No matched listings yet") gets a clear "Here's what to do" CTA. More subtle, slightly more work spread across screens.
- [ ] **Pattern C — Dedicated `/about` or `/how-it-works` screen** linked from the top nav. Useful for visitors who haven't signed up yet but want to learn more. Closer to a marketing page.

**Recommendation.** Pattern A + Pattern B together. Skip C unless you also want a marketing site, which Squarespace or similar handles better than your single-file app.

**Effort.** Half a day for A+B.

---

## 7. Set up email messages at login

**What this is.** Customize the transactional emails Supabase Auth sends — sign-up confirmation, magic link, email change confirmation. Right now they all use Supabase's default English templates.

**Why it matters.** Default templates look like *"Confirm your email — Powered by Supabase"* with no Rookies branding. That instantly tells a user "this is a side project." For the pitch, every touchpoint needs to feel like Rookies, not someone else's infrastructure.

**Steps.**
- [ ] In Supabase Dashboard → Authentication → Email Templates, customize each template:
  - **Confirm signup** — "Welcome to Rookies, [name]! Click here to confirm your email."
  - **Magic link** — "Sign in to Rookies — your link expires in 1 hour."
  - **Reset password** — see item 8.
  - **Change email address** — confirms the new address.
- [ ] Use HTML templates that match the Rookies brand: navy header, orange accent, DM Sans / Playfair Display where possible.
- [ ] Make sure subject lines are clear and specific.
- [ ] Test every flow end-to-end with a dummy account.

**Effort.** 1–2 hours.

**Dependency.** Item 9 + 10 — the templates are pointless if they still come from `noreply@supabase.io`.

---

## 8. Set up a field with "Forgot password?" and email message if password was forgotten

**What this is.** The public, pre-login password-reset flow. Different from the in-Settings password change (already built). This one is what someone clicks when they're locked out.

**Why it matters.** Every login screen on every product has this. Without it, a student who forgets their password is permanently locked out. Currently the login screen has no way to recover an account.

**Steps.**
- [ ] Add a "Forgot password?" link below the login form's password input.
- [ ] On click, open a small modal asking for their email.
- [ ] Call `db.auth.resetPasswordForEmail(email)` — Supabase emails them a reset link.
- [ ] Build a separate screen (`screen-reset-password`) that the email link points to. Reads the recovery token from the URL, lets the user enter a new password, calls `db.auth.updateUser({ password })`.
- [ ] Customize the reset-password email template (see item 7).

**Effort.** ~3 hours including the new screen.

---

## 9. Set up email domain

**What this is.** Configure custom SMTP so transactional emails come from `noreply@rookies.app` (or whatever domain you own) instead of Supabase's default.

**Why it matters.** Sending email from your own domain is a credibility multiplier and a deliverability multiplier. Default Supabase emails often land in spam; properly configured domain emails land in the inbox. For a TiU-credible platform, this is non-optional.

**Steps.**
- [ ] Pick an email provider — recommended for ease: **Resend** (best-in-class developer UX, free tier 3,000 emails/month), or **Postmark** (most reliable for transactional). Avoid SendGrid for new accounts — onboarding is painful.
- [ ] Verify your domain in the provider dashboard. They'll give you DNS records to paste.
- [ ] Add SPF, DKIM, and DMARC records to your domain DNS (Squarespace's DNS panel handles this).
- [ ] In Supabase Dashboard → Authentication → SMTP Settings, plug in the provider's SMTP credentials.
- [ ] Send a test email to yourself, confirm the From address shows `rookies.app` and lands in the inbox, not spam.

**Effort.** 2–4 hours, mostly waiting for DNS propagation.

**Dependency.** You need the actual domain set up first (we already covered the domain → host link in our earlier conversation).

---

## 10. Set up recovery and info-message email domain

**What this is.** This is essentially the same as item 9 — *all* transactional email (login confirms, password resets, application status updates, weekly digests) comes through the configured custom SMTP domain.

**Why it matters.** Same as item 9 — consistency. If your login email comes from `rookies.app` but your password-reset email comes from `noreply@supabase.io`, the user's brain stutters. Worse, recipients might mark one as spam and not the other.

**Steps.**
- [ ] Once item 9 is done, every Supabase Auth email automatically uses the custom SMTP — no extra work for the *Auth* emails.
- [ ] For *application* emails (status updates, weekly digests, invite-to-apply messages) you'll send those via the same provider directly, not through Supabase Auth. That requires a small backend or Supabase Edge Function — not something to build pre-pilot, but worth scoping.
- [ ] Pre-pilot, the in-app messaging system already works without sending email — fine for the demo. The push to "messages also email people" is a v2 enhancement.

**Effort.** Mostly already covered by item 9.

---

## 11. Understand what is the point of analytics

**What this is.** Tracking what visitors and users do on the site so you can make decisions based on data, not vibes. Things like: how many people land on the home page, how many sign up, where they drop off in the funnel, which jobs get the most applications.

**Why it matters.** Without analytics, three weeks into the pilot you can't tell the dean *"X students signed up, Y applications submitted, Z% match rate."* You'd be making the case from gut feeling. Analytics is what turns "we think it's working" into "here's the proof."

**What to actually measure for the pilot:**
- Unique visitors to landing page → unique signup conversions (the funnel)
- Day-1 / day-7 / day-30 retention by role
- Profile completeness distribution among signed-up students
- Number of applications per active job
- Companies that posted ≥1 listing vs. companies that signed up and went silent
- Drop-off points: where do people leave the signup form? where do they bounce on the dashboard?

**Tool choice:**
- [ ] **Plausible** — privacy-friendly, EU-hosted, GDPR-compliant out of the box (no consent banner needed). Good for the basics. ~€9/month. **My recommendation for the pilot.**
- [ ] **PostHog** — much more powerful (funnels, session replays, A/B testing) but requires a cookie banner. Free tier generous. Worth graduating to once the pilot is past launch.
- [ ] Avoid Google Analytics 4 — clunky, requires consent banner, and has [legal grey areas](https://noyb.eu/en/austrian-dpa-finds-eu-us-data-transfers-google-analytics-illegal) for EU traffic.

**Effort.** Plausible setup is 15 minutes — paste a script tag into the HTML, done.

---

## 12. Make sure website is visible on all the laptops (scales, visibility, etc.) — ran it on another laptop and not all data rendered

**What this is.** Your friend opened the file on a different machine, and parts of the page didn't render correctly or didn't fit. We added a responsive baseline last session, but the specific failure she saw isn't fully diagnosed.

**Why it matters.** First impressions are made on whatever device the dean opens the link on. If it's broken on a 13" MacBook Air, it's broken for half your audience.

**Steps.**
- [ ] **Get a screenshot from her** — the single most useful thing. Even a blurry phone photo of her laptop screen tells me what failed and where.
- [ ] Ask her: what laptop / browser? (Safari on a small Mac vs Chrome on a big Windows screen behave differently.)
- [ ] In the meantime, test it yourself on:
  - Chrome with DevTools set to 1280×800 (small MacBook)
  - Chrome with DevTools set to 1366×768 (very common Windows screen)
  - Chrome with DevTools set to 1920×1080 (typical big monitor)
  - Safari on whatever device you have
  - Firefox at any size
- [ ] Walk through these screens and click everything: landing → login → signup → student profile → post listing → all the modals.
- [ ] Note any scroll bugs, overlap, cutoff text, missing buttons. Send me the list and I can fix specifically what's broken.
- [ ] Possible specific suspects: the company dashboard's `dash-grid` (`grid-template-columns: 1fr 340px`) might wrap awkwardly on small screens; the post-listing modal's tab nav might overflow; the hero scroll-progress indicator might overlap text on weird viewport ratios.

**Effort.** 1 hour to test, plus however long fixes take based on what's actually broken.

---

## A few items not on your list but worth flagging

- **Empty database hygiene.** The legacy seed students with junk names ("test test", "Tudor Poenaru" with offensive bio in Romanian, "coleg a", etc.) are still in the live `students` table. Anyone hitting Browse Rookies sees them. Worth a 30-second cleanup before the pitch — I can do it through the MCP.
- **Honest stats on the landing page.** "1,240+ student profiles · 87 active listings · 34 partner companies" — none of these are real. If the dean reads this and then sees the actual database, the trust delta hurts you. Either swap for real pilot numbers or remove the stats bar and replace with a "Tilburg pilot launching [Month]" line.
- **The 20 showcase student profiles I created earlier.** They're plausible-looking but fabricated. Fine for a closed demo to companies considering joining; misleading once real students sign up and see them as peers. Decide whether to mark them as "Demo" or move them to a separate sandbox.
- **A favicon and Open Graph image.** Right now sharing the link in a Slack or LinkedIn message previews as a generic blank box. Adding `<meta property="og:title">`, `og:description`, `og:image` takes 5 minutes and looks much sharper.

---

*Living doc — feel free to add columns or sub-tasks as the pilot evolves.*
