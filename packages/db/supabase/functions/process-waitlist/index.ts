// process-waitlist — periodic sweep (schedule every ~5 minutes via
// Supabase Cron). Expires 30-minute offers that lapsed and passes the
// ticket to the next person in line. return-ticket already pairs
// immediately; this catches the expiry → next-in-line handoff.

import { adminClient } from "../_shared/clients.ts";
import { errorResponse, json } from "../_shared/http.ts";
import { pairWaitlist } from "../_shared/waitlist.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const db = adminClient();

  // Products with any live waitlist state — expired offers included,
  // because their tickets must move to the next person.
  const { data: rows } = await db
    .from("waitlist")
    .select("product_id")
    .in("status", ["waiting", "offered"]);
  const productIds = [...new Set((rows ?? []).map((r) => r.product_id as string))];

  let totalOffered = 0;
  for (const productId of productIds) {
    totalOffered += await pairWaitlist(db, productId);
  }

  return json({ products_checked: productIds.length, offers_made: totalOffered });
});
