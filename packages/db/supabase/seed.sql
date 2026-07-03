-- PORTAL — demo seed (Phase 1 step 1)
-- 6 demo venues + 6 events across the 5 Cyprus cities.
-- NOTE: portal-app.html was not present in the repo when this seed was
-- written; these venues/events follow the spec (§1, §5) and must be
-- reconciled 1:1 with the prototype once the file is added.
--
-- Dates are relative to `now()` so the Tonight feed is always populated.
-- Prices follow hard rule 1: price_cents INCLUDES the €1.00 booking fee.

-- ─── Cities (§1) ──────────────────────────────────────────────────────────

insert into public.cities (id, name_el, name_en, slug) values
  ('c0000000-0000-4000-8000-000000000001', 'Λεμεσός',              'Limassol',           'lemesos'),
  ('c0000000-0000-4000-8000-000000000002', 'Λευκωσία',             'Nicosia',            'lefkosia'),
  ('c0000000-0000-4000-8000-000000000003', 'Αγία Νάπα / Πρωταράς', 'Ayia Napa / Protaras', 'agia-napa'),
  ('c0000000-0000-4000-8000-000000000004', 'Λάρνακα',              'Larnaca',            'larnaka'),
  ('c0000000-0000-4000-8000-000000000005', 'Πάφος',                'Paphos',             'pafos');

-- ─── Venues ───────────────────────────────────────────────────────────────

insert into public.venues (id, city_id, name, slug, description_el, description_en, address, geo, capacity, status) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'HALCYON', 'halcyon',
   'Techno δίπλα στη θάλασσα. Funktion-One, μπετόν και αλάτι.',
   'Techno by the sea. Funktion-One, concrete and salt.',
   'Παραλιακή Λεμεσού 47, Λεμεσός', point(33.0451, 34.6841), 450, 'active'),

  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'VAULT 9', 'vault-9',
   'Υπόγειο στην εντός των τειχών. Σκοτεινό, δυνατό, χωρίς κάμερες.',
   'A basement inside the old walls. Dark, loud, no cameras.',
   'Λήδρας 9, Λευκωσία', point(33.3600, 35.1725), 250, 'active'),

  ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003',
   'MEDUSA', 'medusa',
   'Το superclub της Νάπας. Τρεις σκηνές, ένα καλοκαίρι.',
   'Ayia Napa''s superclub. Three stages, one summer.',
   'Λεωφόρος Νησί 12, Αγία Νάπα', point(33.9823, 34.9856), 1200, 'active'),

  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'THE DOCKYARD', 'the-dockyard',
   'Warehouse parties στο παλιό λιμάνι. Ήχος βιομηχανικός, κόσμος δικός μας.',
   'Warehouse parties at the old port. Industrial sound, our kind of crowd.',
   'Παλιό Λιμάνι, Λεμεσός', point(33.0405, 34.6712), 800, 'active'),

  ('a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004',
   'CARBON', 'carbon',
   'Bar-club στα Φοινικούδια. Cocktails μέχρι τις 12, χορός μετά.',
   'Bar-club on Finikoudes. Cocktails till midnight, dancing after.',
   'Φοινικούδες 3, Λάρνακα', point(33.6367, 34.9159), 300, 'active'),

  ('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000005',
   'ONYX ROOF', 'onyx-roof',
   'Rooftop πάνω από το κάστρο. Ηλιοβασίλεμα, μετά house μέχρι το πρωί.',
   'A rooftop above the castle. Sunset first, then house till morning.',
   'Ποσειδώνος 21, Κάτω Πάφος', point(32.4076, 34.7539), 220, 'active');

-- ─── Events ───────────────────────────────────────────────────────────────
-- e1/e2: tonight · e3: tomorrow · e4: Saturday-ish (+2d) · e5: +3d · e6: +5d
-- e3 (MEDUSA) is SOLD OUT → demo waitlist flow.

