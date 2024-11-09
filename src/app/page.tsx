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
  isNavigationSearch?: boolean;  // Add flag to distinguish search types
}

export default function Home() {
  const [searchContext, setSearchContext] = useState<SearchContext>({ query: '' })
  const [resources, setResources] = useState<Resource[]>([])
  const [page, setPage] = useState(1)
  const [isNavVisible, setIsNavVisible] = useState(false)

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
    if (searchContext.isNavigationSearch && searchContext.parentCategory) {
      if (resource.parentSection !== searchContext.parentCategory) {
        return false
      }
      return resource.sections.some(section => 
        section.toLowerCase() === searchLower
      )
    }
    
    // For global searches (search box), use broader matching
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
  const handleGlobalSearch = (query: string) => {
    setSearchContext({ 
      query,
      isNavigationSearch: false 
    })
    setPage(1)
  }

  // Handle category navigation search
  const handleNavigationSearch = (category: string, parentCategory?: string) => {
    setSearchContext({ 
      query: category,
      parentCategory,
      isNavigationSearch: true 
    })
    setPage(1)
  }

  // Sort resources by section name alphabetically
  const sortedResources = Object.entries(
    paginatedResources.reduce((acc, resource) => {
      const section = resource.parentSection || resource.sections[0]
      if (!acc[section]) {
        acc[section] = []
      }
      acc[section].push(resource)
      return acc
    }, {} as Record<string, Resource[]>)
  )
  .sort(([a], [b]) => a.localeCompare(b)) // Sort sections alphabetically
  .map(([section, resources]) => [
    section,
    resources.sort((a, b) => a.title.localeCompare(b.title)) // Sort resources within each section
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
        <h1 className="text-3xl font-bold text-center mb-8 text-primary">
          Awesome Game Security Resources
        </h1>

        <Search 
          onSearch={handleGlobalSearch}
          initialValue={searchContext.query}
        />

        <div className="max-w-6xl mx-auto">
          {uniqueResources.length === 0 ? (
            <div className="text-center text-secondary">
              No resources found
            </div>
          ) : (
            <>
              {sortedResources.map(([section, sectionResources]) => (
                <div key={section} className="mb-12">
                  <h2 className="section-title">
                    {section}
                  </h2>

                  {sectionResources.map((resource, index) => (
                    <div key={`${resource.url}-${index}`} className="resource-card mb-6">
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
                                  onClick={() => {
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
        </div>
      </div>
    </div>
  )
}