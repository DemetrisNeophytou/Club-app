// transfer-ticket — hard rule 2: the ONLY transfer path, free, in-app.
// Changes user_id and rotates qr_secret so the sender's old QR dies.

import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { pushToUser } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { ticket_id, to_email } = await req.json().catch(() => ({}));
  if (!ticket_id || typeof to_email !== "string") return errorResponse("INVALID_INPUT");

  const db = adminClient();

  const { data: ticket } = await db
    .from("tickets")
    .select("id, user_id, status, event:events(name, starts_at)")
    .eq("id", ticket_id)
    .maybeSingle();
  if (!ticket || ticket.user_id !== user.id) return errorResponse("TICKET_NOT_FOUND", 404);
  if (ticket.status !== "active") return errorResponse("NOT_TRANSFERABLE", 409);

  const event = ticket.event as unknown as { name: string; starts_at: string };
  if (Date.parse(event.starts_at) < Date.now()) return errorResponse("EVENT_STARTED", 409);

  const { data: targetId } = await db.rpc("get_user_id_by_email", { p_email: to_email });
  if (!targetId) return errorResponse("RECIPIENT_NOT_FOUND", 404);
  if (targetId === user.id) return errorResponse("CANNOT_TRANSFER_TO_SELF", 409);

  // Rotate the secret: any screenshot/copy the sender kept becomes dead.
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const newSecret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: updated } = await db
    .from("tickets")
    .update({ user_id: targetId, transferred_to: targetId, qr_secret: newSecret })
    .eq("id", ticket.id)
    .eq("status", "active")
    .eq("user_id", user.id) // double-tap / race guard
    .select("id");
  if (!updated || updated.length === 0) return errorResponse("NOT_TRANSFERABLE", 409);

  await pushToUser(
    db,
    targetId as string,
    event.name,
    "Σου μεταφέρθηκε ένα εισιτήριο! Είναι στα Εισιτήριά σου. / A ticket was transferred to you!",
    { type: "ticket_transferred", ticket_id: ticket.id },
  );

  return json({ ok: true });
});
