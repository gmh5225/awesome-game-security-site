'use client'

import { useState, useEffect } from 'react'
import Search from '@/components/Search'

interface Resource {
  title: string
  description: string
  url: string
  sections: string[]
  searchableContent?: string
  isSubSection?: boolean
  parentSection?: string
}

// Number of items to display per page
const ITEMS_PER_PAGE = 10

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [page, setPage] = useState(1)
  const [sections, setSections] = useState<string[]>([])

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md')
      .then(res => res.text())
      .then(content => {
        const resources: Resource[] = []
        const sections: string[] = []
        const lines = content.split('\n')
        let currentSection = ''
        let currentSubSection = ''
        let isInContents = false
        const urlMap = new Map<string, Resource>()

        // First pass: collect sections from Contents
        for(const line of lines) {
          const trimmedLine = line.trim()
          
          if(trimmedLine === '## Contents') {
            isInContents = true
            continue
          } else if(trimmedLine.startsWith('## ')) {
            isInContents = false
          }

          if(isInContents && trimmedLine.startsWith('- [')) {
            const sectionMatch = trimmedLine.match(/- \[(.*?)\]/)
            if(sectionMatch) {
              sections.push(sectionMatch[1])
            }
          }
        }

        setSections(sections)

        // Second pass: collect resources
        for(let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          
          // Parse section headers
          if(line.startsWith('## ')) {
            const section = line.slice(2).trim()
            if(section === 'How to contribute?' || section === 'Contents') {
              currentSection = ''
              currentSubSection = ''
              continue
            }
            currentSection = section
            currentSubSection = ''
            continue
          }

          // Parse subsection headers
          if(line.startsWith('> ')) {
            currentSubSection = line.slice(2).trim()
            if (currentSubSection) {
              sections.push(currentSubSection)
            }
            continue
          }

          // Parse resource links
          if((currentSection || currentSubSection) && line.startsWith('- ')) {
            let title = ''
            let description = ''
            let url = ''
            let extraInfo = ''

            // Try to match markdown link format with optional trailing brackets
            const fullMatch = line.match(/- \[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)(\s*\[([^\]]+)\])?/)
            if(fullMatch) {
              title = fullMatch[1]
              url = fullMatch[2]
              extraInfo = fullMatch[4] || ''
              description = extraInfo || title
            } else {
              // Try to match direct URL format with optional trailing brackets
              const directMatch = line.match(/- (https?:\/\/[^\s\]]+)(\s*\[([^\]]+)\])?/)
              if(directMatch) {
                url = directMatch[1]
                extraInfo = directMatch[3] || ''
                const urlParts = url.split('/')
                title = urlParts[urlParts.length - 1]
                description = extraInfo || title
              }
            }

            if(url) {
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
      })
  }, [])

  // Filter resources based on search query
  const filteredResources = resources.filter(resource => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    
    // Check if query matches any section
    if (resource.sections.some(section => 
      section.toLowerCase() === searchLower ||
      resource.parentSection?.toLowerCase() === searchLower
    )) {
      return true
    }

    // Check if query matches any part of the searchable content
    const contentToSearch = (resource.searchableContent || '').toLowerCase()
    const searchTerms = searchLower.split(/\s+/).filter(Boolean)
    return searchTerms.every(term => contentToSearch.includes(term))
  })

  // Remove duplicates and keep only one instance of each resource
  const uniqueResources = filteredResources.reduce((acc, resource) => {
    if (!acc.some(r => r.url === resource.url)) {
      acc.push(resource)
    }
    return acc
  }, [] as Resource[])

  // Calculate paginated resources
  const paginatedResources = uniqueResources.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = uniqueResources.length > page * ITEMS_PER_PAGE

  return (
    <div className="min-h-screen p-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold text-center mb-8 text-primary">
        Awesome Game Security Resources
      </h1>

      <Search onSearch={(query) => {
        setSearchQuery(query)
        setPage(1)
      }} />

      <div className="max-w-6xl mx-auto">
        {uniqueResources.length === 0 ? (
          <div className="text-center text-secondary">
            No resources found
          </div>
        ) : (
          <>
            {/* Group resources by parent section */}
            {Object.entries(
              paginatedResources.reduce((acc, resource) => {
                const section = resource.parentSection || resource.sections[0]
                if (!acc[section]) {
                  acc[section] = []
                }
                acc[section].push(resource)
                return acc
              }, {} as Record<string, Resource[]>)
            ).map(([section, sectionResources]) => (
              <div key={section} className="mb-12">
                {/* Section Title */}
                <h2 className="text-2xl font-semibold mb-6 text-highlight">
                  {section}
                </h2>

                {/* Resources in this section */}
                {sectionResources.map((resource, index) => (
                  <div key={`${resource.url}-${index}`} className="mb-6 p-4 bg-card-background border border-card-border rounded-lg hover:shadow-lg transition-shadow">
                    <h3 className="text-xl font-semibold mb-2 text-primary">{resource.title}</h3>
                    {resource.description !== resource.title && (
                      <p className="text-secondary mb-2">{resource.description}</p>
                    )}
                    <p className="font-mono text-sm text-secondary mb-4 break-all">{resource.url}</p>
                    <div className="flex flex-wrap gap-2">
                      {resource.sections.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSearchQuery(tag)}
                          className="text-xs bg-highlight/10 text-highlight px-2 py-1 rounded hover:bg-highlight/20 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-6 py-2 load-more-button rounded-full"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
