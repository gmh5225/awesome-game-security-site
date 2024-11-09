import { useState, useEffect } from 'react'

interface SearchProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  onEnter?: (query: string) => void;
}

export default function Search({ onSearch, onEnter, initialValue = '' }: SearchProps) {
    const [searchValue, setSearchValue] = useState(initialValue)

    useEffect(() => {
        setSearchValue(initialValue)
    }, [initialValue])

    const handleSearch = (value: string) => {
        setSearchValue(value)
        onSearch(value)
    }

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onEnter?.(searchValue)
        }
    }

    return (
      <div className="w-full max-w-2xl mx-auto mb-8">
        <input
          type="search"
          placeholder="Search resources..."
          className="search-input"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
    )
}