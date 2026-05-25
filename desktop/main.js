const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");

let mainWindow;
let backendProcess;
let isQuitting = false;

// Updated to use v2 port to avoid conflict with original project
const PORT = 3017;
const userHome = app.getPath("home");
const appDataDir = path.join(userHome, ".weizhi-agent-v2");
const storageDir = path.join(appDataDir, "storage");

[appDataDir, storageDir, path.join(storageDir, "data"), path.join(storageDir, "generated_images"), path.join(storageDir, "generated_audio")].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 900,
    webPreferences: {
      contextIsolation: true,
      // Security fix: removed webSecurity: false
      // The backend runs on localhost so we don't need to disable web security.
      // The resolveApiUrl() utility handles the file:// → localhost:3017 mapping.
      nodeIntegration: false,
      sandbox: true
    },
    title: "Weizhi Agent v2",
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, "frontend-dist", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => mainWindow = null);
}

function killExisting() {
  try {
    if (process.platform === "win32") execSync(`for /f "tokens=5" %a in ("netstat -aon ^| findstr :${PORT}") do taskkill /f /pid %a`);
    else execSync(`lsof -ti :${PORT} | xargs kill -9`);
  } catch (e) {}
}

function startBackend() {
  killExisting();
  const isProd = app.isPackaged;
  let javaBin = "java";
  let jarPath = path.join(__dirname, "..", "backend", "target", "weizhi-agent-2.0.0.jar");
  let cwd = path.join(__dirname, "..", "backend");

  if (isProd) {
    cwd = path.join(process.resourcesPath, "bin");
    jarPath = path.join(cwd, "backend.jar");
  }

  const args = [
    "-jar", jarPath,
    `--server.port=${PORT}`,
    `--app.generated-images-path=${path.join(storageDir, "generated_images")}`,
    `--storage.image-dir=${path.join(storageDir, "generated_images")}`,
    `--storage.audio-dir=${path.join(storageDir, "generated_audio")}`,
    `--storage.image-history-file=${path.join(storageDir, "data", "image-history.json")}`,
    `--storage.tts-history-file=${path.join(storageDir, "data", "tts-history.json")}`,
    `--settings.file=${path.join(storageDir, "data", "ai-settings.json")}`
  ];
  backendProcess = spawn(javaBin, args, {
    cwd, stdio: "pipe", env: { ...process.env, SPRING_PROFILES_ACTIVE: "prod" }
  });

  backendProcess.on("error", (err) => {
    if (!isQuitting) dialog.showErrorBox("Backend Error", err.message);
  });
}

function waitAndLaunch() {
  const check = () => {
    http.get(`http://localhost:${PORT}/api/health`, (res) => {
      if (res.statusCode === 200) createWindow();
      else setTimeout(check, 1000);
    }).on("error", () => setTimeout(check, 1000));
  };
  setTimeout(check, 2000);
}

app.on("ready", () => { startBackend(); waitAndLaunch(); });
app.on("before-quit", () => { isQuitting = true; if (backendProcess) backendProcess.kill(); });
