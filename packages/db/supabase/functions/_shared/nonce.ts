/**
 * Rotating QR nonce — server twin of apps/mobile/lib/qr.ts.
 * nonce = first 12 hex chars of sha256(`${qr_secret}:${floor(epoch/60)}`).
 */
export const QR_WINDOW_SECONDS = 60;

export function currentWindow(now = Date.now()): number {
  return Math.floor(now / 1000 / QR_WINDOW_SECONDS);
}

export async function qrNonce(qrSecret: string, window: number): Promise<string> {
  const bytes = new TextEncoder().encode(`${qrSecret}:${window}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/** Accept current window ±1 (clock skew between phone, server, scanner). */
export async function nonceMatches(qrSecret: string, nonce: string): Promise<boolean> {
  const w = currentWindow();
  for (const candidate of [w, w - 1, w + 1]) {
    if ((await qrNonce(qrSecret, candidate)) === nonce) return true;
  }
  return false;
}
