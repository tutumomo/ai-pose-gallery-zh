import { getAccessToken } from '@/services/oauth'
import {
  PROVIDER_META,
  type ProviderModelOption,
  type ResolvedProvider,
  resolveProvider,
} from '@/services/providerRegistry'
import type { ApiConfig, RecipeState } from '@/types/gallery'

export { PROVIDER_META }
export type { ProviderModelOption }

export const STYLE_PRESETS: Record<string, { label: string; prompt: string }> = {
  none: {
    label: '无预设（跟随参考图）',
    prompt: '',
  },
  realistic: {
    label: '写实人像写真',
    prompt: '写实商业摄影级质感，85mm 人像镜头，自然柔和光影，真实肌肤纹理与织物细节，8k 高清画质。',
  },
  fashion: {
    label: '日韩杂志画报',
    prompt: '日韩时尚穿搭杂志画报风格，干净极简摄影棚背景，高级色调，突出人物颜值与服装剪裁。',
  },
  film: {
    label: '复古胶片写真',
    prompt: '35mm 富士胶片摄影质感，轻微胶片颗粒，柔和复古暖调，自然街拍光影与电影呼吸感。',
  },
  semi_real: {
    label: '2.5D 游戏原画立绘',
    prompt: '2.5D 半写实高精度游戏角色原画，唯美厚涂光影，精致五官与华丽布料金属质感。',
  },
  anime: {
    label: '日系二次元插画',
    prompt: '日系精致二次元插画风格，细腻赛璐璐与厚涂光影过渡，动漫角色立绘质感，色彩通透干净。',
  },
  cel_anime: {
    label: '新海诚感动画电影',
    prompt: '动画电影级画面质感，清澈高饱和光影，细腻体积光与发丝高光，干净唯美的动漫色彩。',
  },
  manga: {
    label: '日式黑白漫画网点',
    prompt: '日本黑白漫画原稿风格，利落精准的G笔线稿，细腻漫画网点纸阴影与层次对比。',
  },
  render3d: {
    label: '3D 次世代角色渲染',
    prompt: 'Unreal Engine 5 / Octane Render 次世代 3D 角色渲染，细腻次表面散射肌肤材质，电影级布光。',
  },
  chibi_box: {
    label: '3D 潮玩手办质感',
    prompt: '高品质 PVC 涂装完成品手办质感，柔和摄影棚柔光箱布光，精致材质高光与微距景深。',
  },
  cyberpunk: {
    label: '赛博朋克霓虹',
    prompt: '赛博朋克科幻视觉风格，雨夜霓虹冷暖双色轮廓光，未来感材质反光与电影级氛围。',
  },
  concept_sheet: {
    label: '角色设定集立绘（纯白底）',
    prompt: '标准角色设定集全身立绘，纯白干净无杂物背景，均匀漫反射布光，清晰展示全身服装结构与配饰细节。',
  },
}

