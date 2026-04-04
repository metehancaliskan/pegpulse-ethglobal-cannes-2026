import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = path.dirname(__filename)

const nextConfig: NextConfig = {
  turbopack: {
    root: frontendRoot,
  },
}

export default nextConfig
