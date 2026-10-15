import { useContext, useEffect, useRef } from "react";
import { ChatContext } from "../../context/ChatContext";
import MessageBubble from "./MessageBubble";

const ChatWindow = () => {
  const { messages, activeChatId } = useContext(ChatContext);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-2 pb-32 pt-6 sm:px-6"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 && (
        <div className="mx-auto mt-16 max-w-xl px-4 text-center text-gray-500 dark:text-gray-400">
          <h2 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-200">
            Ask your PDF a question
          </h2>
          <p>Upload a PDF using the plus button, then ask about its contents.</p>
          {!activeChatId && <p className="mt-2 text-sm">A chat will be created when you send your first message.</p>}
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} {...message} />
      ))}
    </div>
  );
};

export default ChatWindow;
