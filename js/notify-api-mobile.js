// 投稿後に Cloudflare Worker へ通知を依頼するための小さな通信モジュールです。
// モバイル回線で一時的に通信が切り替わることを考慮し、1 回だけ再試行します。
const WORKER_URL = "https://10ch-notifier.mimiyan4649.workers.dev";
const RETRY_DELAY_MS = 1200;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function sendNotificationRequest(idToken, post) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(post),
  });

  if (response.ok) return;

  const detail = await response.text().catch(() => "");
  throw new Error(detail || `通知サーバーへの接続に失敗しました（${response.status}）`);
}

export async function requestPostNotification(user, post) {
  if (!user || WORKER_URL.startsWith("YOUR_")) return;

  const idToken = await user.getIdToken();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendNotificationRequest(idToken, post);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await delay(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}
