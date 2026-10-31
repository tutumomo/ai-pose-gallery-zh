import type {
  ApiConfig,
  BuiltinProviderId,
  CustomJsonTemplate,
  CustomProvider,
  CustomProviderOAuth,
  ProviderAuthMode,
  ProviderProtocol,
  ProviderPurpose,
} from '@/types/gallery'

export interface ProviderModelOption {
  value: string
  label: string
}

export interface ProviderMetaEntry {
  id: BuiltinProviderId
  name: string
  shortName: string
  defaultBaseUrl: string
  docUrl: string
  protocol: ProviderProtocol
  models: ProviderModelOption[]
}

/** 內建供應商靜態資訊（不可刪除，可改 Key / Base URL / 模型） */
export const PROVIDER_META: Record<BuiltinProviderId, ProviderMetaEntry> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    docUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    protocol: 'gemini_native',
    models: [
      { value: 'gemini-3.1-flash-image-preview', label: 'gemini-3.1-flash-image-preview' },
      { value: 'gemini-3-pro-image-preview', label: 'gemini-3-pro-image-preview' },
      { value: 'gemini-2.5-flash-image', label: 'gemini-2.5-flash-image' },
      { value: 'gemini-2.5-flash-image-preview', label: 'gemini-2.5-flash-image-preview' },
      { value: 'custom', label: '自定义模型 ID' },
    ],
  },
  gpt: {
    id: 'gpt',
    name: 'OpenAI GPT Image',
    shortName: 'GPT',
    defaultBaseUrl: 'https://api.openai.com/v1',
    docUrl: 'https://platform.openai.com/docs/guides/image-generation',
    protocol: 'openai_images',
    models: [
      { value: 'gpt-image-2.5', label: 'gpt-image-2.5' },
      { value: 'gpt-image-2.5-sunburst', label: 'gpt-image-2.5-sunburst' },
      { value: 'gpt-image-2.5-flare', label: 'gpt-image-2.5-flare' },
      { value: 'gpt-image-2', label: 'gpt-image-2' },
      { value: 'gpt-image-1.5', label: 'gpt-image-1.5' },
      { value: 'gpt-image-1', label: 'gpt-image-1' },
      { value: 'custom', label: '自定义模型 ID' },
    ],
  },
  qwen: {
    id: 'qwen',
    name: '阿里云百炼 Qwen',
    shortName: 'Qwen',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    docUrl: 'https://help.aliyun.com/zh/model-studio/qwen-image-edit-api',
    protocol: 'dashscope',
    models: [
      { value: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro' },
      { value: 'qwen-image-2.1-pro', label: 'qwen-image-2.1-pro' },
      { value: 'qwen-image-2.1-turbo', label: 'qwen-image-2.1-turbo' },
      { value: 'qwen-image-2.0-pro', label: 'qwen-image-2.0-pro' },
      { value: 'qwen-image-edit-plus', label: 'qwen-image-edit-plus' },
      { value: 'custom', label: '自定义模型 ID' },
    ],
  },
  doubao: {
    id: 'doubao',
    name: '字节火山方舟 Doubao',
    shortName: 'Doubao',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com',
    docUrl: 'https://www.volcengine.com/docs/82379/1541523',
    protocol: 'ark',
    models: [
      { value: 'doubao-seedream-5-0', label: 'doubao-seedream-5-0' },
      { value: 'doubao-seedream-5-0-lite', label: 'doubao-seedream-5-0-lite' },
      { value: 'doubao-seedream-4-5-251128', label: 'doubao-seedream-4-5-251128' },
      { value: 'doubao-seedream-4-0-250828', label: 'doubao-seedream-4-0-250828' },
      { value: 'doubao-seededit-3-0-i2i-250628', label: 'doubao-seededit-3-0-i2i-250628' },
      { value: 'custom', label: '自定义模型 ID / Endpoint' },
    ],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax 海螺',
    shortName: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.io',
    docUrl: 'https://platform.minimax.io/docs/api-reference/image-generation-i2i',
    protocol: 'minimax',
    models: [
      { value: 'image-01', label: 'image-01' },
      { value: 'image-01-live', label: 'image-01-live' },
      { value: 'custom', label: '自定义模型 ID' },
    ],
  },
}

