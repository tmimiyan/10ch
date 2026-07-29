// Firestore triggers that deliver background notifications to subscribed FCM devices.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const SITE_URL = process.env.SITE_URL || "https://YOUR_NAME.github.io/YOUR_REPOSITORY/";

function postUrl(threadId) {
  return `${SITE_URL.replace(/\/$/, "")}/thread.html?id=${encodeURIComponent(threadId)}`;
}

async function notifyDevices(title, body, url) {
  const tokenSnapshot = await db.collection("notificationTokens").get();
  const devices = tokenSnapshot.docs.map((document) => ({ ref: document.ref, token: document.data().token })).filter((device) => typeof device.token === "string");
  for (let start = 0; start < devices.length; start += 500) {
    const batch = devices.slice(start, start + 500);
    const response = await getMessaging().sendEachForMulticast({ tokens: batch.map((device) => device.token), data: { title, body, url } });
    const invalid = response.responses.flatMap((result, index) => result.success ? [] : [batch[index].ref]);
    await Promise.all(invalid.map((ref) => ref.delete()));
  }
}

exports.notifyNewThread = onDocumentCreated("threads/{threadId}", async (event) => {
  const thread = event.data.data();
  await notifyDevices("新しいスレッド", thread.title || "10ちゃんねる", postUrl(event.params.threadId));
});

exports.notifyNewReply = onDocumentCreated("threads/{threadId}/replies/{replyId}", async (event) => {
  const reply = event.data.data();
  const thread = await db.doc(`threads/${event.params.threadId}`).get();
  const title = thread.exists ? thread.data().title : "10ちゃんねる";
  const body = reply.body || "画像が投稿されました。";
  await notifyDevices(`新しいレス: ${title}`, body.slice(0, 120), postUrl(event.params.threadId));
});
