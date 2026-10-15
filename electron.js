const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let pythonProcess = null;
let mainWindow = null;

function startPythonBackend() {
  const basePath = app.isPackaged ? process.resourcesPath : __dirname;
  const pythonPath = path.join(basePath, "backend", "myenv", "Scripts", "python.exe");
  const apiFile = path.join(basePath, "backend", "app", "api.py");

  if (!fs.existsSync(apiFile)) {
    console.error(`Python API entry point was not found: ${apiFile}`);
    return;
  }

  const command = fs.existsSync(pythonPath) ? pythonPath : (process.platform === "win32" ? "py" : "python3");
  const args = command === "py" ? ["-3.11", apiFile] : [apiFile];

  pythonProcess = spawn(command, args, {
    cwd: path.dirname(apiFile),
    stdio: app.isPackaged ? "ignore" : "inherit",
    windowsHide: true,
  });

  pythonProcess.on("error", (error) => {
    console.error("Could not start the Python RAG backend:", error.message);
  });
  pythonProcess.on("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(`Python RAG backend exited with code ${code}${signal ? ` (${signal})` : ""}.`);
    }
    pythonProcess = null;
  });
}

async function loadFrontend(window) {
  if (app.isPackaged) {
    await window.loadFile(path.join(process.resourcesPath, "frontend", "dist", "index.html"));
    return;
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  try {
    await window.loadURL(devUrl);
  } catch (error) {
    console.error(`Could not load the frontend at ${devUrl}:`, error.message);
    if (!window.isDestroyed()) {
      setTimeout(() => {
        if (!window.isDestroyed()) void loadFrontend(window);
      }, 1500);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 850,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void loadFrontend(mainWindow);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
