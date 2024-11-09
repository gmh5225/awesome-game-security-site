import { useState, useEffect } from 'react'

interface SearchProps {
  onSearch: (query: string) => void;
  initialValue?: string; // Add prop for initial/updated value from parent
}

export default function Search({ onSearch, initialValue = '' }: SearchProps) {
    const [searchValue, setSearchValue] = useState(initialValue)

    // Listen to initialValue changes from parent
    useEffect(() => {
        setSearchValue(initialValue)
    }, [initialValue])

    // Handle input changes and trigger search
    const handleSearch = (value: string) => {
        setSearchValue(value)
        onSearch(value)
    }

    return (
      <div className="w-full max-w-2xl mx-auto mb-8">
        <input
          type="search"
          placeholder="Search resources..."
          className="search-input"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
    )
}