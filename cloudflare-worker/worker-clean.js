// 10ちゃんねる通知用 Cloudflare Worker.
// OneSignal の App API Key は Wrangler Secret のみで管理する。

const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ONESIGNAL_APP_ID = "71ca2f3d-df06-4b33-b3e9-5b9d1ef60e76";

let jwksCache = null;
let jwksExpiresAt = 0;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN || new URL(env.SITE_URL).origin;
  return origin === allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {};
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function parseJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function firebaseJwks() {
  if (jwksCache && Date.now() < jwksExpiresAt) return jwksCache;
  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) throw new Error("Unable to retrieve Firebase signing keys.");
  const cacheControl = response.headers.get("Cache-Control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  jwksCache = await response.json();
  jwksExpiresAt = Date.now() + maxAge * 1000;
  return jwksCache;
}

async function verifyFirebaseToken(request, projectId) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authorization token is required.");
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Malformed Firebase token.");

  const header = parseJwtPart(headerPart);
  const payload = parseJwtPart(payloadPart);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Firebase token.");

  const jwk = (await firebaseJwks()).keys?.find((item) => item.kid === header.kid);
  if (!jwk) throw new Error("Firebase signing key was not found.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );

  const now = Math.floor(Date.now() / 1000);
  if (!verified || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !payload.sub || payload.exp <= now) {
    throw new Error("Firebase token verification failed.");
  }
  return { uid: payload.sub, token };
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/");
}

async function firestoreDocument(env, path, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!response.ok) throw new Error("Unable to read the post from Firestore.");
  return response.json();
}

async function notificationSubscriptionIds(env, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "notificationDevices" }], limit: 20000 } })
  });
  if (!response.ok) throw new Error("Unable to retrieve notification devices from Firestore.");
  const rows = await response.json();
  return rows
    .map((row) => row.document?.fields?.subscriptionId?.stringValue)
    .filter((value) => typeof value === "string" && value.length > 0);
}

function stringField(document, name) {
  return document.fields?.[name]?.stringValue || "";
}

async function logOneSignalSegment(apiKey) {
  const headers = { Authorization: `Key ${apiKey}` };
  const listResponse = await fetch(`https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/segments`, { headers });
  const list = await listResponse.json().catch(() => ({}));
  const segment = list.segments?.find((item) => item.name === ONESIGNAL_SEGMENT);
  if (!segment?.id) {
    console.warn("OneSignal segment was not found by API", { segment: ONESIGNAL_SEGMENT, segmentNames: list.segments?.map((item) => item.name) || [], status: listResponse.status });
    return;
  }
  const detailResponse = await fetch(`https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/segments/${segment.id}`, { headers });
  const detail = await detailResponse.json().catch(() => ({}));
  console.log("OneSignal segment diagnostic", { name: segment.name, id: segment.id, subscriberCount: detail.subscriber_count ?? null, status: detailResponse.status });
}

async function sendOneSignal(apiKey, title, message, subscriptionIds) {
  if (!subscriptionIds.length) throw new Error("No notification devices are registered.");
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",
    name: "10ch notifier",
    headings: { en: title },
    contents: { en: message.slice(0, 120) },
    include_subscription_ids: subscriptionIds
  };
  console.log("10ch notifier direct delivery", { version: "2026-08-01-direct-1", deviceCount: subscriptionIds.length });
  const response = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Key ${apiKey}` },
    body: JSON.stringify(payload)
  });
  const rawResult = await response.text();
  let result = {};
  try { result = rawResult ? JSON.parse(rawResult) : {}; } catch { result = { raw: rawResult }; }
  if (!response.ok) {
    console.error("OneSignal response diagnostic", { status: response.status, contentType: response.headers.get("Content-Type"), rawResult: rawResult.slice(0, 500) });
    throw new Error(`OneSignal API error ${response.status}: ${rawResult || "(empty response body)"}`);
  }
  if (!result.id) throw new Error(`OneSignal did not create a notification: ${JSON.stringify(result)}`);
  return result.id;
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") return new Response("10ch notifier is running.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });

    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
    }
    if (request.method !== "POST") return json({ error: "Not found" }, 404, cors);
    if (!Object.keys(cors).length) return json({ error: "Origin is not allowed" }, 403);

    try {
      const { uid, token } = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID);
      const event = await request.json();
      if (!validId(event.threadId) || !["thread", "reply"].includes(event.type) || (event.type === "reply" && !validId(event.replyId))) {
        throw new Error("Invalid notification request.");
      }
      const path = event.type === "thread"
        ? `threads/${encodeURIComponent(event.threadId)}`
        : `threads/${encodeURIComponent(event.threadId)}/replies/${encodeURIComponent(event.replyId)}`;
      const post = await firestoreDocument(env, path, token);
      if (stringField(post, "authorId") !== uid) throw new Error("The post author does not match the signed-in user.");

      const title = event.type === "thread" ? "New thread" : "New reply";
      const message = event.type === "thread" ? stringField(post, "title") : (stringField(post, "body") || "An image was posted.");
      // Use a dedicated binding name to avoid collisions with an existing dashboard variable.
      const apiKey = String(env.ONESIGNAL_APP_API_KEY || "").trim();
      if (!apiKey) throw new Error("ONESIGNAL_APP_API_KEY is not configured.");
      const subscriptionIds = await notificationSubscriptionIds(env, token);
      const notificationId = await sendOneSignal(apiKey, title, message, subscriptionIds);
      return json({ ok: true, notificationId }, 200, cors);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || "Notification failed." }, 400, cors);
    }
  }
};
