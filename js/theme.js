/**
 * theme.js
 * Controle de tema claro/escuro com persistência.
 */

const THEME_KEY = "cv_theme";
const root = document.documentElement;
const preferred = localStorage.getItem(THEME_KEY) || "dark";
root.setAttribute("data-theme", preferred);

export function toggleTheme() {
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

export function getTheme() {
  return root.getAttribute("data-theme");
}