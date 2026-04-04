const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },

  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  }
});

