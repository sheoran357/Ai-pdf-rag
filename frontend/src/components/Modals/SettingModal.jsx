import React, { useState } from "react";

const SettingsModal = ({ closeSettings }) => {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("api_key") || ""
  );

  const saveSettings = () => {
    if (!apiKey.trim()) {
      alert("API key cannot be empty.");
      return;
    }

 
    localStorage.setItem("api_key", apiKey.trim());

    alert("API key saved!");
    closeSettings();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-80 shadow-lg">

        <h2 className="text-xl font-semibold mb-4 dark:text-white">Settings</h2>

        {/* API Key Field */}
        <div className="mb-4">
          <label className="block mb-1 text-sm dark:text-gray-300">API Key</label>

          <input
            type="password"
            placeholder="Enter Gemini API Key"
            className="w-full px-3 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <button
          onClick={saveSettings}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save
        </button>

        <button
          onClick={closeSettings}
          className="w-full mt-2 py-2 bg-gray-300 dark:bg-gray-700 dark:text-white rounded"
        >
          Close
        </button>

      </div>
    </div>
  );
};

export default SettingsModal;
