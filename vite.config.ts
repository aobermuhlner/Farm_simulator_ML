import react from '@vitejs/plugin-react'
import { cp } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { contentTypeFor, DATA_MOUNTS } from './web/src/data/paths.js'

// `import.meta.dirname` needs Node 20.11+; this form works on the Node 18 the
// project's `engines` field still allows.
const repoRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * Task data is served, not bundled — see `web/src/data/paths.ts` for why, and
 * for the mount table this serves and copies from.
 */
function taskData(): Plugin {
  return {
    name: 'farm-task-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? ''
        for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
          if (!url.startsWith(`/${mount}/`)) continue
          const file = join(repoRoot, dir, normalize(url.slice(mount.length + 2)))
          // Traversal guard: anything that escapes the mount is not ours to serve.
          if (!file.startsWith(join(repoRoot, dir))) break
          res.setHeader('Content-Type', contentTypeFor(file))
          createReadStream(file).on('error', () => next()).pipe(res)
          return
        }
        next()
      })
    },
    async closeBundle() {
      for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
        await cp(join(repoRoot, dir), join(repoRoot, 'dist', mount), {
          recursive: true,
        })
      }
    },
  }
}

export default defineConfig({
  root: 'web',
  // Relative so the bundle works from a GitHub Pages project subpath.
  base: './',
  plugins: [react(), taskData()],
  build: { outDir: '../dist', emptyOutDir: true },
})
