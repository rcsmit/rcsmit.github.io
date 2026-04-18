# AcroFest SaaS — Feature Overview

---

## 🏗️ Platform (SiteOwner)
*Operates the SaaS. Never touches event content.*

- Tenant management — create, suspend, delete organizations
- Subscription & billing — Stripe-based plans (Free / Starter / Pro / Enterprise)
- Revenue dashboard — MRR, ARR, churn, plan distribution
- Feature flag console — enable/disable modules per plan or per tenant
- Impersonation — log in as any organizer (re-auth required, time-limited, fully audit-logged)
- Global announcements — push banner to all tenant dashboards
- Security log — tenant isolation violations, webhook failures, rate limit breaches
- BullMQ queue dashboard — failed jobs, retry, discard

---

## 🎪 Event Management (Organizer)
*Core event setup and lifecycle.*

- Multi-event support — one tenant can run multiple events
- Event configuration — name, slug, dates, timezone, tagline, cover image
- Multi-venue management — address, GPS, capacity, floor type, indoor/outdoor
- Publish/unpublish with authenticated preview link
- Event cloning — copy prior event as template
- Enabled modules toggle per event (respects plan limits)

---

## 👩‍🏫 Teacher Management (Organizer)
- Teacher profiles — bio, photo, specialties, certifications, social links
- Email invite flow — invite → accept/decline → confirmed on dashboard
- Contract & fee tracking — fixed fee, revenue share, or volunteer
- Per-event fee basis — gross ticket revenue net of VAT, before processor fees, before refunds
- Payout tracker — manual settlement with proof-of-payment upload
- Teacher portal access — own schedule, session participants, travel/accommodation status

---

## 📅 Schedule Builder (Organizer)
- Visual weekly grid per venue — drag-and-drop time slot builder
- Session types — Workshop, Jam, Lecture, Class, Social, Morning Practice, Ceremony
- Session fields — title, description, teacher(s), venue, time, capacity, skill level, tags
- Conflict detection — same teacher double-booked → warning with resolution options
- Session cloning across days
- Programme PDF export — A5 booklet, queued async
- iCal export per participant — enrolled sessions only

---

## 👥 Participant Management (Organizer / Staff)
- Multi-step registration — personal info → ticket → add-ons → payment → confirmation
- Participant record — name, contact, emergency contact, dietary needs, experience level, pronouns
- Internal notes — organizer-only, audit-logged on every access, never participant-visible
- QR code check-in per session + manual override
- Waitlist — FIFO, automatic promotion when capacity opens, email notification
- Bulk CSV import with validation report
- Export to CSV / XLSX

---

## 👤 Profile & Visibility System (All roles)
*One global identity, per-field visibility control.*

- Single profile reused across all events — photo, bio, pronouns, location, social links
- Acroyoga-specific fields — base/flyer/spotter roles, experience years, skill tags, home community
- Languages, "looking for practice partner" toggle
- **Per-field visibility** — each field independently set to: Public / Participants only / Teachers only / Nobody
- Teacher-only fields — teaching philosophy, certifications, featured video
- Per-event extensions — skill level, dietary needs, emergency contact, T-shirt size (event-specific, not on global profile)
- Community directory — browse other participants, filter by role / experience / language / skills
- "Request to connect" — sends email to both parties, no internal messaging (GDPR simplification)

---

## 💳 Booking & Payment Pipeline (Participant / Organizer)
- Ticket tiers — Early Bird, Regular, Late, Day Pass, Teacher/Staff
- Add-ons — Camping, Accommodation, Meal Plan, Shuttle, T-shirt (with size), Donation
- Discount codes — flat or %, per-use limit, date range, tier-restricted
- **Stripe** (primary) + **Mollie** (EU fallback, iDEAL / Bancontact) — swappable adapter
- Installment plans — 2 or 3 payments, automatic charging via saved card
- Ticket reservation — 15-minute hold during checkout, released on expiry
- Late webhook handling — capacity re-check, recovery path, organizer alert if oversold
- Refund policy engine — configurable cutoff dates + percentages per event
- Chargeback handling — order suspended, organizer notified, manual resolution
- VAT — one rate per event, stored immutably at purchase time, gap-tolerant invoice sequence
- Invoice PDF — auto-generated, VAT-compliant, tenant-branded, async queued
- All edge cases handled explicitly — partial refunds, failed installments, transfers, duplicate webhooks, event cancellation

---

## 🏠 Logistics (Organizer / Staff)
- Accommodation matrix — assign participants to beds/rooms/pitches, color-coded occupancy, overbooking prevented (hard 409)
- Meal planning — headcount per meal per dietary type, printable kitchen sheet
- Shuttle manager — arrival/departure manifests, seat assignments
- Volunteer manager — shift builder, role assignment, perk tracking
- Equipment list — per session, location, responsible person
- Run-of-show — auto-generated master timeline from schedule + logistics, editable, PDF export

---

