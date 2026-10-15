import React, { useContext, useEffect, useRef } from "react";
import { ChatContext } from "../../context/ChatContext";
import MessageBubble from "./MessageBubble";

const ChatWindow = () => {
  const { messages } = useContext(ChatContext);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
  ref={scrollRef}
  className="
    flex flex-col
    gap-4
    px-6
    w-full
    h-full
    overflow-y-auto
    pt-6 pb-32
  "
>
      {messages.map((msg, idx) => (
        <MessageBubble key={idx} {...msg} />
      ))}
    </div>
  );
};

export default ChatWindow;
