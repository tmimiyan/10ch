/**
 * ==========================================================
 * OpenBBS Common
 * Version 0.1.0
 * ==========================================================
 */

import { CONFIG, STORAGE_KEY } from "./config.js";

/**
 * DOM読み込み後に実行
 */
document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

/**
 * 初期化
 */
function initialize() {
    console.log(`${CONFIG.appName} v${CONFIG.version}`);

    initializeTheme();

    initializeSearch();

    initializeFooter();
}

/* ==========================================================
    Theme
========================================================== */

/**
 * テーマ初期化
 */
function initializeTheme() {

    const button = document.getElementById("themeButton");

    if (!button) return;

    let theme = localStorage.getItem(STORAGE_KEY.theme);

    if (!theme) {
        theme = CONFIG.theme.default;
    }

    applyTheme(theme);

    button.addEventListener("click", () => {

        theme =
            document.body.classList.contains("dark")
                ? "light"
                : "dark";

        applyTheme(theme);

    });

}

/**
 * テーマ適用
 */
function applyTheme(theme) {

    document.body.classList.toggle(
        "dark",
        theme === "dark"
    );

    localStorage.setItem(
        STORAGE_KEY.theme,
        theme
    );

    const button =
        document.getElementById("themeButton");

    if (button) {
        button.textContent =
            theme === "dark" ? "☀️" : "🌙";
    }

}

/* ==========================================================
    Search
========================================================== */

function initializeSearch() {

    const search =
        document.getElementById("searchBox");

    if (!search) return;

    search.addEventListener("input", event => {

        const keyword =
            event.target.value.toLowerCase();

        document
            .querySelectorAll(".thread")
            .forEach(thread => {

                const title =
                    thread.dataset.title || "";

                thread.style.display =
                    title.includes(keyword)
                        ? ""
                        : "none";

            });

    });

}

/* ==========================================================
    Footer
========================================================== */

function initializeFooter() {

    console.log("OpenBBS Ready");

}

/* ==========================================================
    Utility
========================================================== */

/**
 * 日付フォーマット
 */
export function formatDate(dateString) {

    const date =
        new Date(dateString);

    return date.toLocaleString("ja-JP");

}

/**
 * HTMLエスケープ
 */
export function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}

/**
 * ローディング表示
 */
export function showLoading(target) {

    target.innerHTML =
        `<div class="loading">
            読み込み中...
        </div>`;

}

/**
 * エラー表示
 */
export function showError(target, message) {

    target.innerHTML =
        `<div class="loading">
            ${escapeHTML(message)}
        </div>`;

}