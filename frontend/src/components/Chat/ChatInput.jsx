import { useContext, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import UploadButton from "./UploadButton";

const ChatInput = () => {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const { sendMessage } = useContext(ChatContext);

  const handleSend = async () => {
    if (isSending || (!input.trim() && !file)) return;

    setIsSending(true);
    try {
      const result = await sendMessage({ text: input, file });
      if (result === false || result === null) return;
      setInput("");
      setFile(null);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 flex justify-center bg-white/80 pb-5 pt-4 backdrop-blur-xl dark:bg-black/75">
      <div className="w-full max-w-3xl px-3 sm:px-4">
        {file && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <span className="max-w-[70%] truncate text-sm font-medium text-gray-800 dark:text-gray-100">
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove selected PDF"
              className="ml-auto text-red-500 hover:opacity-80"
            >
              ✕
            </button>
          </div>
        )}

        <form
          className="flex items-center rounded-full border border-gray-300 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-lg dark:border-neutral-700 dark:bg-neutral-900/90 sm:px-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <UploadButton onFileSelect={setFile} disabled={isSending} />

          <input
            aria-label="Message input"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-800 outline-none dark:text-gray-100"
            placeholder="Ask a question about your PDF…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isSending}
          />

          <button
            type="submit"
            aria-label="Send message"
            disabled={isSending || (!input.trim() && !file)}
            className={`ml-2 flex items-center justify-center rounded-full px-3 py-2 text-sm transition ${
              isSending || (!input.trim() && !file)
                ? "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-neutral-700"
                : "bg-black text-white shadow-md dark:bg-white dark:text-black"
            }`}
          >
            {isSending ? "…" : "➤"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;
