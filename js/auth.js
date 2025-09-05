const STORAGE_KEY = "cv_auth";

export const auth = {
  async login(username, password) {
    // A autenticação real está no mock via api.login
    const { api } = await import("./api.js");
    const data = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  },
  getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
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