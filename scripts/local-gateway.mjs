#!/usr/bin/env node
// 本機 Gateway：把瀏覽器（http://localhost:5173）與本機上游（如 magpie http://127.0.0.1:3425）之間補上 CORS。
//
// 為什麼需要：
//   瀏覽器直接呼叫 127.0.0.1:3425 會被 CORS 擋（上游不回 Access-Control-Allow-Origin）；
//   而線上部署版是 https，fetch 到 http://127.0.0.1 又會被 mixed content 擋。
//   所以：開發時用本機 app + 這個 bridge；線上部署要連本機服務則需另外做 tunnel。
//
// 用法：
//   node scripts/local-gateway.mjs
//   MAGPIE_BASE_URL=http://127.0.0.1:3425 node scripts/local-gateway.mjs
//   PORT=9000 node scripts/local-gateway.mjs
//
// 上游 API key 來源（優先序）：
//   1. 環境變數 MAGPIE_API_KEY
//   2. ~/.gemini/.env 的 GEMINI_API_KEY
// key 只留在本機 process 內，不會送到瀏覽器。

import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT || 8788)
const HOST = process.env.HOST || '127.0.0.1'
const UPSTREAM = (process.env.MAGPIE_BASE_URL || 'http://127.0.0.1:3425').replace(/\/+$/, '')
const ALLOW_HOST = process.env.MAGPIE_ALLOW_HOSTS || '127.0.0.1,localhost'

function readGeminiKey() {
  if (process.env.MAGPIE_API_KEY) return process.env.MAGPIE_API_KEY.trim()
  const envPath = path.join(os.homedir(), '.gemini', '.env')
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    const m = text.match(/^GEMINI_API_KEY=(.*)$/m)
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}

const API_KEY = readGeminiKey()

// agy（Antigravity CLI）走自己的 Google 帳號 OAuth，token 不會離開 CLI process。
// 這裡只把 ~/.gemini/.env 的後端設定餵給子行程，app 端永遠看不到 token。
const AGY_BIN = process.env.AGY_BIN || 'agy'
const AGY_TIMEOUT_MS = Number(process.env.AGY_TIMEOUT_MS || 240000)
const AGY_MODELS = (
  process.env.AGY_MODELS ||
  'gemini-4-argon-high,magpie/antigravity/gemini-4-argon,magpie/antigravity/claude-sonnet-5-5,magpie/group/gemini'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

function readGeminiEnv() {
  const envPath = path.join(os.homedir(), '.gemini', '.env')
  const out = {}
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // 沒有就讓 agy 用它自己的設定
  }
  return out
}

/** 把 prompt 丟給 agy 的 print mode；回傳純文字 */
function runAgyl(prompt, model) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json', '--print-timeout', `${Math.floor(AGY_TIMEOUT_MS / 1000)}s`]
    if (model) args.push('--model', model)
    const child = spawn(AGY_BIN, args, {
      env: { ...process.env, ...readGeminiEnv() },
      cwd: os.homedir(),
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`agy 逾時（${Math.round(AGY_TIMEOUT_MS / 1000)}s）`))
    }, AGY_TIMEOUT_MS + 5000)
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        if (code !== 0 && !out.trim()) {
          reject(new Error((err || out || `agy exit ${code}`).trim().slice(0, 400)))
          return
        }
        resolve(extractAgylText(out))
      } catch (e) {
        // agy 回報的錯誤要變成 HTTP 502，不能讓 gateway 整個掛掉
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  })
}

