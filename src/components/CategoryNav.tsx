import { useEffect, useState } from "react";

interface Category {
  name: string;
  subCategories: string[];
}

interface CategoryNavProps {
  onSelectCategory: (category: string, parentCategory?: string) => void;
  selectedCategory?: string;
  isVisible: boolean;
  onToggle: () => void;
}

export default function CategoryNav({
  onSelectCategory,
  selectedCategory,
  isVisible,
  onToggle,
}: CategoryNavProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCategories = async () => {
      const res = await fetch(
        "https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md"
      );
      const content = await res.text();
      const lines = content.split("\n");

      let isInContents = false;
      const categoriesMap = new Map<string, string[]>();

      // First pass: collect main categories from Contents section
      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "## Contents") {
          isInContents = true;
          continue;
        } else if (trimmedLine.startsWith("## ") && isInContents) {
          isInContents = false;
          break;
        }

        if (isInContents && trimmedLine.startsWith("- [")) {
          const match = trimmedLine.match(/- \[(.*?)\]/);
          if (match) {
            const category = match[1];
            if (!categoriesMap.has(category)) {
              categoriesMap.set(category, []);
            }
          }
        }
      }

      // Second pass: collect subcategories
      let currentMainCategory = "";
      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("## ")) {
          const section = trimmedLine.slice(2).trim();
          if (section !== "Contents" && section !== "How to contribute?") {
            currentMainCategory = section;
          }
        } else if (
          trimmedLine.startsWith("> ") &&
          currentMainCategory &&
          categoriesMap.has(currentMainCategory)
        ) {
          const subCategory = trimmedLine.slice(2).trim();
          const subCategories = categoriesMap.get(currentMainCategory) || [];
          if (!subCategories.includes(subCategory)) {
            subCategories.push(subCategory);
            categoriesMap.set(currentMainCategory, subCategories);
          }
        }
      }

      // Sort categories and subcategories alphabetically
      const categoriesArray = Array.from(categoriesMap.entries())
        .map(([name, subCategories]) => ({
          name,
          subCategories: subCategories.sort((a, b) => a.localeCompare(b)), // Sort subcategories
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort main categories

      setCategories(categoriesArray);

      // Initialize expanded state
      const initialExpanded = categoriesArray.reduce((acc, category) => {
        acc[category.name] = false;
        return acc;
      }, {} as Record<string, boolean>);
      setExpanded(initialExpanded);
    };

    fetchCategories();
  }, []);

  const toggleCategory = (categoryName: string) => {
    setExpanded((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  return (
    <>
      <button
        onClick={onToggle}
        className={`
          fixed z-50 rounded
          bg-[#2d2d2d] hover:bg-[#3d3d3d]
          transition-all duration-200 ease-in-out
          flex items-center gap-2
          pointer-events-auto
          ${isVisible
            ? "right-[288px] p-2"
            : "right-4 px-3 py-2"
          }
        `}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        aria-label="Toggle categories"
      >
        {!isVisible && (
          <span className="text-sm text-[#d4d4d4]">Categories</span>
        )}
        <span className="text-[#808080]">{isVisible ? "→" : "←"}</span>
      </button>

      <nav
        className={`
          w-72 h-screen overflow-y-auto fixed right-0 top-0 p-6 
          bg-[#1e1e1e] border-l border-[#2d2d2d]
          transition-transform duration-300 ease-in-out
          ${isVisible ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <h2 className="text-xl font-semibold mb-6 text-[#d4d4d4] tracking-wide">
          Categories
        </h2>
        <ul className="space-y-1">
          {categories.map((category) => (
            <li key={category.name} className="mb-2">
              <div
                className={`
                  flex items-center gap-2 rounded px-1 py-1.5
                  ${selectedCategory === category.name
                    ? "bg-[#2d2d2d] text-[#569cd6]"
                    : "text-[#d4d4d4] hover:bg-[#252525]"
                  }
                  transition-colors duration-150 ease-in-out cursor-pointer
                  text-[15px] font-medium group
                `}
                onClick={() => {
                  if (category.subCategories.length > 0) {
                    toggleCategory(category.name);
                  }
                  onSelectCategory(category.name);
                }}
              >
                {category.subCategories.length > 0 && (
                  <div className="w-6 h-6 flex items-center justify-center -ml-1">
                    <svg
                      className={`
                        w-5 h-5
                        transform transition-transform duration-200
                        ${expanded[category.name] ? 'rotate-90' : ''}
                      `}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
                <span className="flex-1">
                  {category.name}
                </span>
              </div>
              <div
                className={`
                  overflow-hidden transition-all duration-200 ease-in-out
                  ${expanded[category.name] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
                `}
              >
                {category.subCategories.length > 0 && (
                  <ul className="mt-1 ml-4 border-l border-[#2d2d2d] pl-4">
                    {category.subCategories.map((subCategory) => (
                      <li
                        key={subCategory}
                        onClick={() => onSelectCategory(subCategory, category.name)}
                        className={`
                          py-1.5 px-2 rounded text-[14px]
                          ${selectedCategory === subCategory
                            ? "text-[#569cd6] bg-[#2d2d2d]"
                            : "text-[#a7a7a7] hover:text-[#d4d4d4] hover:bg-[#252525]"
                          }
                          transition-colors duration-150 ease-in-out cursor-pointer
                        `}
                      >
                        {subCategory}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
