export default function Search({ onSearch }: { onSearch: (query: string) => void }) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-8">
        <input
          type="search"
          placeholder="Search resources..."
          className="search-input"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    )
  }