// Eventarc が Firestore の新規作成イベントを CloudEvent として POST する HTTP サービスです。
const express = require("express");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const app = express();
const siteUrl = (process.env.SITE_URL || "https://YOUR_NAME.github.io/YOUR_REPOSITORY/").replace(/\/$/, "");

app.use(express.json({ type: ["application/json", "application/cloudevents+json"] }));
app.get("/healthz", (_request, response) => response.status(200).send("ok"));

// Firestore の CloudEvent の Value から、画面表示に必要な文字列だけを取り出します。
function stringField(fields, fieldName) {
  const value = fields?.[fieldName];
  return typeof value?.stringValue === "string" ? value.stringValue : "";
}

function documentPath(event) {
  const name = event?.data?.value?.name || "";
  const marker = "/documents/";
  return name.includes(marker) ? name.slice(name.indexOf(marker) + marker.length) : "";
}

function urlForThread(threadId) {
  return `${siteUrl}/thread.html?id=${encodeURIComponent(threadId)}`;
}

async function sendToRegisteredDevices(title, body, url) {
  const tokenSnapshot = await db.collection("notificationTokens").get();
  const devices = tokenSnapshot.docs
    .map((tokenDocument) => ({ reference: tokenDocument.ref, token: tokenDocument.get("token") }))
    .filter((device) => typeof device.token === "string" && device.token.length > 0);

  // FCM multicast の上限は 500 トークンです。
  for (let index = 0; index < devices.length; index += 500) {
    const group = devices.slice(index, index + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: group.map((device) => device.token),
      data: { title, body: body.slice(0, 120), url }
    });
    const invalidCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
    const stale = result.responses.flatMap((resultItem, resultIndex) =>
      invalidCodes.has(resultItem.error?.code) ? [group[resultIndex].reference] : []
    );
    await Promise.all(stale.map((reference) => reference.delete()));
  }
}

app.post("/events", async (request, response) => {
  try {
    const path = documentPath(request.body);
    const segments = path.split("/");
    const fields = request.body?.data?.value?.fields || {};

    if (segments.length === 2 && segments[0] === "threads") {
      await sendToRegisteredDevices("新しいスレッド", stringField(fields, "title") || "10ちゃんねる", urlForThread(segments[1]));
    } else if (segments.length === 4 && segments[0] === "threads" && segments[2] === "replies") {
      const thread = await db.doc(`threads/${segments[1]}`).get();
      const title = thread.exists ? thread.get("title") : "10ちゃんねる";
      const body = stringField(fields, "body") || "画像が投稿されました。";
      await sendToRegisteredDevices(`新しいレス: ${title}`, body, urlForThread(segments[1]));
    } else {
      console.warn("Unexpected Firestore event path:", path);
    }
    response.status(204).end();
  } catch (error) {
    console.error("Notification delivery failed", error);
    // Eventarc に一時的な失敗を伝え、設定された再試行ポリシーを機能させます。
    response.status(500).send("Notification delivery failed");
  }
});

app.listen(process.env.PORT || 8080, () => console.log("10ch notifier is running"));
