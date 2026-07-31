// Firebaseの投稿実体を検証してからOneSignalへ通知を送るCloudflare Workerです。
// Firebase ID トークンの署名鍵（Google が公開している JWK）を短時間キャッシュする。
let firebaseJwks = null;
let firebaseJwksExpiresAt = 0;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN || new URL(env.SITE_URL).origin;
  return origin === allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, "Vary": "Origin" } : {};
}

function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
}

async function getFirebaseJwks() {
  if (firebaseJwks && Date.now() < firebaseJwksExpiresAt) return firebaseJwks;
  // X.509 証明書を SPKI として取り込むと DataError になるため、Web Crypto が直接読める JWK を使う。
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Firebase公開鍵を取得できませんでした。");
  const cacheControl = response.headers.get("Cache-Control") || "";
  const seconds = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  firebaseJwks = await response.json();
  firebaseJwksExpiresAt = Date.now() + seconds * 1000;
  return firebaseJwks;
}

async function verifyFirebaseToken(request, projectId) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("認証トークンがありません。");
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("認証トークンの形式が不正です。");
  const header = parseJwtPart(encodedHeader);
  const payload = parseJwtPart(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) throw new Error("認証トークンの署名方式が不正です。");
  const jwk = (await getFirebaseJwks()).keys?.find((item) => item.kid === header.kid);
  if (!jwk) throw new Error("認証トークンの署名鍵が見つかりません。");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlBytes(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  const now = Math.floor(Date.now() / 1000);
  if (!verified || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || typeof payload.sub !== "string" || !payload.sub || typeof payload.exp !== "number" || typeof payload.iat !== "number" || payload.exp <= now || payload.iat > now + 60) throw new Error("認証トークンを検証できませんでした。");
  return { uid: payload.sub, token };
}

function safeDocumentId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/");
}

async function getFirestoreDocument(env, path, idToken) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path}`, { headers: { "Authorization": `Bearer ${idToken}` } });
  if (!response.ok) throw new Error("投稿データを確認できませんでした。");
  return response.json();
}

function textField(document, name) {
  return document.fields?.[name]?.stringValue || "";
}

async function sendOneSignal(env, title, body, url) {
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Key ${env.ONESIGNAL_API_KEY}` },
    body: JSON.stringify({ app_id: env.ONESIGNAL_APP_ID, target_channel: "push", included_segments: ["Subscribed Users"], headings: { ja: title, en: title }, contents: { ja: body.slice(0, 120), en: body.slice(0, 120) }, url, web_url: url })
  });
  if (!response.ok) throw new Error(`OneSignal API error ${response.status}`);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
    if (request.method !== "POST") return json({ error: "Not found" }, 404, cors);
    if (!Object.keys(cors).length) return json({ error: "Origin is not allowed" }, 403);
    try {
      const { uid, token } = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID);
      const event = await request.json();
      if (!safeDocumentId(event.threadId) || !["thread", "reply"].includes(event.type) || (event.type === "reply" && !safeDocumentId(event.replyId))) throw new Error("通知リクエストが不正です。");
      const path = event.type === "thread" ? `threads/${encodeURIComponent(event.threadId)}` : `threads/${encodeURIComponent(event.threadId)}/replies/${encodeURIComponent(event.replyId)}`;
      const post = await getFirestoreDocument(env, path, token);
      if (textField(post, "authorId") !== uid) throw new Error("この投稿の通知を送る権限がありません。");
      const url = `${env.SITE_URL.replace(/\/$/, "")}/thread.html?id=${encodeURIComponent(event.threadId)}`;
      const body = event.type === "thread" ? textField(post, "title") : (textField(post, "body") || "画像が投稿されました。");
      await sendOneSignal(env, event.type === "thread" ? "新しいスレッド" : "新しいレス", body || "10ちゃんねる", url);
      return json({ ok: true }, 200, cors);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || "通知を送信できませんでした。" }, 400, cors);
    }
  }
};
