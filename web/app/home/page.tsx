import type { Metadata } from 'next'
import HomePageClient from './HomePageClient'

export const metadata: Metadata = {
  title: 'Meridian Arc — Your objectives, always in motion',
  description: 'Meridian Arc remembers what you\'re working toward, monitors the world for signals that matter, and tells you what to do next.',
}

export default function HomePage() {
  return <HomePageClient />
}
