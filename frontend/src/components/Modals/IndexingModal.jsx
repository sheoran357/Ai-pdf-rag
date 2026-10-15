import React from "react";

const IndexingModal = ({ progress, message }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-80 shadow-lg">
        <h2 className="text-lg font-semibold mb-3 dark:text-white">
          Indexing PDF…
        </h2>

        <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-3 transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    </div>
  );
};

export default IndexingModal;