// 按实际传入模型的图片顺序动态生成「图1 / 图2 / 图3...」明确指代，支持附加上传图片
export function buildRecipePrompt(recipe: RecipeState, stylePreset = 'realistic'): string {
  const styleInfo = STYLE_PRESETS[stylePreset] ?? STYLE_PRESETS.realistic
  const clauses: string[] = []
  let idx = 1

  if (recipe.portrait) {
    clauses.push(
      `• 【图${idx}（人像参考）】：保持图${idx}人物五官脸型与气质一致，发型为「${recipe.portrait.标题}」（${recipe.portrait.原发型 || recipe.portrait.原发长}）。`
    )
    idx++
  }
  if (recipe.costume) {
    clauses.push(
      `• 【图${idx}（服装参考）】：穿上图${idx}中的完整服饰「${recipe.costume.服装名称}」（${recipe.costume.关键词}），还原面料质感与剪裁。`
    )
    idx++
  }
  if (recipe.pose) {
    clauses.push(
      `• 【图${idx}（姿势参考）】：身体姿态与镜头透视遵循图${idx}「${recipe.pose.姿势名称}」【${recipe.pose.角度}】（仅参考骨架动作，忽略素体白模材质）。`
    )
    idx++
  }
  for (const extra of recipe.extraImages || []) {
    clauses.push(
      `• 【图${idx}（附加参考：${extra.name || '补充元素'}）】：融合图${idx}中的元素、配饰、背景或光影细节。`
    )
    idx++
  }

  if (clauses.length === 0) {
    return '请先选择人像/服装/姿势或上传附加参考图。'
  }

  const lines = [
    `请结合提供的 ${clauses.length} 张参考图，融合成一张完整的人物图像：`,
    ...clauses,
  ]
  if (styleInfo.prompt) {
    lines.push(`• 【画风要求】：${styleInfo.prompt} 人物比例协调，手部与五官自然，光影统一。`)
  }
  return lines.join('\n')
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxSide = 1024
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('解析图片失败'))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`加载图片失败: ${src}`))
    if (src.startsWith('data:') || /^https?:\/\//i.test(src) || src.startsWith('/')) {
      img.src = src
    } else {
      img.src = `/${src}`
    }
  })
}

export async function stitchRecipeCanvas(recipe: RecipeState): Promise<string> {
  const list: Array<{ tag: string; sub: string; src: string }> = []
  let idx = 1

  if (recipe.portrait) {
    list.push({
      tag: `图${idx++} · 人像`,
      sub: recipe.portrait.标题,
      src: recipe.portrait.原图 || recipe.portrait.缩略图,
    })
  }
  if (recipe.costume) {
    list.push({
      tag: `图${idx++} · 服装`,
      sub: `${recipe.costume.分类} · ${recipe.costume.服装名称}`,
      src: recipe.costume.预览图 || recipe.costume.原图 || recipe.costume.缩略图,
    })
  }
  if (recipe.pose) {
    list.push({
      tag: `图${idx++} · 姿势`,
      sub: `${recipe.pose.姿势名称}（${recipe.pose.角度}）`,
      src: recipe.pose.原图 || recipe.pose.缩略图,
    })
  }
  for (const extra of recipe.extraImages || []) {
    list.push({
      tag: `图${idx++} · 附加`,
      sub: extra.name || '自定义参考图',
      src: extra.url,
    })
  }

  if (!list.length) {
    throw new Error('请至少选择或上传 1 张参考图')
  }

  const imgs = await Promise.all(list.map((x) => loadImage(x.src)))
  const cardW = 480
  const cardH = 640
  const pad = 20
  const headH = 62
  const canvas = document.createElement('canvas')
  canvas.width = list.length * cardW + (list.length + 1) * pad
  canvas.height = cardH + headH + pad * 2
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#111318'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  imgs.forEach((img, i) => {
    const x = pad + i * (cardW + pad)
    const y = pad
    ctx.fillStyle = '#1e222b'
    ctx.fillRect(x, y, cardW, cardH + headH)
    ctx.fillStyle = '#f4f5f7'
    ctx.fillRect(x, y + headH, cardW, cardH)

    const scale = Math.min(cardW / img.width, cardH / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (cardW - dw) / 2, y + headH + (cardH - dh) / 2, dw, dh)

    ctx.fillStyle = '#a1a1aa'
    ctx.font = '600 12px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    ctx.fillText(list[i].tag, x + 14, y + 23)

    ctx.fillStyle = '#ffffff'
    ctx.font = '700 15px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    ctx.fillText(list[i].sub.slice(0, 26), x + 14, y + 46)
  })

  return canvas.toDataURL('image/jpeg', 0.92)
}

