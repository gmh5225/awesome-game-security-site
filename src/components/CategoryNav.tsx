export default function CategoryNav({ categories, onSelect, selectedCategory }: { 
  categories: string[], 
  selectedCategory: string,
  onSelect: (category: string) => void 
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-8 justify-center">
      <button
        onClick={() => onSelect('')}
        className={`px-4 py-2 rounded-full transition-colors ${
          selectedCategory === '' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
        }`}
      >
        All
      </button>
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`px-4 py-2 rounded-full transition-colors ${
            selectedCategory === category 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  )
} 