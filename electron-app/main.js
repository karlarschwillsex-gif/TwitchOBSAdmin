const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const http = require("http");

const ADMIN_URL = "http://localhost:3000/admin.html";

let introWindow;
let mainWindow;

function waitForAdminPanel(callback) {
  const tryConnect = () => {
    http.get(ADMIN_URL, () => {
      callback(true);
    }).on("error", () => {
      setTimeout(tryConnect, 300);
    });
  };
  tryConnect();
}

function createIntroWindow() {
  introWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "LOGO.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  introWindow.loadFile(path.join(__dirname, "index.html"));

  // WICHTIG: Erst wenn index.html fertig geladen ist
  introWindow.webContents.on("did-finish-load", () => {

    // 3 Sekunden warten, damit preload + HTML sicher bereit sind
    setTimeout(() => {
      waitForAdminPanel(() => {
        introWindow.webContents.send("backend-ready");
      });
    }, 3000);

  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "LOGO.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadURL(ADMIN_URL);
}

app.whenReady().then(() => {
  createIntroWindow();
});

ipcMain.on("open-main-window", () => {
  createMainWindow();
  introWindow.close();
});