export const BUILTIN_IDS: BuiltinProviderId[] = ['gemini', 'gpt', 'qwen', 'doubao', 'minimax']

export function isBuiltinProviderId(id: string): id is BuiltinProviderId {
  return (BUILTIN_IDS as string[]).includes(id)
}

/** 協議清單，供自訂供應商表單使用 */
export const PROTOCOL_OPTIONS: Array<{
  value: ProviderProtocol
  label: string
  hint: string
}> = [
  { value: 'openai_images', label: 'OpenAI Images', hint: '/v1/images/edits、/v1/images/generations' },
  { value: 'openai_chat', label: 'OpenAI Chat 相容', hint: '/v1/chat/completions（含 Ollama Cloud）' },
  { value: 'gemini_native', label: 'Gemini Native', hint: ':generateContent' },
  { value: 'dashscope', label: '阿里百炼 DashScope', hint: 'multimodal-generation' },
  { value: 'ark', label: '火山方舟 Ark', hint: '/api/v3/images/generations' },
  { value: 'minimax', label: 'MiniMax 海螺', hint: '/v1/image_generation' },
  { value: 'custom_json', label: '自訂 JSON 模板', hint: '完全自填 body 與取圖路徑' },
]

export const AUTH_MODE_OPTIONS: Array<{ value: ProviderAuthMode; label: string }> = [
  { value: 'apiKey', label: 'API Key' },
  { value: 'none', label: '不驗證（本機 gateway / agy）' },
  { value: 'oauth_pkce', label: 'OAuth 授權碼 + PKCE' },
  { value: 'oauth_device', label: 'OAuth Device Code' },
]

export interface ResolvedProvider {
  id: string
  name: string
  shortName: string
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  authMode: ProviderAuthMode
  apiKey: string
  oauth?: CustomProviderOAuth
  template?: CustomJsonTemplate
  purpose: ProviderPurpose
  isBuiltin: boolean
}

export interface ProviderOption {
  id: string
  name: string
  protocol: ProviderProtocol
  purpose: ProviderPurpose
  isBuiltin: boolean
}

export function resolveBuiltinModel(config: ApiConfig, id: BuiltinProviderId): string {
  const pCfg = config.providers[id]
  return pCfg.model === 'custom' ? pCfg.customModel.trim() : pCfg.model
}

export function resolveProvider(config: ApiConfig, id: string): ResolvedProvider | null {
  if (isBuiltinProviderId(id)) {
    const meta = PROVIDER_META[id]
    const pCfg = config.providers[id]
    return {
      id,
      name: meta.name,
      shortName: meta.shortName,
      protocol: meta.protocol,
      baseUrl: pCfg.baseUrl.trim() || meta.defaultBaseUrl,
      model: resolveBuiltinModel(config, id),
      authMode: 'apiKey',
      apiKey: pCfg.apiKey.trim(),
      purpose: 'image',
      isBuiltin: true,
    }
  }

  const custom: CustomProvider | undefined = (config.customProviders || []).find((p) => p.id === id)
  if (!custom) return null

  return {
    id: custom.id,
    name: custom.name,
    shortName: custom.name,
    protocol: custom.protocol,
    baseUrl: custom.baseUrl.trim().replace(/\/+$/, ''),
    model: custom.model.trim() || custom.models[0] || '',
    authMode: custom.authMode,
    apiKey: (custom.apiKey || '').trim(),
    oauth: custom.oauth,
    template: custom.template,
    purpose: custom.purpose,
    isBuiltin: false,
  }
}

