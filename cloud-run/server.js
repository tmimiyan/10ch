// Cloud Run receiver for Eventarc Firestore create events. It sends FCM data notifications.
const express = require("express");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const app = express();
const SITE_URL = process.env.SITE_URL || "https://www.10-ch.net/";

function threadUrl(threadId) {
  return `${SITE_URL.replace(/\/$/, "")}/thread.html?id=${encodeURIComponent(threadId)}`;
}

async function notifyDevices(title, body, url) {
  const tokens = await db.collection("notificationTokens").get();
  const devices = tokens.docs.map((document) => ({ ref: document.ref, token: document.data().token })).filter((device) => typeof device.token === "string");
  for (let start = 0; start < devices.length; start += 500) {
    const batch = devices.slice(start, start + 500);
    const response = await getMessaging().sendEachForMulticast({ tokens: batch.map((device) => device.token), data: { title, body, url } });
    const stale = response.responses.flatMap((result, index) => {
      const code = result.error?.code;
      return !result.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code) ? [batch[index].ref] : [];
    });
    await Promise.all(stale.map((ref) => ref.delete()));
  }
}

app.get("/", (_request, response) => response.status(200).send("OpenBBS notifier is running."));
app.post("/", async (request, response) => {
  try {
    // Eventarc provides the changed Firestore path in the CloudEvents ce-subject header.
    const subject = request.get("ce-subject") || "";
    const path = subject.replace(/^documents\//, "");
    const match = path.match(/^threads\/([^/]+)(?:\/replies\/([^/]+))?$/);
    if (!match) return response.status(204).end();
    const [, threadId, replyId] = match;
    const changedDocument = await db.doc(path).get();
    if (!changedDocument.exists) return response.status(204).end();

    if (!replyId) {
      const thread = changedDocument.data();
      await notifyDevices("新しいスレッド", thread.title || "10ちゃんねる", threadUrl(threadId));
    } else {
      const reply = changedDocument.data();
      const thread = await db.doc(`threads/${threadId}`).get();
      const title = thread.exists ? thread.data().title : "10ちゃんねる";
      await notifyDevices(`新しいレス: ${title}`, (reply.body || "画像が投稿されました。").slice(0, 120), threadUrl(threadId));
    }
    return response.status(204).end();
  } catch (error) {
    console.error("Notification delivery failed", error);
    return response.status(500).send("Notification delivery failed.");
  }
});

app.listen(process.env.PORT || 8080);
