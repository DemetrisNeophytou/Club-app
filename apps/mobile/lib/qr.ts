import * as Crypto from "expo-crypto";

/**
 * Rotating QR nonce (spec hard rule 3, anti-screenshot).
 * nonce = first 12 hex chars of sha256(`${qr_secret}:${floor(epoch/60)}`).
 * The validate-scan Edge Function recomputes it server-side (±1 window
 * for clock skew), so a screenshot dies within ~60 seconds.
 */
export const QR_WINDOW_SECONDS = 60;

export function currentWindow(now = Date.now()): number {
  return Math.floor(now / 1000 / QR_WINDOW_SECONDS);
}

export async function qrNonce(qrSecret: string, window: number): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${qrSecret}:${window}`,
  );
  return digest.slice(0, 12);
}

export async function qrPayload(ticketId: string, qrSecret: string): Promise<string> {
  const nonce = await qrNonce(qrSecret, currentWindow());
  return `PORTAL1.${ticketId}.${nonce}`;
}

/** QR becomes valid 2h before doors (hard rule 3). */
export function qrActiveFrom(doorsAt: string): Date {
  return new Date(new Date(doorsAt).getTime() - 2 * 60 * 60 * 1000);
}