function extractAgylText(raw) {
  const trimmed = raw.trim()
  let json
  try {
    json = JSON.parse(trimmed)
  } catch {
    return trimmed // 不是 JSON 就當純文字
  }
  // agy print mode 的封包：{ status, response, error, usage, ... }
  if (json && json.status && String(json.status).toUpperCase() !== 'SUCCESS') {
    throw new Error(String(json.error || json.status || 'agy 執行失敗').slice(0, 400))
  }
  const pick =
    json?.response ||
    json?.result?.text ||
    json?.response?.text ||
    json?.text ||
    json?.result ||
    json?.content ||
    json?.message?.content
  if (typeof pick === 'string' && pick.trim()) return pick.trim()
  if (Array.isArray(json)) {
    const joined = json
      .map((x) => x?.text || x?.content || x?.result || '')
      .filter(Boolean)
      .join('\n')
    if (joined.trim()) return joined.trim()
  }
  return trimmed
}

// agy 是單一 CLI，序列化避免同時開多個
let agyQueue = Promise.resolve()
function enqueueAgyl(task) {
  const result = agyQueue.then(task, task)
  agyQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function corsHeaders(req) {
  const origin = req.headers.origin || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

function json(res, status, body, extra = {}) {
  const buf = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    ...extra,
  })
  res.end(buf)
}

const server = http.createServer(async (req, res) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/health') {
    json(
      res,
      200,
      { ok: true, upstream: UPSTREAM, hasKey: Boolean(API_KEY) },
      cors
    )
    return
  }

  if (url.pathname === '/agy/health') {
    json(
      res,
      200,
      {
        ok: true,
        bin: AGY_BIN,
        models: AGY_MODELS,
        note: 'agy 自行处理 Google 账号 OAuth，token 不经过 gateway',
      },
      cors
    )
    return
  }

  // /agy/v1/* → Antigravity CLI（Google Pro 额度，文字）
  if (url.pathname === '/agy/v1/chat/completions') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
    } catch {
      json(res, 400, { error: { message: 'invalid json' } }, cors)
      return
    }
    const messages = Array.isArray(body.messages) ? body.messages : []
    const system = messages.find((m) => m?.role === 'system')?.content
    const last = [...messages].reverse().find((m) => m?.role === 'user')?.content
    const prompt = [system, typeof last === 'string' ? last : JSON.stringify(last ?? '')]
      .filter(Boolean)
      .join('\n\n')
    try {
      const model = body.model || AGY_MODELS[0]
      const text = await enqueueAgyl(() => runAgyl(prompt, model))
      json(
        res,
        200,
        {
          id: `agy-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: body.model || AGY_MODELS[0],
          choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        },
        cors
      )
      console.log('POST /agy/v1/chat/completions -> 200')
    } catch (err) {
      json(res, 502, { error: { message: err.message } }, cors)
      console.log(`POST /agy/v1/chat/completions -> 502 ${err.message}`)
    }
    return
  }

  if (url.pathname === '/agy/v1/models') {
    json(
      res,
      200,
      { object: 'list', data: AGY_MODELS.map((id) => ({ id, object: 'model', owned_by: 'agy' })) },
      cors
    )
    return
  }

  if (!url.pathname.startsWith('/v1/')) {
    json(res, 404, { error: { message: 'only /v1/* is proxied' } }, cors)
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)

  const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' }
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  try {
    const upstreamRes = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : raw,
    })
    const text = await upstreamRes.text()
    res.writeHead(upstreamRes.status, {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8',
      ...cors,
    })
    res.end(text)
    console.log(`${req.method} ${url.pathname} -> ${upstreamRes.status}`)
  } catch (err) {
    json(res, 502, { error: { message: err.message } }, cors)
    console.log(`${req.method} ${url.pathname} -> 502 ${err.message}`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`local gateway  http://${HOST}:${PORT}`)
  console.log(`  upstream     ${UPSTREAM}`)
  console.log(`  api key      ${API_KEY ? 'loaded (from env or ~/.gemini/.env)' : 'MISSING'}`)
  console.log(`  proxying     /v1/*  (images/generations, images/edits, chat/completions, models)`)
  console.log(`  antigravity  /agy/v1/*  → ${AGY_BIN} -p  (Google Pro 额度，文字)`)
})
