/**
 * ==========================================================
 * OpenBBS Board
 * Version 0.2.0
 * ==========================================================
 */

import { api } from "./api.js";
import { formatDate, escapeHTML, showLoading, showError } from "./common.js";

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
    loadThreads();
});

/**
 * スレ一覧取得
 */
async function loadThreads() {

    const container = document.getElementById("threadList");
    const count = document.getElementById("threadCount");

    if (!container) return;

    showLoading(container);

    try {

        const threads = await api.getThreads();

        renderThreads(container, threads);

        if (count) {
            count.textContent = `${threads.length} Threads`;
        }

    } catch (error) {

        console.error(error);

        showError(
            container,
            "スレッドの取得に失敗しました。"
        );

    }

}

/**
 * スレッド一覧描画
 */
function renderThreads(container, threads) {

    container.innerHTML = "";

    if (!threads.length) {

        container.innerHTML = `
            <div class="loading">
                スレッドがありません。
            </div>
        `;

        return;
    }

    for (const thread of threads) {

        container.appendChild(createThreadCard(thread));

    }

}

/**
 * スレッドカード作成
 */
function createThreadCard(thread) {

    const card = document.createElement("article");

    card.className = "thread";

    card.dataset.title = thread.title.toLowerCase();

    card.innerHTML = `

        <div class="threadTitle">

            ${escapeHTML(thread.title)}

        </div>

        <div class="threadInfo">

            <span>👤 ${escapeHTML(thread.author)}</span>

            <span>💬 ${thread.comments}</span>

            <span>📅 ${formatDate(thread.created)}</span>

            <span>🕒 ${formatDate(thread.updated)}</span>

        </div>

    `;

    card.addEventListener("click", () => {

        location.href =
            `thread.html?id=${thread.id}`;

    });

    return card;

}

/**
 * 検索
 */
export function filterThreads(keyword) {

    keyword = keyword
        .trim()
        .toLowerCase();

    document
        .querySelectorAll(".thread")
        .forEach(card => {

            const title =
                card.dataset.title;

            card.style.display =
                title.includes(keyword)
                    ? ""
                    : "none";

        });

}