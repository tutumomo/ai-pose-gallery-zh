export interface PoseItem {
  id: string
  体系: string
  姿势编号: string
  分类: string
  姿势名称: string
  角度: string
  缩略图: string
  原图: string
  检索: string
}

export interface PoseGroup {
  key: string
  system: string
  number: string
  name: string
  category: string
  items: PoseItem[]
  angles: Record<string, PoseItem>
  order: PoseItem[]
}

export interface CostumeItem {
  id: string
  分类: string
  原分类: string
  服装名称: string
  标签: string[]
  关键词: string
  缩略图: string
  预览图: string
  原图: string
  检索: string
}

export interface PortraitItem {
  id: string
  分区: string
  原分区: string
  发长: string
  原发长: string
  发型名称: string
  原发型: string
  标题: string
  宽: number
  高: number
  字节数: number
  精选: boolean
  热门: boolean
  缩略图: string
  原图: string
  检索: string
}

export interface ExtraReferenceImage {
  id: string
  name: string
  url: string
}

export interface RecipeState {
  portrait: PortraitItem | null
  costume: CostumeItem | null
  pose: PoseItem | null
  extraImages?: ExtraReferenceImage[]
}

export type BuiltinProviderId = 'gemini' | 'gpt' | 'qwen' | 'doubao' | 'minimax'
/** 內建供應商 id；自訂供應商使用任意字串 id */
export type ImageProviderId = BuiltinProviderId

/** 請求協議：決定 generateCharacterImage 走哪條分支，與「是哪一家」解耦 */
export type ProviderProtocol =
  | 'gemini_native'
  | 'openai_images'
  | 'openai_chat'
  | 'dashscope'
  | 'ark'
  | 'minimax'
  | 'custom_json'

export type ProviderAuthMode = 'apiKey' | 'oauth_pkce' | 'oauth_device' | 'none'

export type ProviderPurpose = 'image' | 'chat'

/** custom_json 協議：使用者自填請求模板 */
export interface CustomJsonTemplate {
  /** JSON 字串，可用 "{{prompt}}" "{{model}}" "{{image_urls}}" "{{image_url}}" "{{n}}" "{{aspect_ratio}}" 佔位符 */
  bodyTemplate: string
  /** 取圖路徑，如 data.image_urls[0] / data[0].url */
  imagePath: string
  /** 每行一個 Key: Value */
  extraHeaders: string
}

export interface CustomProviderOAuth {
  flow: 'pkce' | 'device'
  authorizeUrl: string
  tokenUrl: string
  deviceCodeUrl: string
  clientId: string
  scopes: string
  /** 附加在授權 URL 的 query，如 audience=xxx&prompt=consent */
  extraAuthParams: string
  tokenAuthStyle: 'body' | 'basic'
  /** browser = 前端直接換 token（多數廠商會被 CORS 擋）；server = 走 /api/oauth/token 由後端帶 secret */
  tokenExchange: 'browser' | 'server'
  /** server 模式下 Worker 環境變數名稱（存 client_secret） */
  clientSecretEnv: string
}

export interface CustomProvider {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  /** 可用模型 ID 清單，第一項為預設 */
  models: string[]
  /** 已選模型；空字串表示用 models[0] */
  model: string
  purpose: ProviderPurpose
  authMode: ProviderAuthMode
  apiKey: string
  oauth?: CustomProviderOAuth
  template?: CustomJsonTemplate
  createdAt: number
}

export interface OAuthTokenRecord {
  providerId: string
  accessToken: string
  refreshToken?: string
  tokenType: string
  /** epoch ms；0 表示不設到期 */
  expiresAt: number
}

export interface ProviderEndpointConfig {
  baseUrl: string
  apiKey: string
  model: string
  customModel: string
}

export type ImagePassMode = 'url' | 'base64'

export interface GptParams {
  endpointMode: 'images_edits_json' | 'images_edits' | 'responses' | 'chat'
  size: 'auto' | '1024x1536' | '1024x1024' | '1536x1024'
  quality: 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  inputFidelity: 'high' | 'low'
  background: 'auto' | 'opaque' | 'transparent'
  outputFormat: 'png' | 'jpeg' | 'webp'
  moderation: 'auto' | 'low'
}

export interface GeminiParams {
  endpointMode: 'native' | 'openai_chat'
  aspectRatio: '3:4' | '1:1' | '4:3' | '9:16' | '16:9'
  imageSize: '1K' | '2K' | '4K'
}

export interface QwenParams {
  size: '1024*1536' | '1328*1328' | '928*1664' | '1664*928'
  promptExtend: boolean
  watermark: boolean
  negativePrompt: string
  n: number
}

export interface DoubaoParams {
  size: '2K' | '4K' | '1K' | '1728x2304' | '2048x2048' | '1440x2560' | '2560x1440'
  sequentialImageGeneration: 'disabled' | 'auto'
  watermark: boolean
  responseFormat: 'b64_json' | 'url'
}

export interface MinimaxParams {
  // MiniMax image-01 单次仅接受 1 张 subject_reference，需要自行决定送哪张
  referenceMode: 'portrait' | 'stitch' | 'first' | 'none'
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2' | '21:9'
  responseFormat: 'url' | 'base64'
  promptOptimizer: boolean
  n: number
  seed: string
}

export interface ApiConfig {
  /** 內建 id 或自訂供應商 id */
  activeProvider: string
  imagePassMode: ImagePassMode
  useProxy: boolean
  stylePreset: string
  sendStitchedSheet: boolean
  providers: Record<ImageProviderId, ProviderEndpointConfig>
  gptParams: GptParams
  geminiParams: GeminiParams
  qwenParams: QwenParams
  doubaoParams: DoubaoParams
  minimaxParams: MinimaxParams
  customProviders: CustomProvider[]
  /** 提示詞擴寫（purpose: 'chat'）使用的供應商 id */
  chatProviderId: string | null
}

export interface GenerationHistoryItem {
  id: string
  createdAt: number
  provider: string
  model: string
  prompt: string
  imageUrl: string
  recipeSummary: string
}
