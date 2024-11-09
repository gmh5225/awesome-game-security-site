import { useState, useEffect } from "react";

interface SearchProps {
  onSearch: (query: string, isTagSearch: boolean) => void;
  initialValue?: string;
  onEnter?: (query: string, isTagSearch: boolean) => void;
}

export default function Search({
  onSearch,
  onEnter,
  initialValue = "",
}: SearchProps) {
  const [searchValue, setSearchValue] = useState(initialValue);
  const [isTagSearch, setIsTagSearch] = useState(false);

  useEffect(() => {
    setSearchValue(initialValue);
  }, [initialValue]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch(value, isTagSearch);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onEnter?.(searchValue, isTagSearch);
    }
  };

  useEffect(() => {
    handleSearch(searchValue);
  }, [isTagSearch]);

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="search"
            placeholder={isTagSearch ? "Search by tag..." : "Search resources..."}
            className="search-input"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <button
          onClick={() => setIsTagSearch(!isTagSearch)}
          className={`search-mode-button ${isTagSearch ? 'active' : ''}`}
          title={isTagSearch ? "Switch to normal search" : "Switch to tag search"}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span className="ml-1">Tag</span>
        </button>
      </div>
    </div>
  );
}
