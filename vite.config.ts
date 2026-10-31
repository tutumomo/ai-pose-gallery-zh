import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// 开发与预览时：
// 1. 直接挂载仓库根目录下的 data/、thumbs/、img/，避免拷贝 6.8 GB 素材
// 2. 提供 /api/proxy 同源转发接口，解决 DashScope (Qwen) / 火山方舟 (Doubao) 官方接口的浏览器 CORS 限制
function localAssetsAndProxyPlugin(): Plugin {
  const rootDir = import.meta.dirname
  const prefixes = ['/data/', '/thumbs/', '/img/', '/og-cover.jpg', '/robots.txt', '/sitemap.xml']

  const handleProxy = async (req: any, res: any) => {
    try {
      const targetUrl = req.headers['x-target-url'] as string | undefined
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: { message: 'Missing or invalid x-target-url header' } }))
        return
      }

      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const rawBody = Buffer.concat(chunks)

      const forwardHeaders: Record<string, string> = {}
      const contentType = req.headers['content-type']
      if (contentType) forwardHeaders['Content-Type'] = contentType
      const auth = req.headers['authorization']
      if (auth) forwardHeaders['Authorization'] = auth
      const googKey = req.headers['x-goog-api-key']
      if (googKey) forwardHeaders['x-goog-api-key'] = googKey as string
      const dashAsync = req.headers['x-dashscope-async']
      if (dashAsync) forwardHeaders['X-DashScope-Async'] = dashAsync as string

      const upstream = await fetch(targetUrl, {
        method: req.method || 'POST',
        headers: forwardHeaders,
        body: rawBody.length > 0 ? rawBody : undefined,
      })

      res.statusCode = upstream.status
      const upType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
      res.setHeader('Content-Type', upType)
      const ab = await upstream.arrayBuffer()
      res.end(Buffer.from(ab))
    } catch (err: any) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: { message: err?.message || 'Proxy request failed' } }))
    }
  }


  // 本地開發版的 /api/oauth/token：與 Cloudflare Function 行為一致，
  // secret 從 process.env 讀取，且同樣要求 OAUTH_TOKEN_HOSTS 白名單。
  const handleOAuthToken = async (req: any, res: any) => {
    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(body))
    }
    try {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
      const tokenUrl = String(payload.tokenUrl || '')
      if (!/^https:\/\//i.test(tokenUrl)) {
        send(400, { error: 'invalid_token_url', message: 'tokenUrl 必须是 https 地址' })
        return
      }
      const target = new URL(tokenUrl)
      const allowList = (process.env.OAUTH_TOKEN_HOSTS || '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      if (!allowList.includes(target.host.toLowerCase())) {
        send(403, {
          error: 'token_host_not_allowed',
          message: `tokenUrl 主机 ${target.host} 不在 OAUTH_TOKEN_HOSTS 白名单内（本地开发请在 .env 设定）`,
        })
        return
      }
      const secret = payload.clientSecretEnv ? process.env[String(payload.clientSecretEnv)] : undefined
      const body = new URLSearchParams()
      for (const [k, v] of Object.entries(payload.form || {})) {
        if (typeof v === 'string') body.set(k, v)
      }
      if (payload.clientId && !body.has('client_id')) body.set('client_id', String(payload.clientId))

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      }
      if (secret) {
        if (payload.tokenAuthStyle === 'basic') {
          headers.Authorization = `Basic ${Buffer.from(`${payload.clientId || ''}:${secret}`).toString('base64')}`
        } else {
          body.set('client_secret', secret)
        }
      }

      const upstream = await fetch(target.toString(), { method: 'POST', headers, body })
      const text = await upstream.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        data = Object.fromEntries(new URLSearchParams(text).entries())
      }
      send(upstream.status, data)
    } catch (err: any) {
      send(502, { error: 'upstream_error', message: err?.message || 'OAuth token exchange failed' })
    }
  }

  const serve = (req: any, res: any, next: any) => {
    const rawUrl = (req.url || '').split('?')[0]
    if (rawUrl === '/api/proxy') {
      void handleProxy(req, res)
      return
    }
    if (rawUrl === '/api/oauth/token') {
      void handleOAuthToken(req, res)
      return
    }
    const decoded = decodeURIComponent(rawUrl)
    if (!prefixes.some((p) => decoded === p || decoded.startsWith(p))) {
      return next()
    }
    const filePath = path.join(rootDir, decoded)
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return next()
    }
    const ext = path.extname(filePath).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    fs.createReadStream(filePath).pipe(res)
  }

  return {
    name: 'local-assets-and-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
  }
}

export default defineConfig({
  publicDir: false,
  plugins: [
    localAssetsAndProxyPlugin(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tanstack-vendor', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'ui-vendor', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
