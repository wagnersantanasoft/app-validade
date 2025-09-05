/**
 * theme.js - alternância claro/escuro
 */
const THEME_KEY = "cv_theme";
const root = document.documentElement;
const stored = localStorage.getItem(THEME_KEY);
if (stored) root.setAttribute("data-theme", stored);

export function toggleTheme() {
  const current = root.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}