'use client'

import { useState, useEffect } from 'react'
import Search from '@/components/Search'

interface Resource {
  title: string
  description: string
  url: string
  section: string
}

const ITEMS_PER_PAGE = 10 // Items per page

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/gmh5225/awesome-game-security/refs/heads/main/README.md')
      .then(res => res.text())
      .then(content => {
        const resources: Resource[] = []
        const lines = content.split('\n')
        let currentSection = ''

        for(let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          
          // Parse section headers
          if(line.startsWith('## ')) {
            const section = line.slice(2).trim()
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

            // Try to match markdown link format
            const markdownLink = line.match(/- \[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/)
            if(markdownLink) {
              title = markdownLink[1]
              url = markdownLink[2]
              description = title
            } else {
              // Try to match direct URL format
              const directUrl = line.match(/- (https?:\/\/[^\s]+)/)
              if(directUrl) {
                url = directUrl[1]
                const urlParts = url.split('/')
                title = urlParts[urlParts.length - 1]
                description = title
              }
            }

            // If URL is found, try to get description from next line
            if(url) {
              if(i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim()
                if(nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('#')) {
                  description = nextLine
                  i++
                }
              }

              resources.push({
                title,
                description,
                url,
                section: currentSection
              })
            }
          }
        }
        
        setResources(resources)
        console.log('Parsed resources:', resources)
      })
  }, [])

  const filteredResources = resources.filter(resource => {
    const searchLower = searchQuery.toLowerCase()
    const contentToSearch = `${resource.title} ${resource.description} ${resource.url} ${resource.section}`.toLowerCase()
    
    const searchTerms = searchLower.split(/\s+/).filter(Boolean)
    return searchTerms.every(term => contentToSearch.includes(term))
  })

  // Calculate paginated resources
  const paginatedResources = filteredResources.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = paginatedResources.length < filteredResources.length

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        Awesome Game Security Resources
      </h1>

      <Search onSearch={(query) => {
        setSearchQuery(query)
        setPage(1) // Reset page when searching
      }} />

      <div className="max-w-6xl mx-auto">
        {filteredResources.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">
            No resources found
          </div>
        ) : (
          <>
            {paginatedResources.map((resource, index) => (
              <div key={index} className="mb-6 p-4 border rounded-lg hover:shadow-lg transition-shadow">
                <div className="text-sm text-blue-500 mb-1">{resource.section}</div>
                <h2 className="text-xl font-semibold mb-2">{resource.title}</h2>
                {resource.description !== resource.title && (
                  <p className="text-gray-600 dark:text-gray-300 mb-2">{resource.description}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 break-all">{resource.url}</p>
                <div className="flex justify-end">
                  <a 
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-blue-500 hover:underline"
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
                  className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
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
