import { useState } from "react";

const SettingsModal = ({ closeSettings, currentTheme, toggleTheme }) => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("api_key") || "");

  const saveSettings = (event) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      alert("API key cannot be empty.");
      return;
    }

    localStorage.setItem("api_key", trimmedKey);
    alert("API key saved in this browser.");
    closeSettings();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
    >
      <form
        onSubmit={saveSettings}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800"
        aria-labelledby="settings-title"
      >
        <h2 id="settings-title" className="mb-4 text-xl font-semibold dark:text-white">
          Settings
        </h2>

        <label htmlFor="gemini-api-key" className="mb-1 block text-sm dark:text-gray-300">
          Gemini API key
        </label>
        <input
          id="gemini-api-key"
          type="password"
          autoComplete="off"
          placeholder="Enter Gemini API key"
          className="mb-4 w-full rounded-md border px-3 py-2 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />

        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          The key is stored in this browser's local storage. Do not use a shared or public computer.
        </p>

        <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          Save API key
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-2 w-full rounded bg-gray-200 py-2 text-gray-900 dark:bg-gray-700 dark:text-white"
        >
          Switch to {currentTheme === "light" ? "dark" : "light"} theme
        </button>
        <button
          type="button"
          onClick={closeSettings}
          className="mt-2 w-full rounded bg-gray-300 py-2 dark:bg-gray-700 dark:text-white"
        >
          Close
        </button>
      </form>
    </div>
  );
};

export default SettingsModal;
