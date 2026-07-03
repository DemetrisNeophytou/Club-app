import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProductType } from "@portal/shared";
import { qrNonce, currentWindow } from "./qr";
import { supabase } from "./supabase";

/**
 * Door mode data layer (spec §7): the manifest is a local snapshot of an
 * event's tickets so the door works with zero signal. Scans made offline
 * queue up and sync through the sync-scans Edge Function.
 */

export interface ManifestTicket {
  id: string;
  qr_secret: string;
  status: string;
  holder_name: string | null;
  product_type: ProductType;
  product_name: string;
  gl_cutoff_time: string | null;
}

export interface DoorManifest {
  event_id: string;
  downloaded_at: string;
  tickets: Record<string, ManifestTicket>;
}

export interface ScanOutcome {
  result: "ok" | "already_scanned" | "invalid" | "expired";
  ticket?: ManifestTicket;
  offline: boolean;
}

const manifestKey = (eventId: string) => `portal.door.manifest.${eventId}`;
const queueKey = (eventId: string) => `portal.door.queue.${eventId}`;

/** RLS scopes both queries to events of venues the user belongs to. */
export async function downloadManifest(eventId: string): Promise<DoorManifest> {
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, qr_secret, status, user_id, product:products(type, name, gl_cutoff_time)")
    .eq("event_id", eventId);
  if (error) throw error;

  const userIds = [...new Set((tickets ?? []).map((t) => t.user_id as string))];
  const names = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
    for (const p of profiles ?? []) names.set(p.id as string, (p.name as string | null) ?? null);
  }

  const manifest: DoorManifest = {
    event_id: eventId,
    downloaded_at: new Date().toISOString(),
    tickets: {},
  };
  for (const t of tickets ?? []) {
    const product = t.product as unknown as {
      type: ProductType;
      name: string;
      gl_cutoff_time: string | null;
    };
    manifest.tickets[t.id as string] = {
      id: t.id as string,
      qr_secret: t.qr_secret as string,
      status: t.status as string,
      holder_name: names.get(t.user_id as string) ?? null,
      product_type: product.type,
      product_name: product.name,
      gl_cutoff_time: product.gl_cutoff_time,
    };
  }
  await AsyncStorage.setItem(manifestKey(eventId), JSON.stringify(manifest));
  return manifest;
}

export async function loadManifest(eventId: string): Promise<DoorManifest | null> {
  const raw = await AsyncStorage.getItem(manifestKey(eventId));
  return raw ? (JSON.parse(raw) as DoorManifest) : null;
}

async function saveManifest(manifest: DoorManifest): Promise<void> {
  await AsyncStorage.setItem(manifestKey(manifest.event_id), JSON.stringify(manifest));
}

async function enqueue(eventId: string, ticketId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(queueKey(eventId));
  const queue: Array<{ ticket_id: string; scanned_at: string }> = raw ? JSON.parse(raw) : [];
  if (!queue.some((q) => q.ticket_id === ticketId)) {
    queue.push({ ticket_id: ticketId, scanned_at: new Date().toISOString() });
    await AsyncStorage.setItem(queueKey(eventId), JSON.stringify(queue));
  }
}

export async function pendingCount(eventId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(queueKey(eventId));
  return raw ? (JSON.parse(raw) as unknown[]).length : 0;
}

/** Push queued offline scans to the server; returns how many synced. */
export async function flushQueue(eventId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(queueKey(eventId));
  if (!raw) return 0;
  const queue: Array<{ ticket_id: string; scanned_at: string }> = JSON.parse(raw);
  if (queue.length === 0) return 0;
  const { error } = await supabase.functions.invoke("sync-scans", {
    body: { event_id: eventId, scans: queue },
  });
  if (error) throw error;
  await AsyncStorage.removeItem(queueKey(eventId));
  return queue.length;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Validate a scanned payload. Online first (server is truth); if the
 * network is gone, validate against the local manifest — same nonce math,
 * same rules — and queue the scan for later sync.
 */
export async function validateScan(
  manifest: DoorManifest,
  payload: string,
): Promise<{ outcome: ScanOutcome; manifest: DoorManifest }> {
  const parts = payload.split(".");
  const ticketId = parts.length === 3 && parts[0] === "PORTAL1" ? parts[1]! : null;
  const localTicket = ticketId ? manifest.tickets[ticketId] : undefined;

  // ── Try the server ──
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("validate-scan", {
        body: { payload, event_id: manifest.event_id },
      }),
      4000,
    );
    if (!error && data?.result) {
      if (localTicket && (data.result === "ok" || data.result === "already_scanned")) {
        localTicket.status = "scanned";
        await saveManifest(manifest);
      }
      return {
        outcome: { result: data.result, ticket: localTicket, offline: false },
        manifest,
      };
    }
  } catch {
    /* offline — fall through */
  }

  // ── Offline path ──
  if (!ticketId || !localTicket) {
    return { outcome: { result: "invalid", offline: true }, manifest };
  }
  if (localTicket.status === "scanned") {
    return { outcome: { result: "already_scanned", ticket: localTicket, offline: true }, manifest };
  }
  if (localTicket.status !== "active") {
    return { outcome: { result: "invalid", ticket: localTicket, offline: true }, manifest };
  }
  if (
    localTicket.product_type === "guestlist" &&
    localTicket.gl_cutoff_time &&
    Date.now() > Date.parse(localTicket.gl_cutoff_time)
  ) {
    return { outcome: { result: "expired", ticket: localTicket, offline: true }, manifest };
  }

  const nonce = parts[2]!;
  const w = currentWindow();
  let matches = false;
  for (const candidate of [w, w - 1, w + 1]) {
    if ((await qrNonce(localTicket.qr_secret, candidate)) === nonce) {
      matches = true;
      break;
    }
  }
  if (!matches) {
    return { outcome: { result: "invalid", ticket: localTicket, offline: true }, manifest };
  }

  localTicket.status = "scanned";
  await saveManifest(manifest);
  await enqueue(manifest.event_id, ticketId);
  return { outcome: { result: "ok", ticket: localTicket, offline: true }, manifest };
}

/** Manual check-in by name (guestlist without a phone, spec §7). */
export async function manualCheckIn(
  manifest: DoorManifest,
  ticketId: string,
): Promise<DoorManifest> {
  const ticket = manifest.tickets[ticketId];
  if (!ticket || ticket.status !== "active") return manifest;
  ticket.status = "scanned";
  await saveManifest(manifest);
  await enqueue(manifest.event_id, ticketId);
  try {
    await flushQueue(manifest.event_id);
  } catch {
    /* stays queued */
  }
  return manifest;
}

export function insideCount(manifest: DoorManifest): { scanned: number; total: number } {
  const all = Object.values(manifest.tickets);
  return {
    scanned: all.filter((t) => t.status === "scanned").length,
    total: all.length,
  };
}
