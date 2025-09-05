/**
 * auth.js
 * Responsável por operações de autenticação no frontend (token, login, logout).
 */

import { api } from "./api.js";

const STORAGE_KEY = "cv_auth";

export const auth = {
  async login(username, password) {
    const data = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  },

  getSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken() {
    return this.getSession()?.token || null;
  },

  logout() {
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};