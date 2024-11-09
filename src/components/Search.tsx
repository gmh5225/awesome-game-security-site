import { useState } from 'react'

export default function Search({ onSearch }: { onSearch: (query: string) => void }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <input
        type="search"
        placeholder="Search ..."
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  )
} 