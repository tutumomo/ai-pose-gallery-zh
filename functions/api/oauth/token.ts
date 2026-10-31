// Cloudflare Pages Function: /api/oauth/token
// 用途：在後端帶上 client_secret 去換 OAuth token，secret 永遠不進前端。
//
// 安全限制（不可移除）：
// 1. 只接受 https 的 tokenUrl
// 2. tokenUrl 的主機必須在環境變數 OAUTH_TOKEN_HOSTS 白名單內（逗號分隔）
//    未設定白名單 = 完全拒絕，避免這個端點變成「帶秘密打任意網址」的工具
// 3. 只回傳上游的 JSON 與狀態碼，不回傳 secret

export interface Env {
  [key: string]: string | undefined
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function hostAllowed(tokenHost: string, env: Env): boolean {
  const raw = (env.OAUTH_TOKEN_HOSTS || '').trim()
  if (!raw) return false
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .some((allowed) => allowed === tokenHost)
}

function b64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export const onRequestPost = async (
  context: { request: Request; env?: Env },
  envOverride?: Env
): Promise<Response> => {
  const { request } = context
  const env: Env = envOverride || context.env || {}

  let payload: {
    tokenUrl?: string
    clientId?: string
    clientSecretEnv?: string
    tokenAuthStyle?: 'body' | 'basic'
    form?: Record<string, string>
  }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid_json', message: '请求体必须是 JSON' }, 400)
  }

  const { tokenUrl, clientId, clientSecretEnv, tokenAuthStyle = 'body', form = {} } = payload

  if (!tokenUrl || !/^https:\/\//i.test(tokenUrl)) {
    return json({ error: 'invalid_token_url', message: 'tokenUrl 必须是 https 地址' }, 400)
  }

  let target: URL
  try {
    target = new URL(tokenUrl)
  } catch {
    return json({ error: 'invalid_token_url', message: 'tokenUrl 无法解析' }, 400)
  }

  if (!hostAllowed(target.host.toLowerCase(), env)) {
    return json(
      {
        error: 'token_host_not_allowed',
        message: `tokenUrl 主机 ${target.host} 不在 OAUTH_TOKEN_HOSTS 白名单内`,
      },
      403
    )
  }

  const secret = clientSecretEnv ? env[clientSecretEnv] : undefined
  if (clientSecretEnv && !secret) {
    return json(
      { error: 'missing_client_secret', message: `环境变量 ${clientSecretEnv} 未设置` },
      400
    )
  }

  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === 'string') body.set(k, v)
  }
  if (clientId && !body.has('client_id')) body.set('client_id', clientId)

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }
  if (secret) {
    if (tokenAuthStyle === 'basic') {
      headers.Authorization = `Basic ${b64(`${clientId || ''}:${secret}`)}`
    } else {
      body.set('client_secret', secret)
    }
  }

  try {
    const upstream = await fetch(target.toString(), { method: 'POST', headers, body })
    const text = await upstream.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      // GitHub 等服務在沒有 Accept: application/json 時會回 form-encoded
      const params = new URLSearchParams(text)
      data = Object.fromEntries(params.entries())
    }
    return json(data, upstream.status)
  } catch (err) {
    return json({ error: 'upstream_error', message: (err as Error).message }, 502)
  }
}
