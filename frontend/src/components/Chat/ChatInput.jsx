import React, { useState, useContext } from "react";
import { ChatContext } from "../../context/ChatContext";
import UploadButton from "./UploadButton";

const ChatInput = () => {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const { sendMessage } = useContext(ChatContext);

  const handleSend = async () => {
    if (!input.trim() && !file) return;
    await sendMessage({ text: input, file });
    setInput("");
    setFile(null);
  };

  return (
   <div className="absolute bottom-0 left-0 right-0 pb-6 pt-4 flex justify-center z-40 bg-white/70 dark:bg-black/70 backdrop-blur-xl">

      <div className="w-full max-w-3xl px-4">

        {file && (
          <div className="mb-2 flex items-center gap-3 bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-sm">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[70%]">
              {file.name}
            </span>
            <button
              onClick={() => setFile(null)}
              aria-label="Remove file"
              className="text-red-500 hover:opacity-80"
            >
              ✕
            </button>
          </div>
        )}

        {/* The ONLY part with semi-transparent background */}
        <div className="
          flex items-center 
          bg-white/80 dark:bg-neutral-900/80 
          backdrop-blur-lg
          border border-gray-300 dark:border-neutral-700 
          rounded-full px-4 py-2 
          shadow-lg
        ">
          <UploadButton onFileSelect={setFile} />

          <input
            aria-label="Message input"
            className="flex-1 bg-transparent px-3 outline-none text-sm text-gray-800 dark:text-gray-100"
            placeholder="Message PDF Brian… (press Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />

          <button
            onClick={handleSend}
            aria-label="Send message"
            disabled={!input.trim() && !file}
            className={`
              px-3 py-2 rounded-full text-sm flex items-center justify-center ml-2 transition
              ${input.trim() || file
                ? "bg-black dark:bg-white dark:text-black shadow-md text-white"
                : "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed text-gray-500"
              }
            `}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