// 将本地相对路径自动解析为公网可访问的 HTTPS URL
// - 若当前站点已部署在公网 HTTPS 域名，优先使用当前站点 URL
// - 若在 localhost 本地开发，自动映射为三大图库对应的 Cloudflare Pages 公网源站 CDN URL
export function toPublicHttpsUrl(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src
  const clean = src.replace(/^\/+/, '')

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
  ) {
    return `${window.location.origin}/${clean}`
  }

  // 本地开发态自动映射为源站 Cloudflare Pages 公网 HTTPS 地址，方便云端生图接口直接拉取
  if (clean.startsWith('img/portrait/')) {
    const filename = clean.slice('img/portrait/'.length).replace(/\.webp$/i, '.png')
    return `https://ai-portrait-gallery.pages.dev/img/${filename}`
  }
  if (clean.startsWith('thumbs/portrait/')) {
    return `https://ai-portrait-gallery.pages.dev/thumbs/${clean.slice('thumbs/portrait/'.length)}`
  }
  if (clean.startsWith('img/costume/') || clean.startsWith('thumbs/costume/')) {
    return `https://ai-costume-gallery.pages.dev/${clean}`
  }
  return `https://ai-pose-gallery.pages.dev/${clean}`
}

async function srcToPngDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:image/')) return src
  const img = await loadImage(src)
  const maxSide = 1024
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function smartFetch(
  targetUrl: string,
  init: RequestInit,
  useProxy: boolean
): Promise<Response> {
  if (!useProxy) {
    return fetch(targetUrl, init)
  }
  const headers = new Headers(init.headers)
  headers.set('x-target-url', targetUrl)
  return fetch('/api/proxy', {
    method: init.method || 'POST',
    headers,
    body: init.body,
  })
}

function extractUniversalImage(json: any): string | null {
  // 0. MiniMax image_generation: data.image_urls[] / data.image_base64[]
  if (json?.data?.image_urls?.[0]) return json.data.image_urls[0]
  if (json?.data?.image_base64?.[0]) return `data:image/png;base64,${json.data.image_base64[0]}`

  // 1. OpenAI / Doubao Seedream standard: data[0].b64_json or data[0].url
  if (json?.data?.[0]?.b64_json) return `data:image/png;base64,${json.data[0].b64_json}`
  if (json?.data?.[0]?.url) return json.data[0].url

  // 2. OpenAI Responses API output[].result
  if (Array.isArray(json?.output)) {
    for (const item of json.output) {
      if (item?.type === 'image_generation_call' && item?.result) {
        return `data:image/png;base64,${item.result}`
      }
    }
  }

  // 3. Alibaba DashScope Qwen-Image: output.choices[0].message.content[].image or output.results[0].url
  const dashContent = json?.output?.choices?.[0]?.message?.content
  if (Array.isArray(dashContent)) {
    for (const part of dashContent) {
      if (part?.image) return part.image
    }
  }
  if (json?.output?.results?.[0]?.url) return json.output.results[0].url

  // 4. Google Gemini generateContent: candidates[0].content.parts[].inlineData
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    if (p.inlineData?.data) return `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`
    if (p.inline_data?.data) return `data:${p.inline_data.mime_type || 'image/png'};base64,${p.inline_data.data}`
  }

  // 5. OpenAI Chat Completions multimodal / markdown image
  const msg = json?.choices?.[0]?.message
  if (Array.isArray(msg?.images) && msg.images[0]?.image_url?.url) return msg.images[0].image_url.url
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url
      if (part.inlineData?.data) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
    }
  }
  const text = typeof msg?.content === 'string' ? msg.content : ''
  const mdMatch = text.match(/!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^\s)]+)\)/)
  if (mdMatch) return mdMatch[1]
  const urlMatch = text.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp)[^\s"'<>]*)/i)
  if (urlMatch) return urlMatch[1]

  return null
}


function joinV1(baseUrl: string): string {
  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
}

/** 解析 data.image_urls[0] / data[0].url 這類路徑 */
function parsePath(root: unknown, path: string): unknown {
  if (!path.trim()) return undefined
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: any = root
  for (const token of tokens) {
    if (cur == null) return undefined
    cur = cur[token]
  }
  return cur
}

