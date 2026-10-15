// src/context/ChatContext.js
import { createContext, useState, useEffect } from "react";

export const ChatContext = createContext();

const NODE_BASE = "http://localhost:5000";
const PY_BACKEND = "http://localhost:8000";

const makeId = () => `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

/* Save message to Node ---------------------------------------- */
const saveMessageToNode = async (payload) => {
  try {
    const res = await fetch(`${NODE_BASE}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return await res.json();
  } catch (err) {
    console.error("saveMessageToNode error:", err);
    return null;
  }
};

/* ------------------------------------------------------------- */

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [pdfList, setPdfList] = useState([]);
  const [activePdf, setActivePdf] = useState("");

  /* ------------------ Load Chats From Node ------------------ */
  const loadChats = async () => {
    try {
      const res = await fetch(`${NODE_BASE}/api/chat`);
      const data = await res.json();

      const cleaned = data.map((c) => ({
        id: c._id,
        title: c.title,
      }));

      setChats(cleaned);

      if (!activeChatId && cleaned.length > 0) {
        setActiveChatId(cleaned[0].id);
      }
    } catch (err) {
      console.error("loadChats error:", err);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  /* ------------------ Load Messages For Chat ------------------ */
  const loadMessagesForChat = async (chatId) => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    try {
      const res = await fetch(`${NODE_BASE}/api/chat/${chatId}/messages`);
      const data = await res.json();

      const formatted = data.map((m) => ({
        id: m._id,
        sender: m.sender === "bot" ? "bot" : "user",
        text: m.text,
        timestamp: m.timestamp,
        pdfName: m.pdfName || "",
      }));

      setMessages(formatted);
    } catch (err) {
      console.error("loadMessagesForChat error:", err);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (activeChatId) loadMessagesForChat(activeChatId);
  }, [activeChatId]);

  /* ------------------ Create New Chat ------------------ */
  const newChat = async (title) => {
    try {
      const res = await fetch(`${NODE_BASE}/api/chat/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || `Chat ${chats.length + 1}` }),
      });

      const c = await res.json();

      const cleaned = {
        id: c._id,
        title: c.title,
      };

      setChats((prev) => [cleaned, ...prev]);
      setActiveChatId(cleaned.id);
      setMessages([]);

      return cleaned;
    } catch (err) {
      console.error("newChat error:", err);
    }
  };

  /* ------------------ Rename Chat ------------------ */
  const renameChat = async (chatId, newTitle) => {
    try {
      const res = await fetch(`${NODE_BASE}/api/chat/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      const updated = await res.json();

      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: updated.title } : c))
      );

      return updated;
    } catch (err) {
      console.error("renameChat error:", err);
    }
  };

  /* ------------------ Upload PDF ------------------ */
  const uploadPdf = async (file) => {
    const apiKey = localStorage.getItem("api_key");
    if (!apiKey) return alert("Add Gemini API key first");

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);

    try {
      const res = await fetch(`${PY_BACKEND}/upload-pdf`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (data.error) return alert(data.error);

      setActivePdf(file.name);
      await loadPdfList();

      // Insert into chat
      const userMsg = {
        id: makeId(),
        sender: "user",
        text: `Uploaded PDF: ${file.name}`,
        timestamp: Date.now(),
      };
      const botMsg = {
        id: makeId(),
        sender: "bot",
        text: `📄 "${file.name}" indexed successfully.`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);

      if (activeChatId) {
        await saveMessageToNode({ 
          chatId: activeChatId,
          sender: "user",
          text: userMsg.text,
          timestamp: userMsg.timestamp,
          pdfName: file.name
        });

        await saveMessageToNode({ 
          chatId: activeChatId,
          sender: "bot",
          text: botMsg.text,
          timestamp: botMsg.timestamp,
          pdfName: file.name
        });
      }
    } catch (err) {
      console.error("uploadPdf error:", err);
    }
  };

  /* ------------------ Load PDF List ------------------ */
  const loadPdfList = async () => {
    try {
      const res = await fetch(`${PY_BACKEND}/list-pdfs`);
      const data = await res.json();
      setPdfList(data.pdfs || []);
    } catch (err) {
      console.error("loadPdfList error:", err);
    }
  };

  /* ------------------ Delete PDF ------------------ */
  const deletePdf = async (fileName) => {
    if (!confirm(`Delete PDF '${fileName}'?`)) return;

    try {
      const res = await fetch(`${PY_BACKEND}/delete-pdf/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
      await res.json();

      if (activePdf === fileName) {
        setActivePdf("");
        setMessages([]);
      }

      await loadPdfList();
    } catch (err) {
      console.error("deletePdf error:", err);
    }
  };

  /* ------------------ Send Message ------------------ */
  const sendMessage = async ({ text, file }) => {
    const apiKey = localStorage.getItem("api_key");
    if (!apiKey) return alert("Add API key");

    if (file) return await uploadPdf(file);

    let chatId = activeChatId;
    if (!chatId) {
      const newC = await newChat();
      chatId = newC.id;
    }

    const userMsg = {
      id: makeId(),
      sender: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((p) => [...p, userMsg]);

    saveMessageToNode({
      chatId,
      sender: "user",
      text,
      timestamp: userMsg.timestamp,
      pdfName: activePdf || "",
    });

    const botId = makeId();
    const botPlaceholder = {
      id: botId,
      sender: "bot",
      text: "",
      timestamp: Date.now(),
    };

    setMessages((p) => [...p, botPlaceholder]);

    try {
      const form = new FormData();
      form.append("question", text);
      form.append("api_key", apiKey);
      form.append("pdf_name", activePdf || "");

      const res = await fetch(`${PY_BACKEND}/ask-stream`, {
        method: "POST",
        body: form,
      });

      if (!res.body) {
        const fallback = await res.text();
        setMessages((p) =>
          p.map((m) => (m.id === botId ? { ...m, text: fallback } : m))
        );
        return;
      }

      /* ---------- DEBOUNCED STREAMING ---------- */
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let fullText = "";
      let temp = "";
      let updating = false;

      const flush = () => {
        setMessages((p) =>
          p.map((m) => (m.id === botId ? { ...m, text: fullText } : m))
        );
        updating = false;
        temp = "";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        fullText += chunk;
        temp += chunk;

        if (!updating) {
          updating = true;
          setTimeout(flush, 100);
        }
      }

      saveMessageToNode({
        chatId,
        sender: "bot",
        text: fullText,
        timestamp: Date.now(),
        pdfName: activePdf || "",
      });
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages((p) =>
        p.map((m) =>
          m.id === botId ? { ...m, text: `Error: ${err.message}` } : m
        )
      );
    }
  };

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
