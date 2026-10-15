// src/components/Sidebar/Sidebar.jsx
import React, { useContext, useState, useEffect } from "react";
import { ChatContext } from "../../context/ChatContext";

const Sidebar = () => {
  const {
    chats,
    activeChatId,
    selectChat,
    newChat,
    renameChat,
    pdfList,
    activePdf,
    setActivePdf,
    loadPdfList,
    deletePdf,
  } = useContext(ChatContext);

  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    loadPdfList();
  }, []);

  return (
    <aside
      className={`${isOpen ? "w-64" : "w-16"} transition-all duration-300 
      bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-700 
      h-full flex flex-col`}
    >
      {/* Top Row */}
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isOpen ? "M6 18L18 12L6 6" : "M18 6L6 12L18 18"}
            />
          </svg>
        </button>

        <button
          onClick={() => newChat()}
          className="px-2 py-1 rounded bg-black text-white dark:bg-white dark:text-black text-sm"
        >
          ➕ {isOpen && <span className="ml-1">New</span>}
        </button>
      </div>

      {/* CHAT LIST */}
      <div className="px-2 pt-2 pb-2 overflow-y-auto flex-1">
        {isOpen && <div className="text-xs text-gray-500 mb-2 px-1">Chats</div>}

        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group p-2 mb-2 rounded-md flex items-center justify-between cursor-pointer
              ${
                chat.id === activeChatId
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white dark:bg-neutral-800"
              }
              border border-gray-300 dark:border-neutral-700 text-sm`}
          >
            <div
              className="flex-1 truncate"
              onClick={() => selectChat(chat.id)}
              onDoubleClick={() => {
                const newName = prompt("Rename chat:", chat.title);
                if (newName && newName.trim()) renameChat(chat.id, newName.trim());
              }}
            >
              {isOpen ? chat.title : "💬"}
            </div>

            {isOpen && (
              <button
                className="opacity-0 group-hover:opacity-100 transition text-xs px-1 text-gray-500 hover:text-black dark:hover:text-white"
                onClick={() => {
                  const newName = prompt("Rename chat:", chat.title);
                  if (newName && newName.trim()) renameChat(chat.id, newName.trim());
                }}
              >
                ✏️
              </button>
            )}
          </div>
        ))}
      </div>

      {/* PDF LIST */}
      <div className="border-t border-gray-300 dark:border-neutral-700 px-2 pt-2 pb-4">
        {isOpen && <div className="text-xs text-gray-500 mb-2">Indexed PDFs</div>}

        {isOpen && pdfList.length === 0 && (
          <p className="text-sm text-gray-500">No PDFs indexed.</p>
        )}

        {pdfList.map((p) => (
          <div
            key={p.filename}
            onClick={() => setActivePdf(p.filename)}
            className={`flex items-center justify-between p-2 mb-2 rounded-md cursor-pointer
              ${
                activePdf === p.filename
                  ? "bg-gray-100 dark:bg-neutral-700"
                  : "bg-white dark:bg-neutral-800"
              }
              border border-gray-300 dark:border-neutral-700 text-sm`}
          >
            <div>
              <div className="truncate max-w-[150px]">{p.filename}</div>
              <div className="text-xs text-gray-500">Pages: {p.page_count}</div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePdf(p.filename);
              }}
              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900"
            >
              <svg
                className="w-4 h-4 text-red-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M6 7h12M10 11v6m4-6v6M9 7l1-3h4l1 3"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
