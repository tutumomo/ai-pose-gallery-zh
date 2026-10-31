import { idbGet, idbSet } from '@/lib/idbStorage'
import type { OAuthTokenRecord } from '@/types/gallery'
import type { ResolvedProvider } from '@/services/providerRegistry'

const TOKEN_KEY_PREFIX = 'oauth_token_'
const VERIFIER_KEY_PREFIX = 'oauth_verifier_'
const CALLBACK_MESSAGE = 'apg-oauth-callback'

export class OAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthError'
  }
}

function tokenKey(providerId: string) {
  return `${TOKEN_KEY_PREFIX}${providerId}`
}

function verifierKey(providerId: string) {
  return `${VERIFIER_KEY_PREFIX}${providerId}`
}

function b64url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return b64url(bytes)
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest))
}

export function oauthRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`
}

interface TokenResponseLike {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
  [key: string]: unknown
}

function toRecord(providerId: string, data: TokenResponseLike): OAuthTokenRecord {
  if (!data.access_token) {
    throw new OAuthError(
      data.error_description || data.error || '授权服务器未返回 access_token'
    )
  }
  const expiresIn = Number(data.expires_in)
  return {
    providerId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
  }
}

/** 依設定走瀏覽器直連或 Cloudflare Function 帶 secret 換 token */
async function requestToken(
  provider: ResolvedProvider,
  form: Record<string, string>
): Promise<TokenResponseLike> {
  const oauth = provider.oauth
  if (!oauth?.tokenUrl) throw new OAuthError('未設定 token 端點 (tokenUrl)')

  if (oauth.tokenExchange === 'server') {
    const res = await fetch('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenUrl: oauth.tokenUrl,
        clientId: oauth.clientId,
        clientSecretEnv: oauth.clientSecretEnv,
        tokenAuthStyle: oauth.tokenAuthStyle,
        form,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as TokenResponseLike & { message?: string }
    if (!res.ok) {
      throw new OAuthError(json.message || json.error_description || json.error || `换取 token 失败 (HTTP ${res.status})`)
    }
    return json
  }

  const body = new URLSearchParams(form)
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }
  if (oauth.tokenAuthStyle === 'basic') {
    headers.Authorization = `Basic ${btoa(`${oauth.clientId}:`)}`
  }
  const res = await fetch(oauth.tokenUrl, { method: 'POST', headers, body })
  const json = (await res.json().catch(() => ({}))) as TokenResponseLike
  if (!res.ok) {
    throw new OAuthError(json.error_description || json.error || `换取 token 失败 (HTTP ${res.status})`)
  }
  return json
}

function appendExtraParams(url: URL, raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return
  for (const pair of trimmed.split('&')) {
    const [k, v = ''] = pair.split('=')
    if (k) url.searchParams.set(k.trim(), v.trim())
  }
}

/** 授權碼 + PKCE（彈出視窗） */
export async function runPkceFlow(provider: ResolvedProvider): Promise<OAuthTokenRecord> {
  const oauth = provider.oauth
  if (!oauth?.authorizeUrl) throw new OAuthError('未設定授權端點 (authorizeUrl)')
  if (!oauth.clientId) throw new OAuthError('未設定 client_id')

  const verifier = randomToken(64)
  const state = randomToken(16)
  sessionStorage.setItem(verifierKey(provider.id), `${state}:${verifier}`)

  const redirectUri = oauthRedirectUri()
  const url = new URL(oauth.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', oauth.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', await s256(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  if (oauth.scopes.trim()) url.searchParams.set('scope', oauth.scopes.trim())
  appendExtraParams(url, oauth.extraAuthParams)

  const popup = window.open(url.toString(), 'apg_oauth', 'width=560,height=780')
  if (!popup) throw new OAuthError('弹窗被浏览器拦截，请允许弹出窗口后重试')

  const result = await new Promise<{ code?: string; state?: string; error?: string; errorDescription?: string }>(
    (resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        window.removeEventListener('message', onMessage)
        clearInterval(timer)
        fn()
      }
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return
        const data = event.data
        if (!data || data.type !== CALLBACK_MESSAGE) return
        finish(() =>
          resolve({
            code: data.code,
            state: data.state,
            error: data.error,
            errorDescription: data.error_description,
          })
        )
      }
      const timer = setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new OAuthError('授权窗口已关闭，未完成授权')))
        }
      }, 800)
      window.addEventListener('message', onMessage)
    }
  )

  if (result.error) throw new OAuthError(result.errorDescription || result.error)
  if (!result.code) throw new OAuthError('授权回调缺少 code')

  const saved = sessionStorage.getItem(verifierKey(provider.id))
  sessionStorage.removeItem(verifierKey(provider.id))
  if (!saved) throw new OAuthError('授权会话已失效，请重试')
  const [savedState, savedVerifier] = saved.split(':')
  if (savedState !== result.state) throw new OAuthError('state 校验失败，可能遭遇 CSRF，请重试')

  const data = await requestToken(provider, {
    grant_type: 'authorization_code',
    code: result.code,
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    code_verifier: savedVerifier,
  })

  const record = toRecord(provider.id, data)
  await idbSet(tokenKey(provider.id), record)
  return record
}

export interface DeviceFlowPrompt {
  userCode: string
  verificationUri: string
  expiresAt: number
}

/** Device Code 流程；onPrompt 用來顯示 user_code，回傳 promise 在使用者完成授權後解析 */
export async function runDeviceFlow(
  provider: ResolvedProvider,
  onPrompt: (prompt: DeviceFlowPrompt) => void
): Promise<OAuthTokenRecord> {
  const oauth = provider.oauth
  if (!oauth?.deviceCodeUrl) throw new OAuthError('未設定 device code 端點')
  if (!oauth.clientId) throw new OAuthError('未設定 client_id')

  const res = await fetch(oauth.deviceCodeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: oauth.clientId,
      ...(oauth.scopes.trim() ? { scope: oauth.scopes.trim() } : {}),
    }),
  })
  const info = (await res.json().catch(() => ({}))) as {
    device_code?: string
    user_code?: string
    verification_uri?: string
    verification_url?: string
    interval?: number
    expires_in?: number
    error_description?: string
    error?: string
  }
  if (!res.ok || !info.device_code || !info.user_code) {
    throw new OAuthError(info.error_description || info.error || `获取 device code 失败 (HTTP ${res.status})`)
  }

  const intervalMs = Math.max(2, Number(info.interval) || 5) * 1000
  const expiresAt = Date.now() + (Number(info.expires_in) || 900) * 1000
  onPrompt({
    userCode: info.user_code,
    verificationUri: info.verification_uri || info.verification_url || '',
    expiresAt,
  })

  while (Date.now() < expiresAt) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const data = await requestToken(provider, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: info.device_code,
      client_id: oauth.clientId,
    }).catch((e) => ({ error: 'network', error_description: (e as Error).message }) as TokenResponseLike)

    if (data.access_token) {
      const record = toRecord(provider.id, data)
      await idbSet(tokenKey(provider.id), record)
      return record
    }
    if (data.error === 'authorization_pending' || data.error === 'network') continue
    if (data.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, intervalMs))
      continue
    }
    throw new OAuthError(data.error_description || data.error || '授权失败')
  }
  throw new OAuthError('设备授权已超时，请重试')
}

export async function readToken(providerId: string): Promise<OAuthTokenRecord | undefined> {
  return idbGet<OAuthTokenRecord>(tokenKey(providerId))
}

export async function clearToken(providerId: string): Promise<void> {
  await idbSet<OAuthTokenRecord | null>(tokenKey(providerId), null)
}

/** 取可用 access token；临近过期自动刷新 */
export async function getAccessToken(provider: ResolvedProvider): Promise<string | null> {
  const record = await readToken(provider.id)
  if (!record?.accessToken) return null

  const expiringSoon = record.expiresAt > 0 && record.expiresAt - 60_000 < Date.now()
  if (!expiringSoon) return record.accessToken
  if (!record.refreshToken || !provider.oauth) return record.accessToken

  try {
    const data = await requestToken(provider, {
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken,
      client_id: provider.oauth.clientId,
    })
    const refreshed = toRecord(provider.id, {
      ...data,
      refresh_token: data.refresh_token || record.refreshToken,
    })
    await idbSet(tokenKey(provider.id), refreshed)
    return refreshed.accessToken
  } catch {
    return record.accessToken
  }
}
