const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("contactsAPI", {
  list: () => ipcRenderer.invoke("contacts:list"),
  composeEmail: (recipient) => ipcRenderer.invoke("contacts:compose-email", recipient),
  create: (contact) => ipcRenderer.invoke("contacts:create", contact),
  update: (id, contact) => ipcRenderer.invoke("contacts:update", id, contact),
  delete: (id) => ipcRenderer.invoke("contacts:delete", id),
  toggleFavorite: (id) => ipcRenderer.invoke("contacts:toggle-favorite", id),
  importCSV: () => ipcRenderer.invoke("contacts:import-csv"),
  exportCSV: () => ipcRenderer.invoke("contacts:export-csv"),
  getTheme: () => ipcRenderer.invoke("preferences:get-theme"),
  setTheme: (theme) => ipcRenderer.invoke("preferences:set-theme", theme),
  getVisibleFields: () => ipcRenderer.invoke("preferences:get-visible-fields"),
  setVisibleFields: (fields) => ipcRenderer.invoke("preferences:set-visible-fields", fields),
  getSidebarLayout: () => ipcRenderer.invoke("preferences:get-sidebar-layout"),
  setSidebarLayout: (layout) => ipcRenderer.invoke("preferences:set-sidebar-layout", layout),
});
