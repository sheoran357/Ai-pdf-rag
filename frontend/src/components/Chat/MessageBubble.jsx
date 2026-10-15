const MessageBubble = ({ sender, text }) => {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-2 sm:px-4`}>
      <div
        className={`max-w-[90%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md sm:max-w-[85%] ${
          isUser
            ? "rounded-br-none bg-black text-white dark:bg-white dark:text-black"
            : "rounded-bl-none border border-gray-200 bg-white text-black dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        }`}
      >
        {text ? (
          <p className="whitespace-pre-wrap break-words">{text}</p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400" aria-label="Generating response">
            Thinking…
          </p>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
