// Persist the user's color preference and update every page's toggle button.
const key = "openbbs-theme";

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.textContent = theme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", theme === "dark" ? "ライトモードに切り替える" : "ダークモードに切り替える");
  });
}

export function initTheme() {
  const saved = localStorage.getItem(key);
  const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(saved || preferred);
  document.querySelectorAll(".theme-toggle").forEach((button) => button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(key, next);
    applyTheme(next);
  }));
}
