# PORTAL — Κατάσταση στησίματος

Ζωντανή λίστα: τι έχει γίνει, τι εκκρεμεί, ποιος το κάνει.

## ✅ Έγινε

- [x] Monorepo + spec στο repo (branch `claude/portal-nightlife-spec-ybf4c5`)
- [x] Σχήμα βάσης + RLS + συναρτήσεις + demo seed (γραμμένα & δοκιμασμένα σε τοπική Postgres)
- [x] Consumer app: feed, σελίδα event, checkout, εισιτήρια, QR με portal ring, EL/EN, OTP login
- [x] Edge Functions: create-payment-intent, stripe-webhook, validate-scan
- [x] Οδηγός για αρχάριους: `docs/LEARN.md`
- [x] Supabase project δημιουργήθηκε: `https://mxmehizzrlrbegrujdjp.supabase.co`
- [x] Publishable key στα `.env.example`
- [x] **Migrations + seed εφαρμόστηκαν στο production** (phase1.sql μέσω SQL Editor, 3/7/2026)
- [x] **Venues dashboard (Phase 2 βήμα 4):** login OTP, δημιουργία μαγαζιού, event CRUD, προϊόντα, δημοσίευση, live πωλήσεις (Realtime + polling)
- [x] Realtime publication ενεργοποιήθηκε στο production (phase2-realtime.sql)
- [x] **Door mode (Phase 2 βήμα 5):** σαρωτής QR με κάμερα, offline manifest, ουρά scans + sync, χειροκίνητο check-in με όνομα, μετρητής μέσα/σύνολο
- [x] **Waitlist + επιστροφή + push (Phase 2 βήμα 6):** επιστροφή εισιτηρίου → FIFO προσφορά 30' στον επόμενο → αγορά στην αρχική τιμή → refund στον αρχικό· push tokens + ειδοποιήσεις· process-waitlist sweeper

## ✅ Έγινε — μέσω Supabase MCP (3/7/2026)

- [x] Όλα τα SQL migrations εφαρμοσμένα (schema, RLS, realtime, door policy, waitlist, push_tokens)
- [x] **Και οι 6 Edge Functions deployed & ACTIVE:** create-payment-intent, stripe-webhook, validate-scan, sync-scans, return-ticket, process-waitlist
- [x] Cron: process-waitlist τρέχει κάθε 5' (pg_cron + pg_net) — δοκιμάστηκε live, 200 OK
- [x] Security advisors: διορθώθηκαν search_path warnings, κλείδωσε το handle_new_user, pg_net → extensions schema

## ⏳ Εκκρεμεί — Δημήτρης (από κινητό, browser)

- [ ] **Revoke** το secret key που γράφτηκε στο chat (Project Settings → API Keys)
- [ ] Λογαριασμός **Stripe** (test mode) → στείλε ΜΟΝΟ το `pk_test_...` (το `pk_live_` που βρήκες είναι για αργότερα, στο launch)
- [ ] Email template για τον 6ψήφιο κωδικό: Authentication → Emails → Magic Link → το σώμα να περιέχει `{{ .Token }}` (π.χ. «Ο κωδικός σου: {{ .Token }}») — αλλιώς το login του app δεν έχει κωδικό να στείλει
- [ ] Όταν έρθει το Stripe: βάλε τα `STRIPE_SECRET_KEY` (sk_test) και `STRIPE_WEBHOOK_SECRET` στα Edge Functions → Secrets (dashboard)
- [ ] Ανέβασε το **portal-app.html** στο repo (ή paste στη συζήτηση)

## ⏳ Εκκρεμεί — Claude (μόλις έρθουν τα παραπάνω)

- [ ] Πέρασμα του pk_test στο app config
- [ ] Συμφωνία UI 1:1 με το portal-app.html + σωστά demo events στο seed
- [ ] Οδηγίες deploy των Edge Functions + secrets (STRIPE_SECRET_KEY κ.λπ.)
- [ ] Ρύθμιση email template για 6ψήφιο OTP (Authentication → Email Templates → να περιέχει `{{ .Token }}`)

## ⏳ Εκκρεμεί — χρειάζεται υπολογιστή (μία φορά)

- [ ] `pnpm install` + `npx expo start` → δοκιμή του app με Expo Go στο κινητό
- [ ] Stripe webhook endpoint σύνδεση (Stripe Dashboard → Webhooks → `https://mxmehizzrlrbegrujdjp.supabase.co/functions/v1/stripe-webhook`)
- [ ] Push notifications: χρειάζονται development build (EAS) — δεν δουλεύουν σε Expo Go
