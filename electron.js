const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let pythonProcess = null;

function startPythonBackend() {
  // If packaged, use resourcesPath
  const basePath = app.isPackaged ? process.resourcesPath : __dirname;

  const pythonPath = path.join(basePath, "backend", "myenv", "Scripts", "python.exe");
  const apiFile = path.join(basePath, "backend", "app", "api.py");

  pythonProcess = spawn(pythonPath, [apiFile], {
    cwd: path.join(basePath, "backend", "app"),
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  pythonProcess.unref();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(process.resourcesPath, "frontend", "dist", "index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
