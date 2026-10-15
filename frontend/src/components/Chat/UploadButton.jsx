const UploadButton = ({ onFileSelect, disabled = false }) => {
  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) onFileSelect(selectedFile);
    // Let users choose the same file again after removing it or deleting its index.
    event.target.value = "";
  };

  return (
    <label
      title="Upload a PDF"
      className={`flex h-8 w-8 items-center justify-center rounded-full ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700"
      }`}
    >
      <span className="sr-only">Upload a PDF</span>
      <input
        type="file"
        disabled={disabled}
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Upload a PDF"
        onChange={handleChange}
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 text-gray-700 dark:text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </label>
  );
};

export default UploadButton;
