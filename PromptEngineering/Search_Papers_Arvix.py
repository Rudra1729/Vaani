import arxiv

def search_arxiv_papers(query, num_results=5):
    # Configure the arXiv client
    client = arxiv.Client(
        page_size=100,
        delay_seconds=3,
        num_retries=3
    )
    
    # Define the search parameters
    search = arxiv.Search(
        query=query,
        max_results=num_results,
        sort_by=arxiv.SortCriterion.Relevance  # Sort by relevance
    )
    
    # Execute the search
    results = []
    for paper in client.results(search):
        results.append({
            "title": paper.title,
            "url": paper.pdf_url
        })
    
    return results

# Example usage
'''
papers = search_arxiv_papers("Machine Learning")
print(papers)
'''