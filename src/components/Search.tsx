import { useState, useEffect, useCallback, useMemo } from "react";

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
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setSearchValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md"
        );
        const content = await res.text();
        const lines = content.split("\n");
        
        const tags = new Set<string>();

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith("## ")) {
            const section = trimmedLine.slice(2).trim();
            if (section !== "Contents" && section !== "How to contribute?") {
              tags.add(section);
            }
          } else if (trimmedLine.startsWith("> ")) {
            const subSection = trimmedLine.slice(2).trim();
            if (subSection) {
              tags.add(subSection);
            }
          }
        }

        setAllTags(Array.from(tags).sort());
      } catch (error) {
        console.error("Error fetching tags:", error);
        setAllTags([]);
      }
    };

    void fetchTags();
  }, []);

  const filteredTags = useMemo(() => {
    if (!isTagSearch || !searchValue) return allTags;
    const searchLower = searchValue.toLowerCase();
    return allTags.filter(tag => 
      tag.toLowerCase().includes(searchLower)
    );
  }, [searchValue, isTagSearch, allTags]);

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    onSearch(value, isTagSearch);
    setShowDropdown(true);
  }, [isTagSearch, onSearch]);

  const handleTagSelect = useCallback((tag: string) => {
    setSearchValue(tag);
    onSearch(tag, isTagSearch);
    setShowDropdown(false);
  }, [isTagSearch, onSearch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onEnter?.(searchValue, isTagSearch);
      setShowDropdown(false);
    }
  }, [onEnter, searchValue, isTagSearch]);

  const handleTagModeChange = useCallback(() => {
    setIsTagSearch(prev => !prev);
    onSearch(searchValue, !isTagSearch);
    setShowDropdown(true);
  }, [isTagSearch, searchValue, onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 search-container">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="search"
            placeholder={isTagSearch ? "Search by tag..." : "Search resources..."}
            className="search-input"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => isTagSearch && setShowDropdown(true)}
          />
          
          {isTagSearch && showDropdown && filteredTags.length > 0 && (
            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-[#252526] border border-[#3e3e42] rounded-md shadow-lg">
              {filteredTags.map((tag) => (
                <div
                  key={tag}
                  className="px-4 py-2 hover:bg-[#2d2d2d] cursor-pointer text-[#d4d4d4]"
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleTagModeChange}
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
