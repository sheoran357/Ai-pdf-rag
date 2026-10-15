// src/components/Layout/Header.jsx

const Header = ({ openSettings }) => {
  return (
    <header className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-black dark:text-white select-none">AI PDF RAG</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">Ask PDFs • Stream answers</span>
        </div>

        <button
          onClick={openSettings}
          className="relative group p-2 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Open settings"
        >
          <svg className="w-5 h-5 text-black dark:text-white transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.36 2.36a1.724 1.724 0 00-2.56 1.06c-.42 1.75-2.92 1.75-3.35 0a1.724 1.724 0 00-2.57-1.06c-1.54.94-3.31-.82-2.37-2.36a1.724 1.724 0 00-1.06-2.57c-1.75-.43-1.75-2.92 0-3.35a1.724 1.724 0 001.06-2.57c-.94-1.54.83-3.31 2.37-2.37.99.61 2.29.07 2.57-1.06z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
