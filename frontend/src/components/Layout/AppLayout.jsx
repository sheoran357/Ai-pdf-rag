import React, { useContext, useState } from "react";
import Header from "./Header";
import ChatWindow from "../Chat/ChatWindow";
import ChatInput from "../Chat/ChatInput";
import SettingsModal from "../Modals/SettingModal";
import Sidebar from "../Sidebar/Sidebar";
import { ThemeContext } from "../../context/ThemeContext";

const AppLayout = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [chats, setChats] = useState([{ title: "Chat 1" }, { title: "Project Discussion" }]);
  const [activeChat, setActiveChat] = useState(0);

  const newChat = () => {
    setChats([{ title: `Chat ${chats.length + 1}` }, ...chats]);
    setActiveChat(0);
  };

  return (
    <div className={`${theme === "light" ? "bg-gray-100" : "bg-gray-900"} h-screen w-screen flex`}>
      <Sidebar chats={chats} onNewChat={newChat} onSelectChat={(id) => setActiveChat(id)} />

     <div className="flex flex-col flex-1 relative">
  <Header openSettings={() => setIsSettingsOpen(true)} />

  <div className="flex-1 overflow-y-auto pb-28">
    <ChatWindow />
  </div>

  <ChatInput />
</div>

      {isSettingsOpen && (
        <SettingsModal closeSettings={() => setIsSettingsOpen(false)} currentTheme={theme} toggleTheme={toggleTheme} />
      )}
    </div>
  );
};

export default AppLayout;
