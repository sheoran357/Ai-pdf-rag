import { createContext, useCallback, useEffect, useRef, useState } from "react";

// The context object is intentionally exported alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const ChatContext = createContext(null);

const NODE_BASE = (import.meta.env.VITE_NODE_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const PY_BACKEND = (import.meta.env.VITE_PYTHON_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const makeId = () => `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.detail || data.error || data.message)) ||
      (typeof data === "string" && data) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function saveMessageToNode(payload) {
  const response = await fetch(`${NODE_BASE}/api/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readResponse(response);
}

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pdfList, setPdfList] = useState([]);
  const [activePdf, setActivePdf] = useState("");
  const skipNextMessagesLoad = useRef(null);

  const loadChats = useCallback(async () => {
    try {
      const response = await fetch(`${NODE_BASE}/api/chat`);
      const data = await readResponse(response);
      if (!Array.isArray(data)) throw new Error("The chat API returned an invalid response.");

      const cleaned = data.map((chat) => ({
        id: chat._id,
        title: chat.title,
      }));
      setChats(cleaned);
      setActiveChatId((currentId) =>
        currentId && cleaned.some((chat) => chat.id === currentId)
          ? currentId
          : cleaned[0]?.id || null
      );
    } catch (error) {
      console.error("Could not load chats:", error);
    }
  }, []);

  const loadPdfList = useCallback(async () => {
    try {
      const response = await fetch(`${PY_BACKEND}/list-pdfs`);
      const data = await readResponse(response);
      setPdfList(Array.isArray(data.pdfs) ? data.pdfs : []);
    } catch (error) {
      console.error("Could not load indexed PDFs:", error);
    }
  }, []);

  const loadMessagesForChat = useCallback(async (chatId, signal) => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    try {
      const response = await fetch(`${NODE_BASE}/api/chat/${chatId}/messages`, { signal });
      const data = await readResponse(response);
      if (!Array.isArray(data)) throw new Error("The chat API returned an invalid message list.");

      setMessages(
        data.map((message) => ({
          id: message._id,
          sender: message.sender === "bot" ? "bot" : "user",
          text: message.text,
          timestamp: message.timestamp,
          pdfName: message.pdfName || "",
        }))
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Could not load chat messages:", error);
        setMessages([]);
      }
    }
  }, []);

  useEffect(() => {
    void loadChats();
    void loadPdfList();
  }, [loadChats, loadPdfList]);

  useEffect(() => {
    if (activeChatId && skipNextMessagesLoad.current === activeChatId) {
      skipNextMessagesLoad.current = null;
      return undefined;
    }

    const controller = new AbortController();
    void loadMessagesForChat(activeChatId, controller.signal);
    return () => controller.abort();
  }, [activeChatId, loadMessagesForChat]);

  const newChat = useCallback(async (title) => {
    try {
      const response = await fetch(`${NODE_BASE}/api/chat/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title?.trim() || `Chat ${chats.length + 1}` }),
      });
      const chat = await readResponse(response);
      if (!chat?._id) throw new Error("The chat API did not return a chat ID.");

      const cleaned = { id: chat._id, title: chat.title };
      setChats((previous) => [cleaned, ...previous.filter((item) => item.id !== cleaned.id)]);
      skipNextMessagesLoad.current = cleaned.id;
      setActiveChatId(cleaned.id);
      setMessages([]);
      return cleaned;
    } catch (error) {
      console.error("Could not create chat:", error);
      alert(`Could not create a chat. Check that the Node backend and MongoDB are running.\n\n${error.message}`);
      return null;
    }
  }, [chats.length]);

  const renameChat = useCallback(async (chatId, newTitle) => {
    const title = newTitle?.trim();
    if (!title) return;

    try {
      const response = await fetch(`${NODE_BASE}/api/chat/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const updated = await readResponse(response);
      setChats((previous) =>
        previous.map((chat) => (chat.id === chatId ? { ...chat, title: updated.title } : chat))
      );
      return updated;
    } catch (error) {
      console.error("Could not rename chat:", error);
      alert(`Could not rename the chat: ${error.message}`);
      return null;
    }
  }, []);

  const uploadPdf = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a PDF file.");
      return null;
    }

    const apiKey = localStorage.getItem("api_key")?.trim();
    if (!apiKey) {
      alert("Add your Gemini API key in Settings first.");
      return null;
    }

    let chatId = activeChatId;
    if (!chatId) {
      const created = await newChat();
      if (!created) return;
      chatId = created.id;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);

    try {
      const response = await fetch(`${PY_BACKEND}/upload-pdf`, {
        method: "POST",
        body: form,
      });
      const data = await readResponse(response);

      setActivePdf(file.name);
      await loadPdfList();

      const userMessage = {
        id: makeId(),
        sender: "user",
        text: `Uploaded PDF: ${file.name}`,
        timestamp: Date.now(),
        pdfName: file.name,
      };
      const botMessage = {
        id: makeId(),
        sender: "bot",
        text: `📄 "${file.name}" indexed successfully.`,
        timestamp: Date.now(),
        pdfName: file.name,
      };
      setMessages((previous) => [...previous, userMessage, botMessage]);

      await Promise.all([
        saveMessageToNode({
          chatId,
          sender: "user",
          text: userMessage.text,
          timestamp: userMessage.timestamp,
          pdfName: file.name,
        }),
        saveMessageToNode({
          chatId,
          sender: "bot",
          text: botMessage.text,
          timestamp: botMessage.timestamp,
          pdfName: file.name,
        }),
      ]).catch((error) => console.error("PDF indexed, but chat history could not be saved:", error));

      return data;
    } catch (error) {
      console.error("Could not upload PDF:", error);
      alert(`Could not index the PDF: ${error.message}`);
      return null;
    }
  }, [activeChatId, loadPdfList, newChat]);

  const deletePdf = useCallback(async (fileName) => {
    if (!window.confirm(`Delete PDF '${fileName}'?`)) return;

    try {
      const response = await fetch(
        `${PY_BACKEND}/delete-pdf/${encodeURIComponent(fileName)}`,
        { method: "DELETE" }
      );
      await readResponse(response);

      if (activePdf === fileName) setActivePdf("");
      await loadPdfList();
    } catch (error) {
      console.error("Could not delete PDF:", error);
      alert(`Could not delete the PDF: ${error.message}`);
    }
  }, [activePdf, loadPdfList]);

  const sendMessage = useCallback(async ({ text, file }) => {
    if (file) return uploadPdf(file);
    const question = text?.trim();
    if (!question) return;

    const apiKey = localStorage.getItem("api_key")?.trim();
    if (!apiKey) {
      alert("Add your Gemini API key in Settings first.");
      return false;
    }

    let chatId = activeChatId;
    if (!chatId) {
      const created = await newChat();
      if (!created) return false;
      chatId = created.id;
    }

    const userMessage = {
      id: makeId(),
      sender: "user",
      text: question,
      timestamp: Date.now(),
      pdfName: activePdf || "",
    };
    const botId = makeId();
    const botMessage = {
      id: botId,
      sender: "bot",
      text: "",
      timestamp: Date.now(),
      pdfName: activePdf || "",
    };

    setMessages((previous) => [...previous, userMessage, botMessage]);
    void saveMessageToNode({
      chatId,
      sender: "user",
      text: userMessage.text,
      timestamp: userMessage.timestamp,
      pdfName: userMessage.pdfName,
    }).catch((error) => console.error("Could not save user message:", error));

    try {
      const form = new FormData();
      form.append("question", question);
      form.append("api_key", apiKey);
      form.append("pdf_name", activePdf || "");

      const response = await fetch(`${PY_BACKEND}/ask-stream`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const data = await readResponse(response);
        throw new Error(typeof data === "string" ? data : "The RAG backend rejected the question.");
      }

      if (!response.body) {
        const fallback = await response.text();
        setMessages((previous) =>
          previous.map((message) => (message.id === botId ? { ...message, text: fallback } : message))
        );
        await saveMessageToNode({
          chatId,
          sender: "bot",
          text: fallback,
          timestamp: Date.now(),
          pdfName: activePdf || "",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((previous) =>
          previous.map((message) => (message.id === botId ? { ...message, text: fullText } : message))
        );
      }

      fullText += decoder.decode();
      const answerText = fullText || "No response was returned.";
      setMessages((previous) =>
        previous.map((message) => (message.id === botId ? { ...message, text: answerText } : message))
      );

      await saveMessageToNode({
        chatId,
        sender: "bot",
        text: answerText,
        timestamp: Date.now(),
        pdfName: activePdf || "",
      });
      return true;
    } catch (error) {
      console.error("Could not get an answer:", error);
      const errorText = `Error: ${error.message}`;
      setMessages((previous) =>
        previous.map((message) => (message.id === botId ? { ...message, text: errorText } : message))
      );
      return false;
    }
  }, [activeChatId, activePdf, newChat, uploadPdf]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        messages,
        pdfList,
        activePdf,
        setActivePdf,
        sendMessage,
        newChat,
        selectChat: setActiveChatId,
        renameChat,
        loadPdfList,
        deletePdf,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
