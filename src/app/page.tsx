'use client'

import { useState, useEffect } from 'react'
import Search from '@/components/Search'
import CategoryNav from '@/components/CategoryNav'

interface Resource {
  title: string
  description: string
  url: string
  sections: string[]
  searchableContent?: string
  isSubSection?: boolean
  parentSection?: string
}

const ITEMS_PER_PAGE = 10

interface SearchContext {
  query: string;
  parentCategory?: string;
  isNavigationSearch?: boolean;
  isFromNavigation?: boolean;
}

type SortedResource = [string, Resource[]];

export default function Home() {
  const [searchContext, setSearchContext] = useState<SearchContext>({ 
    query: '',
    isFromNavigation: false
  })
  const [resources, setResources] = useState<Resource[]>([])
  const [page, setPage] = useState(1)
  const [isNavVisible, setIsNavVisible] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Add a function to fetch and parse data
  const fetchData = async () => {
    const res = await fetch('https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md')
    const content = await res.text()
    
    const resources: Resource[] = []
    const lines = content.split('\n')
    let currentSection = ''
    let currentSubSection = ''
    let isInContents = false
    const urlMap = new Map<string, Resource>()

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine === '## Contents') {
        isInContents = true
        continue
      } else if (trimmedLine.startsWith('## ')) {
        isInContents = false
      }

      if (isInContents && trimmedLine.startsWith('- [')) {
        const sectionMatch = trimmedLine.match(/- \[(.*?)\]/)
        if (sectionMatch) {
          // Collect sections if needed
        }
      }
    }

    // Second pass: collect resources
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.startsWith('## ')) {
        const section = line.slice(2).trim()
        if (section === 'How to contribute?' || section === 'Contents') {
          currentSection = ''
          currentSubSection = ''
          continue
        }
        currentSection = section
        currentSubSection = ''
        continue
      }

      if (line.startsWith('> ')) {
        currentSubSection = line.slice(2).trim()
        continue
      }

      if ((currentSection || currentSubSection) && line.startsWith('- ')) {
        let title = ''
        let description = ''
        let url = ''
        let extraInfo = ''

        const fullMatch = line.match(/- \[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)(\s*\[([^\]]+)\])?/)
        if (fullMatch) {
          title = fullMatch[1]
          url = fullMatch[2]
          extraInfo = fullMatch[4] || ''
          description = extraInfo || title
        } else {
          const directMatch = line.match(/- (https?:\/\/[^\s\]]+)(\s*\[([^\]]+)\])?/)
          if (directMatch) {
            url = directMatch[1]
            extraInfo = directMatch[3] || ''
            const urlParts = url.split('/')
            title = urlParts[urlParts.length - 1]
            description = extraInfo || title
          }
        }

        if (url) {
          const section = currentSubSection || currentSection
          const searchableContent = [
            title, 
            description, 
            url, 
            extraInfo, 
            currentSection,
            currentSubSection
          ].filter(Boolean).join(' ')

          if (urlMap.has(url)) {
            const existingResource = urlMap.get(url)!
            if (!existingResource.sections.includes(section)) {
              existingResource.sections.push(section)
              existingResource.searchableContent = [
                existingResource.searchableContent,
                section
              ].filter(Boolean).join(' ')
            }
          } else {
            const resource = {
              title,
              description: description || extraInfo || title,
              url,
              sections: [section],
              searchableContent,
              isSubSection: !!currentSubSection,
              parentSection: currentSection
            }
            resources.push(resource)
            urlMap.set(url, resource)
          }
        }
      }
    }
    
    setResources(Array.from(urlMap.values()))
  }

  useEffect(() => {
    fetchData() // Initial fetch

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const filteredResources = resources.filter(resource => {
    if (!searchContext.query) return true
    
    const searchLower = searchContext.query.toLowerCase()
    
    // Only apply parent category filter for navigation searches
    if (searchContext.isFromNavigation && searchContext.parentCategory) {
      if (resource.parentSection !== searchContext.parentCategory) {
        return false
      }
      return resource.sections.some(section => 
        section.toLowerCase() === searchLower
      )
    }
    
    // For global searches (search box), show all matches regardless of parent category
    if (resource.sections.some(section => 
      section.toLowerCase() === searchLower ||
      resource.parentSection?.toLowerCase() === searchLower
    )) {
      return true
    }

    const contentToSearch = (resource.searchableContent || '').toLowerCase()
    const searchTerms = searchLower.split(/\s+/).filter(Boolean)
    return searchTerms.every(term => contentToSearch.includes(term))
  })

  const uniqueResources = filteredResources.reduce((acc, resource) => {
    if (!acc.some(r => r.url === resource.url)) {
      acc.push(resource)
    }
    return acc
  }, [] as Resource[])

  const paginatedResources = uniqueResources.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = uniqueResources.length > page * ITEMS_PER_PAGE

  // Handle global search from search box
  const handleGlobalSearch = (query: string): void => {
    setSearchContext({ 
      query,
      parentCategory: undefined,
      isNavigationSearch: false,
      isFromNavigation: false
    })
    setPage(1)
    setHasSearched(!!query)
  }

  // Handle category navigation search
  const handleNavigationSearch = (category: string, parentCategory?: string): void => {
    setSearchContext({ 
      query: category,
      parentCategory,
      isNavigationSearch: true,
      isFromNavigation: true
    })
    setPage(1)
    setHasSearched(true)
  }

  // Sort resources by section name alphabetically
  const sortedResources: SortedResource[] = Object.entries(
    paginatedResources.reduce((acc, resource) => {
      const section = resource.parentSection || resource.sections[0]
      if (!acc[section]) {
        acc[section] = []
      }
      acc[section].push(resource)
      return acc
    }, {} as Record<string, Resource[]>)
  )
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([section, resources]): SortedResource => [
    section,
    resources.sort((a, b) => a.title.localeCompare(b.title))
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CategoryNav 
        onSelectCategory={handleNavigationSearch}
        selectedCategory={searchContext.query}
        isVisible={isNavVisible}
        onToggle={() => setIsNavVisible(!isNavVisible)}
      />
      
      <div className={`
        transition-all duration-300 ease-in-out
        ${isNavVisible ? 'pr-80' : 'pr-8'}
        p-8
      `}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-primary">
            Awesome Game Security Resources
          </h1>
          <a
            href="https://github.com/gmh5225/awesome-game-security"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#d4d4d4] hover:text-[#569cd6] transition-colors"
            title="View on GitHub"
          >
            <svg
              height="32"
              aria-hidden="true"
              viewBox="0 0 16 16"
              version="1.1"
              width="32"
              data-view-component="true"
              className="fill-current"
            >
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
            </svg>
          </a>
        </div>

        <Search 
          onSearch={handleGlobalSearch}
          onEnter={(query) => {
            setSearchContext({ 
              query,
              parentCategory: undefined,
              isNavigationSearch: false,
              isFromNavigation: false
            })
            setPage(1)
            setHasSearched(!!query)
          }}
          initialValue={searchContext.query}
        />

        <div className="max-w-6xl mx-auto">
          {!hasSearched || !searchContext.query ? (
            <div className="text-center text-secondary">
              Start searching or select a category to view resources
            </div>
          ) : uniqueResources.length === 0 ? (
            <div className="text-center text-secondary">
              No resources found
            </div>
          ) : (
            <>
              {sortedResources.map(([section, sectionResources]: SortedResource) => (
                <div key={section} className="mb-12">
                  <h2 className="section-title">
                    {section}
                  </h2>

                  {sectionResources.map((resource: Resource, index: number) => (
                    <div 
                      key={`${resource.url}-${index}`} 
                      className="resource-card mb-6 cursor-pointer"
                      onDoubleClick={() => {
                        window.open(resource.url, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-baseline">
                          <span className="label">Name:</span>
                          <span className="text-primary font-semibold flex-1">{resource.title}</span>
                        </div>
                        
                        {resource.description !== resource.title && (
                          <div className="flex items-baseline">
                            <span className="label">Desc:</span>
                            <span className="text-secondary flex-1">{resource.description}</span>
                          </div>
                        )}
                        
                        <div className="flex items-baseline">
                          <span className="label">URL:</span>
                          <span className="url-text flex-1">{resource.url}</span>
                        </div>
                        
                        <div className="flex items-baseline">
                          <span className="label">Tags:</span>
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-2">
                              {resource.sections.map(tag => (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation() // Prevent double click from triggering
                                    handleNavigationSearch(tag, resource.parentSection)
                                  }}
                                  className="tag"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end mt-4 pt-2 border-t border-card-border">
                          <a 
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="view-details"
                            onClick={(e) => e.stopPropagation()} // Prevent double click from triggering
                          >
                            View Details 
                            <span className="font-mono">→</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              
              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="load-more-button"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}

          <footer className="mt-16 pt-4 border-t border-[#2d2d2d] text-center">
            <div className="text-sm text-[#808080]">
              MIT License · Copyright (c) 2024 {" "}
              <a 
                href="https://x.com/gmhzxy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#569cd6] hover:text-[#4fc1ff] transition-colors"
              >
                gmh5225.eth
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}