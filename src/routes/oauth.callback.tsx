import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/oauth/callback')({
  staticData: { title: 'OAuth 授权回调' },
  component: OAuthCallbackPage,
})

const CALLBACK_MESSAGE = 'apg-oauth-callback'

function deriveResult() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  const code = params.get('code') || undefined
  const description = params.get('error_description')
  if (error) return { failed: true, message: description || error, code: undefined, state: undefined, error, error_description: description || undefined }
  if (!code) return { failed: true, message: '回调地址缺少 code 参数', code: undefined, state: undefined, error: undefined, error_description: undefined }
  return { failed: false, message: '授权成功，正在返回…', code, state: params.get('state') || undefined, error: undefined, error_description: undefined }
}

function OAuthCallbackPage() {
  const [result] = useState(deriveResult)
  const failed = result.failed

  useEffect(() => {
    const payload = {
      type: CALLBACK_MESSAGE,
      code: result.code,
      state: result.state,
      error: result.error,
      error_description: result.error_description,
    }
    // 只回传给同源 opener，避免把授权码交给其它窗口
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin)
      window.setTimeout(() => window.close(), 400)
    }
  }, [result])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{failed ? '授权失败' : 'OAuth 授权'}</h1>
      <p className="text-sm text-muted-foreground">{result.message}</p>
      <button
        type="button"
        className="text-xs text-primary underline"
        onClick={() => window.close()}
      >
        关闭此窗口
      </button>
    </div>
  )
}
