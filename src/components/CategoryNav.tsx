import { useEffect, useState } from 'react'

interface Category {
  name: string
  subCategories: string[]
}

interface CategoryNavProps {
  onSelectCategory: (category: string) => void
  selectedCategory?: string
  isVisible: boolean
  onToggle: () => void
}

export default function CategoryNav({ onSelectCategory, selectedCategory, isVisible, onToggle }: CategoryNavProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchCategories = async () => {
      const res = await fetch('https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md')
      const content = await res.text()
      const lines = content.split('\n')
      
      let isInContents = false
      const categoriesMap = new Map<string, string[]>()

      // First pass: collect main categories from Contents section
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        if (trimmedLine === '## Contents') {
          isInContents = true
          continue
        } else if (trimmedLine.startsWith('## ') && isInContents) {
          isInContents = false
          break
        }

        if (isInContents && trimmedLine.startsWith('- [')) {
          const match = trimmedLine.match(/- \[(.*?)\]/)
          if (match) {
            const category = match[1]
            if (!categoriesMap.has(category)) {
              categoriesMap.set(category, [])
            }
          }
        }
      }

      // Second pass: collect subcategories
      let currentMainCategory = ''
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        if (trimmedLine.startsWith('## ')) {
          const section = trimmedLine.slice(2).trim()
          if (section !== 'Contents' && section !== 'How to contribute?') {
            currentMainCategory = section
          }
        } else if (trimmedLine.startsWith('> ') && currentMainCategory && categoriesMap.has(currentMainCategory)) {
          const subCategory = trimmedLine.slice(2).trim()
          const subCategories = categoriesMap.get(currentMainCategory) || []
          if (!subCategories.includes(subCategory)) {
            subCategories.push(subCategory)
            categoriesMap.set(currentMainCategory, subCategories)
          }
        }
      }

      const categoriesArray = Array.from(categoriesMap.entries())
        .map(([name, subCategories]) => ({
          name,
          subCategories
        }))

      setCategories(categoriesArray)
      
      // Initialize expanded state
      const initialExpanded = categoriesArray.reduce((acc, category) => {
        acc[category.name] = false // Default to collapsed
        return acc
      }, {} as Record<string, boolean>)
      setExpanded(initialExpanded)
    }

    fetchCategories()
  }, [])

  const toggleCategory = (categoryName: string) => {
    setExpanded(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }))
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`
          fixed right-4 top-4 z-50 p-2 rounded
          bg-[#2d2d2d] hover:bg-[#3d3d3d]
          transition-all duration-200 ease-in-out
          ${isVisible ? 'right-[288px]' : 'right-4'}
        `}
        aria-label="Toggle categories"
      >
        {isVisible ? '→' : '←'}
      </button>

      {/* Navigation panel */}
      <nav className={`
        w-72 h-screen overflow-y-auto fixed right-0 top-0 p-6 
        bg-[#1e1e1e] border-l border-[#2d2d2d]
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <h2 className="text-xl font-semibold mb-6 text-[#d4d4d4] tracking-wide">Categories</h2>
        <ul className="space-y-1">
          {categories.map(category => (
            <li key={category.name} className="mb-2">
              {/* Category header */}
              <div 
                className={`
                  flex items-center gap-2 rounded px-2 py-1.5
                  ${selectedCategory === category.name 
                    ? 'bg-[#2d2d2d] text-[#569cd6]' 
                    : 'text-[#d4d4d4] hover:bg-[#252525]'
                  }
                  transition-colors duration-150 ease-in-out cursor-pointer
                  text-[15px] font-medium
                `}
                onClick={() => {
                  if (category.subCategories.length > 0) {
                    toggleCategory(category.name)
                  }
                  onSelectCategory(category.name)
                }}
              >
                <span className="inline-block w-4 text-xs opacity-70">
                  {category.subCategories.length > 0 && (
                    expanded[category.name] ? '▼' : '▶'
                  )}
                </span>
                <span className="flex-1">
                  {category.name}
                </span>
              </div>
              {/* Subcategories */}
              {expanded[category.name] && category.subCategories.length > 0 && (
                <ul className="mt-1 ml-4 border-l border-[#2d2d2d] pl-4">
                  {category.subCategories.map(subCategory => (
                    <li 
                      key={subCategory}
                      onClick={() => onSelectCategory(subCategory)}
                      className={`
                        py-1.5 px-2 rounded text-[14px]
                        ${selectedCategory === subCategory 
                          ? 'text-[#569cd6] bg-[#2d2d2d]' 
                          : 'text-[#a7a7a7] hover:text-[#d4d4d4] hover:bg-[#252525]'
                        }
                        transition-colors duration-150 ease-in-out cursor-pointer
                      `}
                    >
                      {subCategory}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
} 