/**
 * 自訂模板渲染：
 * - `"{{key}}"`（帶引號）→ 整體換成 JSON 編碼值；陣列變數輸出真正的 JSON 陣列
 * - `{{key}}`（不帶引號）→ 直接內插字串（數字變數原樣輸出）
 */
export function renderBodyTemplateSafe(
  template: string,
  vars: Record<string, string | number | string[]>
): string {
  const quoted = template.replace(/"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}"/g, (_m, key: string) => {
    const k = key.trim()
    if (!(k in vars)) return '""'
    const v = vars[k]
    if (Array.isArray(v)) return JSON.stringify(v)
    if (typeof v === 'number') return String(v)
    return JSON.stringify(v)
  })
  return quoted.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const k = key.trim()
    if (!(k in vars)) return ''
    const v = vars[k]
    return Array.isArray(v) ? JSON.stringify(v) : String(v)
  })
}

function parseExtraHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of (raw || '').split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) out[key] = value
  }
  return out
}

async function resolveAuth(p: ResolvedProvider): Promise<string> {
  // 本机 gateway（agy / magpie）不驗證憑證
  if (p.authMode === 'none') return 'local'
  if (p.authMode === 'apiKey') return p.apiKey
  const token = await getAccessToken(p)
  return token || ''
}

export interface GenerateImageResult {
  imageUrl: string
  modelUsed: string
  providerUsed: string
}

