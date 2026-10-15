import { useContext, useState } from "react";
import Header from "./Header";
import ChatWindow from "../Chat/ChatWindow";
import ChatInput from "../Chat/ChatInput";
import SettingsModal from "../Modals/SettingModal";
import Sidebar from "../Sidebar/Sidebar";
import { ThemeContext } from "../../context/ThemeContext";

const AppLayout = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className={`${theme === "light" ? "bg-gray-100" : "bg-gray-900"} flex h-dvh w-full overflow-hidden`}>
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Header openSettings={() => setIsSettingsOpen(true)} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatWindow />
        </div>
        <ChatInput />
      </main>

      {isSettingsOpen && (
        <SettingsModal
          closeSettings={() => setIsSettingsOpen(false)}
          currentTheme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
};

export default AppLayout;
