'use client'

import { useState, useEffect } from 'react'
import Search from '@/components/Search'

interface Resource {
  title: string
  description: string
  url: string
  section: string
  searchableContent?: string
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
        let isInContents = false

        // First pass: collect all sections from Contents
        for(const line of lines) {
          const trimmedLine = line.trim()
          
          if(trimmedLine === '## Contents') {
            isInContents = true
            continue
          } else if(trimmedLine.startsWith('## ')) {
            isInContents = false
          }

          // Extract section names from Contents
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
            // Skip unwanted sections
            if(section === 'How to contribute?' || section === 'Contents') {
              currentSection = ''
              continue
            }
            currentSection = section
            continue
          }

          // Parse resource links
          if(currentSection && line.startsWith('- ')) {
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

            // Process resource if URL is found
            if(url) {
              // Check next line for additional description
              if(i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim()
                if(nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('#')) {
                  description = `${description} - ${nextLine}`
                  i++
                }
              }

              // Build searchable content
              const searchableContent = [
                title, 
                description, 
                url, 
                extraInfo, 
                currentSection
              ].filter(Boolean).join(' ')

              resources.push({
                title,
                description: description || extraInfo || title,
                url,
                section: currentSection,
                searchableContent
              })
            }
          }
        }
        
        setResources(resources)
      })
  }, [])

  // Filter resources based on search query
  const filteredResources = resources.filter(resource => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    
    // Check if search query matches any section from Contents
    const matchingSection = sections.find(section => 
      section.toLowerCase().includes(searchLower)
    )
    
    if (matchingSection) {
      // Return all resources in matching section
      return resource.section.toLowerCase() === matchingSection.toLowerCase()
    }
    
    // Perform normal search across all content
    const contentToSearch = (resource.searchableContent || '').toLowerCase()
    const searchTerms = searchLower.split(/\s+/).filter(Boolean)
    return searchTerms.every(term => contentToSearch.includes(term))
  })

  // Calculate resources for current page
  const paginatedResources = filteredResources.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = paginatedResources.length < filteredResources.length

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
        {filteredResources.length === 0 ? (
          <div className="text-center text-secondary">
            No resources found
          </div>
        ) : (
          <>
            {paginatedResources.map((resource, index) => (
              <div key={index} className="mb-6 p-4 bg-card-background border border-card-border rounded-lg hover:shadow-lg transition-shadow">
                <div className="text-sm text-highlight mb-1">{resource.section}</div>
                <h2 className="text-xl font-semibold mb-2 text-primary">{resource.title}</h2>
                {resource.description !== resource.title && (
                  <p className="text-secondary mb-2">{resource.description}</p>
                )}
                <p className="text-sm text-secondary mb-2 break-all">{resource.url}</p>
                <div className="flex justify-end">
                  <a 
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-highlight hover:underline"
                  >
                    View Details →
                  </a>
                </div>
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
