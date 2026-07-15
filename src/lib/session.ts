// Edge-safe session helpers.
//
// IMPORTANT: this module is imported by `src/proxy.ts`, which runs on the
// Edge runtime where Node's `crypto` module is unavailable. Everything here uses
// only Web Crypto (`crypto.subtle`), `TextEncoder`, and `btoa`/`atob`, so the same
// code works in the proxy (Edge) and in route handlers (Node).
//
// A session token is `base64url(payloadJson).base64url(HMAC-SHA256(payloadJson))`.
// The payload is signed, not encrypted — tampering is what we guard against,
// via the signature. All student data lives in the local database, so the
// payload only needs to carry the username.

export const SESSION_COOKIE = "mk_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours, in seconds

/**
 * True when the client actually connected over https (directly or via a
 * proxy). The session cookie's Secure flag must follow the connection, not
 * NODE_ENV: browsers silently drop a Secure cookie delivered over plain http
 * (e.g. a phone on the LAN hitting http://192.168.x.x:3000 against the
 * production build), which turns every login into a bounce back to /login.
 */
export function isHttpsRequest(request: {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
}): boolean {
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return proto.split(",")[0].trim() === "https";
}

export type Role = "student";

export interface SessionPayload {
  u: string; // student username
  role: Role;
  exp: number; // expiry, unix seconds
}

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SECRET_KEY;
  if (!secret) throw new Error("SECRET_KEY is not set");
  return secret;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToB64url(str: string): string {
  return bytesToB64url(encoder.encode(str));
}

function b64urlToStr(b64url: string): string {
  return new TextDecoder().decode(b64urlToBytes(b64url));
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Create a signed session token for the given student username. */
export async function signSession(username: string): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    role: "student",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const payloadB64 = strToB64url(JSON.stringify(payload));
  const key = await importKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Verify a session token. Returns the payload, or null if invalid/expired. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  try {
    const key = await importKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sigB64),
      encoder.encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(b64urlToStr(payloadB64)) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
