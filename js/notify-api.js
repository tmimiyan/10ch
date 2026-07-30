// Cloudflare Worker に通知作成を依頼します。通知失敗は投稿自体を失敗させません。
const WORKER_URL = "https://10ch-notifier.mimiyan4649.workers.dev";

export async function requestPostNotification(user, post) {
  if (!user || WORKER_URL.startsWith("YOUR_")) return;
  const idToken = await user.getIdToken();
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    // ページ遷移直前でも、投稿済みの通知依頼を可能な限り送信します。
    keepalive: true,
    body: JSON.stringify(post)
  });
  if (!response.ok) throw new Error(`通知リクエストに失敗しました (${response.status})`);
}