insert into public.events (id, venue_id, name, slug, description_el, description_en, starts_at, doors_at, ends_at, genre, age_limit, status, lineup) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'RITUAL 013', 'ritual-013',
   'Peak-time techno, μηδέν φώτα κινητών. Το RITUAL επιστρέφει στο HALCYON.',
   'Peak-time techno, zero phone lights. RITUAL returns to HALCYON.',
   date_trunc('day', now()) + interval '23 hours',
   date_trunc('day', now()) + interval '22 hours',
   date_trunc('day', now()) + interval '1 day 5 hours',
   array['techno'], 18, 'published',
   '[{"name": "KLINT", "role": "headliner", "time": "01:00"},
     {"name": "Nadia P.", "role": "support", "time": "23:30"},
     {"name": "Aeon", "role": "opener", "time": "22:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005',
   'VELVET NIGHTS', 'velvet-nights',
   'Disco και house κλασικά στα Φοινικούδια. Dress code: ό,τι σε κάνει να λάμπεις.',
   'Disco and house classics on Finikoudes. Dress code: whatever makes you shine.',
   date_trunc('day', now()) + interval '22 hours',
   date_trunc('day', now()) + interval '21 hours',
   date_trunc('day', now()) + interval '1 day 3 hours',
   array['disco', 'house'], 21, 'published',
   '[{"name": "Miss Adamou", "role": "resident", "time": "22:00"},
     {"name": "Roula V.", "role": "guest", "time": "00:30"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'NEPTUNE FOAM PARTY', 'neptune-foam-party',
   'Το μεγαλύτερο foam party του νησιού. Τρεις σκηνές, αφρός μέχρι τη μέση.',
   'The island''s biggest foam party. Three stages, foam up to your waist.',
   date_trunc('day', now()) + interval '1 day 23 hours',
   date_trunc('day', now()) + interval '1 day 22 hours',
   date_trunc('day', now()) + interval '2 days 6 hours',
   array['edm', 'house'], 18, 'soldout',
   '[{"name": "TWIN FLAME", "role": "headliner", "time": "01:30"},
     {"name": "DJ Sfera", "role": "support", "time": "23:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'DOCKYARD 04: CONCRETE', 'dockyard-04-concrete',
   'Industrial techno στο παλιό λιμάνι. 8 ώρες, ένα stage, καθόλου φιοριτούρες.',
   'Industrial techno at the old port. 8 hours, one stage, no frills.',
   date_trunc('day', now()) + interval '2 days 23 hours',
   date_trunc('day', now()) + interval '2 days 22 hours',
   date_trunc('day', now()) + interval '3 days 7 hours',
   array['techno', 'industrial'], 18, 'published',
   '[{"name": "VESSEL 8", "role": "headliner", "time": "02:00"},
     {"name": "Mara K.", "role": "support", "time": "00:00"},
     {"name": "Subterra", "role": "opener", "time": "22:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'BASSMENT SESSIONS', 'bassment-sessions',
   'Drum & bass στο υπόγειο. Χαμηλό ταβάνι, ψηλά BPM.',
   'Drum & bass in the basement. Low ceiling, high BPM.',
   date_trunc('day', now()) + interval '3 days 23 hours',
   date_trunc('day', now()) + interval '3 days 22 hours',
   date_trunc('day', now()) + interval '4 days 4 hours',
   array['dnb', 'bass'], 18, 'published',
   '[{"name": "Hexen", "role": "headliner", "time": "01:00"},
     {"name": "Kyra", "role": "opener", "time": "23:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006',
   'GOLDEN HOUR', 'golden-hour',
   'Sunset session στην ταράτσα. Afro house όσο πέφτει ο ήλιος, μετά melodic μέχρι αργά.',
   'Sunset session on the roof. Afro house as the sun goes down, then melodic till late.',
   date_trunc('day', now()) + interval '5 days 19 hours',
   date_trunc('day', now()) + interval '5 days 18 hours',
   date_trunc('day', now()) + interval '6 days 2 hours',
   array['afro house', 'melodic'], 21, 'published',
   '[{"name": "Selene", "role": "resident", "time": "19:00"},
     {"name": "L. Charalambous", "role": "guest", "time": "22:00"}]'::jsonb);

-- ─── Products ─────────────────────────────────────────────────────────────
-- price_cents includes fee_cents (€1.00 = 100). Guestlist is always free.
-- Tables: min spend + 30% deposit (hard rule 5).

insert into public.products
  (id, event_id, type, name, price_cents, fee_cents, quota, sold_count, per_order_limit,
   sales_start, sales_end, gl_cutoff_time, table_min_spend_cents, table_capacity, deposit_pct)
values
  -- RITUAL 013 @ HALCYON — early bird gone, 2nd release selling fast
  ('b0000000-0000-4000-8000-000000000101', 'e0000000-0000-4000-8000-000000000001', 'ticket',
   'Early Bird', 1200, 100, 100, 100, 4,
   now() - interval '21 days', now() - interval '7 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000102', 'e0000000-0000-4000-8000-000000000001', 'ticket',
   '2nd Release', 1500, 100, 200, 178, 4,
   now() - interval '7 days', date_trunc('day', now()) + interval '23 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000103', 'e0000000-0000-4000-8000-000000000001', 'guestlist',
   'Guestlist', 0, 0, 80, 41, 2,
   now() - interval '7 days', null, date_trunc('day', now()) + interval '23 hours 30 minutes', null, null, null),
  ('b0000000-0000-4000-8000-000000000104', 'e0000000-0000-4000-8000-000000000001', 'table',
   'VIP Table — Seafront', 0, 0, 6, 4, 1,
   now() - interval '21 days', date_trunc('day', now()) + interval '21 hours', null, 30000, 6, 30),

  -- VELVET NIGHTS @ CARBON
  ('b0000000-0000-4000-8000-000000000201', 'e0000000-0000-4000-8000-000000000002', 'ticket',
   'General Admission', 1000, 100, 180, 92, 6,
   now() - interval '10 days', date_trunc('day', now()) + interval '22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000202', 'e0000000-0000-4000-8000-000000000002', 'guestlist',
   'Guestlist πριν τις 23:00', 0, 0, 60, 18, 3,
   now() - interval '10 days', null, date_trunc('day', now()) + interval '23 hours', null, null, null),
  ('b0000000-0000-4000-8000-000000000203', 'e0000000-0000-4000-8000-000000000002', 'table',
   'Booth — Terrace', 0, 0, 4, 1, 1,
   now() - interval '10 days', date_trunc('day', now()) + interval '20 hours', null, 20000, 8, 30),

  -- NEPTUNE FOAM PARTY @ MEDUSA — everything sold out → waitlist demo
  ('b0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000003', 'ticket',
   'Early Bird', 2000, 100, 400, 400, 6,
   now() - interval '30 days', now() - interval '14 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000003', 'ticket',
   'Final Release', 2500, 100, 600, 600, 6,
   now() - interval '14 days', now() + interval '1 day', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000303', 'e0000000-0000-4000-8000-000000000003', 'table',
   'VIP Cabana', 0, 0, 10, 10, 1,
   now() - interval '30 days', now() + interval '1 day', null, 50000, 10, 30),

  -- DOCKYARD 04 @ THE DOCKYARD
  ('b0000000-0000-4000-8000-000000000401', 'e0000000-0000-4000-8000-000000000004', 'ticket',
   'Early Bird', 1300, 100, 250, 250, 4,
   now() - interval '14 days', now() - interval '2 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000004', 'ticket',
   '2nd Release', 1700, 100, 350, 121, 4,
   now() - interval '2 days', now() + interval '2 days 22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000403', 'e0000000-0000-4000-8000-000000000004', 'guestlist',
   'Guestlist', 0, 0, 100, 12, 2,
   now() - interval '2 days', null, date_trunc('day', now()) + interval '2 days 23 hours', null, null, null),

  -- BASSMENT SESSIONS @ VAULT 9
  ('b0000000-0000-4000-8000-000000000501', 'e0000000-0000-4000-8000-000000000005', 'ticket',
   'General Admission', 1100, 100, 200, 34, 4,
   now() - interval '5 days', now() + interval '3 days 22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000502', 'e0000000-0000-4000-8000-000000000005', 'guestlist',
   'Guestlist πριν τις 23:30', 0, 0, 50, 7, 2,
   now() - interval '5 days', null, date_trunc('day', now()) + interval '3 days 23 hours 30 minutes', null, null, null),

  -- GOLDEN HOUR @ ONYX ROOF
  ('b0000000-0000-4000-8000-000000000601', 'e0000000-0000-4000-8000-000000000006', 'ticket',
   'Sunset Ticket', 1500, 100, 150, 63, 4,
   now() - interval '7 days', now() + interval '5 days 18 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000602', 'e0000000-0000-4000-8000-000000000006', 'guestlist',
   'Guestlist πριν τις 20:00', 0, 0, 40, 22, 2,
   now() - interval '7 days', null, date_trunc('day', now()) + interval '5 days 20 hours', null, null, null),
  ('b0000000-0000-4000-8000-000000000603', 'e0000000-0000-4000-8000-000000000006', 'table',
   'Table — Castle View', 0, 0, 8, 2, 1,
   now() - interval '7 days', now() + interval '5 days 16 hours', null, 25000, 6, 30);
