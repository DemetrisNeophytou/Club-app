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

## ⏳ Εκκρεμεί — deploy στο production (μόλις επανασυνδεθεί το Supabase MCP)

- [ ] Apply migration `20260704100000_phase3.sql` (storage bucket + policies, teammate profiles, email lookup, GDPR FKs) — ή copy-paste το `packages/db/apply/phase3.sql`
- [ ] Deploy 5 νέες Edge Functions: transfer-ticket, cancel-event, cancel-table, delete-account, add-venue-member

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

## 🖥️ Η ΜΕΡΑ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ — πλήρης λίστα με τη σειρά

### 1. Email templates (δεν έπαιζε το paste από κινητό)
Supabase → Authentication → Emails. ΠΡΟΣΟΧΗ πρώτα: το Resend API key
`re_efFmUtaH...` κάηκε (φάνηκε σε screenshot) → resend.com → API Keys →
delete → Create νέο → βάλ' το στο SMTP Settings → Password → Save.

Μετά, template **«Magic link or OTP»** ΚΑΙ **«Confirm signup»**:
- Subject: `Ο κωδικός σου για το PORTAL`
- Body (σβήσε το default, επικόλλησε):
```html
<h2>PORTAL</h2>
<p>Ο κωδικός σύνδεσής σου: <strong style="font-size:24px">{{ .Token }}</strong></p>
<p>Λήγει σύντομα. Αν δεν το ζήτησες εσύ, αγνόησέ το.</p>
```
Έλεγχος: Preview → πρέπει να δείχνει κωδικό-παράδειγμα.

### 2. Stripe (test mode toggle ΟΝ παντού)
- Developers → API keys → `pk_test_...` → στον Claude (chat)
- `sk_test_...` → Supabase → Edge Functions → Secrets → `STRIPE_SECRET_KEY`
- Developers → Webhooks → Add endpoint:
  - URL: `https://mxmehizzrlrbegrujdjp.supabase.co/functions/v1/stripe-webhook`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
  - Signing secret `whsec_...` → Supabase Secrets → `STRIPE_WEBHOOK_SECRET`

### 3. Πρώτη εκτέλεση του app
```bash
git clone <repo> && cd Club-app
git checkout claude/portal-nightlife-spec-ybf4c5
corepack enable && pnpm install
cd apps/mobile && cp .env.example .env   # συμπλήρωσε το pk_test
npx expo start                            # QR → Expo Go στο κινητό
```
Δοκιμή ροής: Προφίλ → σύνδεση με email (ο κωδικός έρχεται στο email του
Resend λογαριασμού) → Απόψε → event → Guestlist (δωρεάν, δουλεύει χωρίς
Stripe Connect) → Εισιτήρια → QR.

### 4. Γνωστοί περιορισμοί εκείνης της μέρας
- Πληρωμένα εισιτήρια: τα demo venues δεν έχουν Stripe Connect account →
  «VENUE_NOT_ONBOARDED» (σωστό)· στήνουμε test Connect account τότε.
- Push notifications: θέλουν EAS development build, όχι Expo Go.