export async function generateCharacterImage(params: {
  recipe: RecipeState
  prompt: string
  config: ApiConfig
}): Promise<GenerateImageResult> {
  const { recipe, prompt, config } = params
  const providerId = config.activeProvider
  const p = resolveProvider(config, providerId)
  if (!p) throw new Error(`找不到供应商配置：${providerId}`)
  if (p.purpose === 'chat') {
    throw new Error(`「${p.name}」被标记为文字模型，不能用于生图`)
  }

  const auth = await resolveAuth(p)
  if (!auth) {
    throw new Error(
      p.authMode === 'apiKey'
        ? `请先配置 ${p.name} 的 API Key`
        : `请先为 ${p.name} 完成 OAuth 授权`
    )
  }

  const rawSources = [
    recipe.portrait && (recipe.portrait.原图 || recipe.portrait.缩略图),
    recipe.costume && (recipe.costume.预览图 || recipe.costume.原图 || recipe.costume.缩略图),
    recipe.pose && (recipe.pose.原图 || recipe.pose.缩略图),
    ...(recipe.extraImages || []).map((x) => x.url),
  ].filter(Boolean) as string[]

  if (!rawSources.length) {
    throw new Error('请先选择或上传至少 1 张参考图')
  }

  const model = p.model
  if (!model) {
    throw new Error('请选择或填写有效的模型名称')
  }

  const baseUrl = p.baseUrl.replace(/\/+$/, '')
  const needBase64 =
    config.imagePassMode === 'base64' ||
    config.sendStitchedSheet ||
    (p.protocol === 'gemini_native' && config.geminiParams.endpointMode === 'native') ||
    (p.protocol === 'openai_images' && config.gptParams.endpointMode === 'images_edits')

  const imageRefs: string[] = needBase64
    ? await Promise.all(rawSources.map(srcToPngDataUrl))
    : rawSources.map(toPublicHttpsUrl)

  const allImageRefs: string[] = config.sendStitchedSheet
    ? [...imageRefs, await stitchRecipeCanvas(recipe)]
    : imageRefs

  let res: Response
  let json: any

  switch (p.protocol) {
    // =======================================================================
    // 协议 1: OpenAI Images（/v1/images/*、/v1/responses、chat 中转）
    // =======================================================================
    case 'openai_images': {
      const g = config.gptParams
      const v1 = joinV1(baseUrl)

      if (g.endpointMode === 'images_edits_json') {
        const payload: Record<string, any> = {
          model,
          prompt,
          images: allImageRefs.map((ref) => ({ image_url: ref })),
        }
        if (g.size !== 'auto') payload.size = g.size
        if (g.quality !== 'auto') payload.quality = g.quality
        if (g.inputFidelity) payload.input_fidelity = g.inputFidelity
        if (g.background !== 'auto') payload.background = g.background
        if (g.outputFormat) payload.output_format = g.outputFormat
        if (g.moderation !== 'auto') payload.moderation = g.moderation

        res = await smartFetch(
          `${v1}/images/edits`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
            body: JSON.stringify(payload),
          },
          config.useProxy
        )
        json = await res.json()
      } else if (g.endpointMode === 'images_edits') {
        const fd = new FormData()
        fd.append('model', model)
        fd.append('prompt', prompt)
        allImageRefs.forEach((du, i) => {
          fd.append('image[]', dataUrlToBlob(du), `ref_${i + 1}.png`)
        })
        if (g.size !== 'auto') fd.append('size', g.size)
        if (g.quality !== 'auto') fd.append('quality', g.quality)
        if (g.inputFidelity) fd.append('input_fidelity', g.inputFidelity)
        if (g.background !== 'auto') fd.append('background', g.background)
        if (g.outputFormat) fd.append('output_format', g.outputFormat)
        if (g.moderation !== 'auto') fd.append('moderation', g.moderation)

        res = await smartFetch(
          `${v1}/images/edits`,
          { method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: fd },
          config.useProxy
        )
        json = await res.json()
      } else if (g.endpointMode === 'responses') {
        const inputContent = [
          ...allImageRefs.map((ref) => ({ type: 'input_image', image_url: ref })),
          { type: 'input_text', text: prompt },
        ]
        const toolCfg: Record<string, any> = { type: 'image_generation' }
        if (g.size !== 'auto') toolCfg.size = g.size
        if (g.quality !== 'auto') toolCfg.quality = g.quality
        if (g.background !== 'auto') toolCfg.background = g.background
        if (g.inputFidelity) toolCfg.input_fidelity = g.inputFidelity
        if (g.outputFormat) toolCfg.output_format = g.outputFormat

        res = await smartFetch(
          `${v1}/responses`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
            body: JSON.stringify({
              model,
              input: [{ role: 'user', content: inputContent }],
              tools: [toolCfg],
            }),
          },
          config.useProxy
        )
        json = await res.json()
      } else {
        const content = [
          { type: 'text', text: prompt },
          ...allImageRefs.map((ref) => ({ type: 'image_url', image_url: { url: ref } })),
        ]
        res = await smartFetch(
          `${v1}/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content }],
              modalities: ['text', 'image'],
            }),
          },
          config.useProxy
        )
        json = await res.json()
      }
      break
    }

    // =======================================================================
    // 协议 2: Gemini（原生 / OpenAI 兼容中转）
    // =======================================================================
    case 'gemini_native': {
      const gm = config.geminiParams
      if (gm.endpointMode === 'native') {
        const root = baseUrl.replace(/\/v1(?:beta)?$/, '')
        const url = `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(auth)}`
        const parts = [
          ...allImageRefs.map((du) => ({
            inlineData: { mimeType: 'image/png', data: du.split(',')[1] },
          })),
          { text: prompt },
        ]
        const isGemini3 = model.includes('gemini-3')
        const imageConfig: Record<string, string> = { aspectRatio: gm.aspectRatio }
        if (isGemini3 && gm.imageSize) imageConfig.imageSize = gm.imageSize

        res = await smartFetch(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': auth },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig,
              },
            }),
          },
          config.useProxy
        )
        json = await res.json()
      } else {
        const v1 = joinV1(baseUrl)
        const content = [
          { type: 'text', text: `${prompt}\n(Output aspect ratio: ${gm.aspectRatio}, resolution: ${gm.imageSize})` },
          ...allImageRefs.map((ref) => ({ type: 'image_url', image_url: { url: ref } })),
        ]
        res = await smartFetch(
          `${v1}/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
            body: JSON.stringify({ model, messages: [{ role: 'user', content }], modalities: ['text', 'image'] }),
          },
          config.useProxy
        )
        json = await res.json()
      }
      break
    }

    // =======================================================================
    // 协议 3: 阿里云百炼 Qwen-Image
    // =======================================================================
    case 'dashscope': {
      const qw = config.qwenParams
      const endpoint = baseUrl.includes('/services/aigc/')
        ? baseUrl
        : `${baseUrl.replace(/\/api\/v1$/, '')}/api/v1/services/aigc/multimodal-generation/generation`

      const content = [...imageRefs.map((ref) => ({ image: ref })), { text: prompt }]

      res = await smartFetch(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify({
            model,
            input: { messages: [{ role: 'user', content }] },
            parameters: {
              size: qw.size,
              n: qw.n || 1,
              prompt_extend: qw.promptExtend,
              watermark: qw.watermark,
              ...(qw.negativePrompt.trim() ? { negative_prompt: qw.negativePrompt.trim() } : {}),
            },
          }),
        },
        config.useProxy
      )
      json = await res.json()
      break
    }

    // =======================================================================
    // 协议 4: 火山方舟 Doubao Seedream
    // =======================================================================
    case 'ark': {
      const db = config.doubaoParams
      let endpoint = baseUrl
      if (!endpoint.endsWith('/images/generations')) {
        endpoint = endpoint.endsWith('/api/v3') || endpoint.endsWith('/v1')
          ? `${endpoint}/images/generations`
          : `${endpoint}/api/v3/images/generations`
      }

      res = await smartFetch(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify({
            model,
            prompt,
            image: allImageRefs,
            size: db.size,
            sequential_image_generation: db.sequentialImageGeneration,
            watermark: db.watermark,
            response_format: db.responseFormat,
          }),
        },
        config.useProxy
      )
      json = await res.json()
      break
    }

    // =======================================================================
    // 协议 5: MiniMax 海螺 /v1/image_generation
    // subject_reference 每次仅接受 1 张参考图（type 仅 character）
    // =======================================================================
    case 'minimax': {
      const mm = config.minimaxParams
      const endpoint = baseUrl.endsWith('/v1/image_generation')
        ? baseUrl
        : `${baseUrl.replace(/\/v1$/, '')}/v1/image_generation`

      let referenceSrc: string | null = null
      if (mm.referenceMode === 'stitch') {
        referenceSrc = await stitchRecipeCanvas(recipe)
      } else if (mm.referenceMode === 'portrait') {
        referenceSrc =
          (recipe.portrait && (recipe.portrait.原图 || recipe.portrait.缩略图)) || rawSources[0] || null
      } else if (mm.referenceMode === 'first') {
        referenceSrc = rawSources[0] || null
      }

      const subjectReference = referenceSrc
        ? [{ type: 'character', image_file: await srcToPngDataUrl(referenceSrc) }]
        : []

      const seedNum = Number(mm.seed)
      const payload: Record<string, any> = {
        model,
        prompt,
        aspect_ratio: mm.aspectRatio,
        response_format: mm.responseFormat,
        n: mm.n || 1,
        prompt_optimizer: mm.promptOptimizer,
      }
      if (Number.isFinite(seedNum) && mm.seed.trim() !== '') payload.seed = seedNum
      if (subjectReference.length) payload.subject_reference = subjectReference

      res = await smartFetch(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify(payload),
        },
        config.useProxy
      )
      json = await res.json()
      break
    }

    // =======================================================================
    // 协议 6: 自订 JSON 模板
    // =======================================================================
    case 'custom_json': {
      const tpl = p.template
      if (!tpl?.bodyTemplate?.trim()) {
        throw new Error(`「${p.name}」尚未填写请求模板 (bodyTemplate)`)
      }
      const body = renderBodyTemplateSafe(tpl.bodyTemplate, {
        prompt,
        model,
        image_urls: allImageRefs,
        image_url: allImageRefs[0] || '',
        n: 1,
        aspect_ratio: config.minimaxParams.aspectRatio,
      })

      try {
        JSON.parse(body)
      } catch {
        throw new Error('请求模板渲染后不是合法 JSON，请检查占位符与引号')
      }

      res = await smartFetch(
        baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth}`,
            ...parseExtraHeaders(tpl.extraHeaders),
          },
          body,
        },
        config.useProxy
      )
      json = await res.json()

      const picked = parsePath(json, tpl.imagePath || 'data[0].url')
      if (typeof picked === 'string' && picked) {
        return {
          imageUrl: /^https?:\/\//i.test(picked) ? picked : `data:image/png;base64,${picked}`,
          modelUsed: model,
          providerUsed: p.id,
        }
      }
      break
    }

    default:
      throw new Error(`不支持的请求协议：${p.protocol}`)
  }

  if (!res!.ok) {
    const errMsg =
      json?.error?.message ||
      json?.message ||
      json?.code ||
      json?.base_resp?.status_msg ||
      `请求失败 (HTTP ${res!.status})`
    throw new Error(`[${p.shortName}] ${errMsg}`)
  }

  // MiniMax 即使 HTTP 200 也可能在 base_resp 里报错（风控 / 余额 / Key）
  if (typeof json?.base_resp?.status_code === 'number' && json.base_resp.status_code !== 0) {
    throw new Error(`[${p.shortName}] ${json.base_resp.status_msg || `错误码 ${json.base_resp.status_code}`}`)
  }

  const imageUrl = extractUniversalImage(json)
  if (!imageUrl) {
    const fallbackText =
      json?.choices?.[0]?.message?.content ||
      json?.output?.choices?.[0]?.message?.content?.[0]?.text ||
      JSON.stringify(json).slice(0, 260)
    throw new Error(`接口已响应但未解析到图片输出：${fallbackText}`)
  }

  return { imageUrl, modelUsed: model, providerUsed: p.id }
}

/**
 * 用 chat 类供应商（如 Ollama Cloud）改写/扩写提示词。
 * 目前仅支持 OpenAI Chat 兼容协议。
 */
export async function rewritePromptWithChat(params: {
  config: ApiConfig
  providerId: string
  prompt: string
  images?: string[]
  instruction?: string
}): Promise<string> {
  const { config, providerId, prompt, images = [], instruction } = params
  const p = resolveProvider(config, providerId)
  if (!p) throw new Error(`找不到供应商配置：${providerId}`)
  if (p.protocol !== 'openai_chat' && p.protocol !== 'gemini_native') {
    throw new Error(`「${p.name}」不是 OpenAI Chat 兼容协议，暂不支持扩写`)
  }

  const auth = await resolveAuth(p)
  if (!auth) throw new Error(`请先为 ${p.name} 配置 API Key 或完成 OAuth 授权`)

  const imageParts = await Promise.all(images.slice(0, 4).map(srcToPngDataUrl))
  const systemText =
    instruction ||
    '你是资深的 AI 绘画提示词工程师。请把用户给的参考信息改写成一段中文生图提示词：保留人物五官、服装款式、姿势与画风的全部关键细节，去掉“图1/图2”这类指代，改为直接描述；不解释、不加标题、不输出多余内容。'

  const content: any[] = [{ type: 'text', text: prompt }]
  for (const du of imageParts) content.push({ type: 'image_url', image_url: { url: du } })

  const v1 = joinV1(p.baseUrl.replace(/\/+$/, ''))
  const res = await smartFetch(
    `${v1}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content },
        ],
      }),
    },
    config.useProxy
  )
  const json: any = await res.json()
  if (!res.ok) {
    throw new Error(`[${p.shortName}] ${json?.error?.message || `HTTP ${res.status}`}`)
  }
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('提示词扩写未返回文本')
  }
  return text.trim()
}
