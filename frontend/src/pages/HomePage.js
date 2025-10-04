"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"

function HomePage() {
  const [query, setQuery] = useState("")
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate(`/results?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="home-page">
      <h1>ResearchAI</h1>
      <p>Find and summarize research papers with AI assistance</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your research topic"
        />
        <button type="submit">Search</button>
      </form>
    </div>
  )
}

export default HomePage

