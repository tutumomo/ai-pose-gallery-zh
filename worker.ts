import { onRequestPost } from './functions/api/proxy'
import { onRequestPost as onOAuthTokenPost } from './functions/api/oauth/token'

export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
  /** 允許換 token 的目標主機白名單（逗號分隔） */
  OAUTH_TOKEN_HOSTS?: string
  [key: string]: unknown
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle /api/proxy CORS forwarding for DashScope (Qwen) & Volcengine Ark (Doubao)
    if (url.pathname === '/api/proxy') {
      if (request.method === 'POST') {
        return onRequestPost({ request })
      }
      return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    // 服務端 OAuth token 交換（帶 client_secret；需設定 OAUTH_TOKEN_HOSTS）
    if (url.pathname === '/api/oauth/token') {
      if (request.method === 'POST') {
        return onOAuthTokenPost({
          request,
          env: env as unknown as Record<string, string | undefined>,
        })
      }
      return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    // Fallback to static assets binding
    return env.ASSETS.fetch(request)
  },
}