## 💰 Financial Dashboard (Organizer)
- Revenue — ticket sales by tier, add-ons, donations, time-series chart
- Expenses — manual entry with categories (Venue / Teacher / Catering / Marketing / Equipment / Travel)
- P&L — live margin calculation
- Cash flow forecast — based on installment schedules + upcoming expenses
- Refunds pending — list with amounts and deadlines
- Full ledger export — CSV / XLSX, PDF summary for accountant

---

## 📣 Communications & Marketing (Organizer)
- Email campaigns — compose, schedule, segment by ticket tier / registration date / session enrollment
- Liquid-style variables — `{{first_name}}`, `{{schedule_link}}`, etc.
- Automated transactional emails — registration confirmation, payment receipt, installment reminder, schedule update, session cancellation, event reminder (7d + 1d), post-event feedback, magic link, waitlist promotion, connect request
- Social asset generator — 1:1 and 9:16 images from session data (server-side Sharp for Pro+)
- Referral tracking — unique links per ambassador, conversion dashboard
- UTM builder — built-in campaign link generator

---

## 🌐 Participant & Teacher Portal (Participants / Teachers)
*Mobile-first (375px+). Feels like a festival programme magazine.*

- My Festival — personalised at-a-glance card, next session countdown
- My Schedule — enrolled sessions as timeline, add to Google/Apple Calendar
- Programme — full schedule, filterable by type / level / teacher, save to my schedule
- My Profile — edit profile + per-field visibility settings
- My Order — ticket details, add-ons, payment history, invoice downloads, refund request
- Community — participant directory (visibility-respecting), filter by role / experience / language / skills
- Venue Map — Leaflet.js, all venue pins, schedule overlay
- Practical Info — personalised logistics (shuttle time, accommodation, meal plan, what to bring)
- Announcements — organizer broadcasts, web push notification opt-in
- Data export — download all personal data as JSON (async, single-use time-limited link)
- Account deletion — self-service, 30-day grace period

---

## 🌍 Public Marketing Website (Prospects)
*Tenant-aware, runtime-rendered, conversion-optimised.*

- Homepage — hero, about, teacher highlights, programme teaser, venue gallery, pricing table, FAQ, testimonials, newsletter signup
- Teachers page — public teacher grid + individual profiles with their sessions
- Programme — full schedule grid, filterable
- Practical — travel, accommodation, accessibility
- Register — embedded registration + payment flow
- Blog — optional markdown-based announcements
- SEO — full meta tags, og:image, JSON-LD Event schema, sitemap.xml, robots.txt

---

## 🔐 Auth & Security
- Single identity, event-scoped roles — one login, memberships at multiple events across tenants
- JWT — 15-min access tokens, 7-day refresh tokens with rotation and family revocation
- Magic links — single-use, 15-min expiry, timing-safe comparison, rate-limited
- TOTP 2FA — mandatory for Organizers and SiteOwners, optional for others, backup codes, full reset chain of authority
- Impersonation — re-auth + 60-min limit + blocked actions + full audit trail
- Rate limiting — per endpoint, Redis-backed, sliding window
- Stripe/Mollie webhook signature verification — on every inbound payment event
- File upload security — MIME validation, EXIF stripping, malware scan, no original filenames
- Tenant isolation — Prisma middleware + service-layer explicit filters, violations logged as security events
- Soft delete — 404 to all non-admin callers, explicit `?includeDeleted=true` for organizers

---

## 🇪🇺 GDPR Compliance
- Per-field consent — event comms, marketing emails, community directory, photo/video, each with precise Article 6 legal basis
- Consent withdrawal — from participant portal, immediate effect
- Right to access — async JSON export, single-use download link, rate-limited
- Right to erasure — soft delete → 30-day grace → hard purge, financial records anonymised (retained 7 years)
- Data retention sweep — nightly worker per policy
- Audit log — every access to personal data, actor, timestamp, impersonation flag, 2-year retention
- DPA — auto-generated PDF per tenant listing all sub-processors (Starter plan+)
- Cookie consent — strictly necessary always on, analytics opt-in, no tracking before consent
- Privacy policy page — dynamically generated from tenant config

---

## ⚙️ Platform Infrastructure
- Multi-tenant — shared PostgreSQL, all records `tenantId`-scoped, upgrade path to per-tenant schemas without redesign
- Custom domains — CNAME + TXT verification + Caddy auto-cert (apex + subdomain)
- Four plan tiers — Free / Starter / Pro / Enterprise, limits enforced at 6 layers
- Async job queue — BullMQ + Redis, retry policies, dead-letter queues, deduplication, poison message handling
- Observability — Pino structured logs, OpenTelemetry traces, Sentry error capture, health + readiness endpoints
- Circuit breaker — per payment provider, Redis-shared state, 503 on open
- Website caching — Redis with intentionally coarse tenant-level invalidation, SCAN-based batch delete, pre-warming
- Backups — nightly pg_dump to S3, 30-day retention, documented restore procedure
- All monetary values — integers in minor units (cents), never floats
- All timestamps — UTC in DB, displayed in event timezone
