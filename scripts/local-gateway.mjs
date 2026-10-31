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
})
