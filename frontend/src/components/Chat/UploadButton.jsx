import React from "react";

const UploadButton = ({ onFileSelect }) => {
  const handleChange = (e) => {
    if (e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <label className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-700">
      <input type="file" className="hidden" onChange={handleChange} />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-gray-700 dark:text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </label>
  );
};

export default UploadButton;