/** 目前可選供應商（內建在前、自訂在後），可依用途過濾 */
export function listProviders(config: ApiConfig, purpose?: ProviderPurpose): ProviderOption[] {
  const builtins: ProviderOption[] = BUILTIN_IDS.map((id) => {
    const meta = PROVIDER_META[id]
    return {
      id,
      name: meta.name,
      protocol: meta.protocol,
      purpose: 'image' as ProviderPurpose,
      isBuiltin: true,
    }
  })

  const customs: ProviderOption[] = (config.customProviders || []).map((p) => ({
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    purpose: p.purpose,
    isBuiltin: false,
  }))

  const all = [...builtins, ...customs]
  return purpose ? all.filter((p) => p.purpose === purpose) : all
}

export function createCustomProviderId(): string {
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function emptyOAuthConfig(): CustomProviderOAuth {
  return {
    flow: 'pkce',
    authorizeUrl: '',
    tokenUrl: '',
    deviceCodeUrl: '',
    clientId: '',
    scopes: '',
    extraAuthParams: '',
    tokenAuthStyle: 'body',
    tokenExchange: 'server',
    clientSecretEnv: '',
  }
}

export interface CustomProviderPreset {
  id: string
  label: string
  apply: (p: CustomProvider) => CustomProvider
}

/** 常用第三方服务的快速范本（含本机 magpie 闸道） */
export const CUSTOM_PROVIDER_PRESETS: CustomProviderPreset[] = [
  {
    id: 'magpie-image',
    label: 'magpie 本机闸道 · 生图',
    apply: (p) => ({
      ...p,
      name: 'magpie 生图',
      protocol: 'openai_images',
      baseUrl: 'http://127.0.0.1:8788/v1',
      models: ['workbuddy-ai/hy-image-3.5'],
      model: 'workbuddy-ai/hy-image-3.5',
      purpose: 'image',
      authMode: 'none',
      apiKey: '',
    }),
  },
  {
    id: 'magpie-antigravity',
    label: 'magpie · Antigravity（Google Pro 额度）',
    apply: (p) => ({
      ...p,
      name: 'Antigravity 文字',
      protocol: 'openai_chat',
      baseUrl: 'http://127.0.0.1:8788/v1',
      models: ['antigravity/gemini-4-argon', 'antigravity/claude-opus-5-5'],
      model: 'antigravity/gemini-4-argon',
      purpose: 'chat',
      authMode: 'none',
      apiKey: '',
    }),
  },
  {
    id: 'agy-antigravity',
    label: 'agy Antigravity（Google Pro 额度）',
    apply: (p) => ({
      ...p,
      name: 'Antigravity（agy）',
      protocol: 'openai_chat',
      baseUrl: 'http://127.0.0.1:8788/agy/v1',
      models: [
        'gemini-4-argon-high',
        'magpie/antigravity/gemini-4-argon',
        'magpie/antigravity/claude-sonnet-5-5',
        'magpie/group/gemini',
      ],
      model: 'gemini-4-argon-high',
      purpose: 'chat',
      authMode: 'none',
      apiKey: '',
    }),
  },
  {
    id: 'ollama-cloud',
    label: 'Ollama Cloud · 文字',
    apply: (p) => ({
      ...p,
      name: 'Ollama Cloud',
      protocol: 'openai_chat',
      baseUrl: 'https://ollama.com/v1',
      models: ['gpt-oss:120b'],
      model: 'gpt-oss:120b',
      purpose: 'chat',
      authMode: 'apiKey',
    }),
  },
  {
    id: 'minimax',
    label: 'MiniMax 生图',
    apply: (p) => ({
      ...p,
      name: 'MiniMax 生图',
      protocol: 'minimax',
      baseUrl: 'https://api.minimax.io',
      models: ['image-01', 'image-01-live'],
      model: 'image-01',
      purpose: 'image',
      authMode: 'apiKey',
    }),
  },
]

export function newCustomProvider(): CustomProvider {
  return {
    id: createCustomProviderId(),
    name: '',
    protocol: 'openai_chat',
    baseUrl: '',
    models: [],
    model: '',
    purpose: 'image',
    authMode: 'apiKey',
    apiKey: '',
    template: {
      bodyTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","image":"{{image_url}}"}',
      imagePath: 'data[0].url',
      extraHeaders: '',
    },
    createdAt: Date.now(),
  }
}
