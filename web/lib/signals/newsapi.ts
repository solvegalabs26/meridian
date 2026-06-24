export interface NewsArticle {
  title: string
  description: string | null
  url: string
  source: string
  publishedAt: string
}

export async function fetchNewsSignals(keywords: string[], maxArticles = 5): Promise<NewsArticle[]> {
  if (!process.env.NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not set — skipping NewsAPI fetch')
    return []
  }

  if (!keywords || keywords.length === 0) return []

  // Build query — join top 3 keywords with OR for broader coverage
  const topKeywords = keywords.slice(0, 3)
  const query = topKeywords.map(k => `"${k}"`).join(' OR ')

  const url = new URL('https://newsapi.org/v2/everything')
  url.searchParams.set('q', query)
  url.searchParams.set('language', 'en')
  url.searchParams.set('sortBy', 'relevancy')
  url.searchParams.set('pageSize', String(maxArticles))
  url.searchParams.set('apiKey', process.env.NEWS_API_KEY)

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      console.error('NewsAPI error:', res.status, await res.text())
      return []
    }

    const data = await res.json() as {
      status: string
      articles: Array<{
        title: string
        description: string | null
        url: string
        source: { name: string }
        publishedAt: string
      }>
    }

    if (data.status !== 'ok') return []

    return data.articles
      .filter(a => a.title && !a.title.includes('[Removed]'))
      .map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        source: a.source.name,
        publishedAt: a.publishedAt,
      }))
  } catch (err) {
    console.error('NewsAPI fetch failed:', err)
    return []
  }
}
