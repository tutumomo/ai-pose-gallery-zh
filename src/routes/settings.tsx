import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Field, Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PROVIDER_META } from '@/services/aiGenerator'
import { clearToken, readToken, runDeviceFlow, runPkceFlow, type DeviceFlowPrompt } from '@/services/oauth'
import {
  AUTH_MODE_OPTIONS,
  BUILTIN_IDS,
  emptyOAuthConfig,
  isBuiltinProviderId,
  listProviders,
  newCustomProvider,
  PROTOCOL_OPTIONS,
  resolveProvider,
} from '@/services/providerRegistry'
import { useStudio } from '@/store/studioStore'
import type {
  BuiltinProviderId,
  CustomProvider,
  ImagePassMode,
  ProviderAuthMode,
  ProviderProtocol,
  ProviderPurpose,
} from '@/types/gallery'

export const Route = createFileRoute('/settings')({
  staticData: { title: 'API 配置' },
  component: SettingsPage,
})

const PROVIDER_ORDER: BuiltinProviderId[] = BUILTIN_IDS

function SettingsPage() {
  const {
    apiConfig,
    updateApiConfig,
    updateProviderConfig,
    setActiveProvider,
    setChatProvider,
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider,
  } = useStudio()

  const [tab, setTab] = useState<'builtin' | 'custom'>('builtin')
  const [showKey, setShowKey] = useState(false)
  const [editing, setEditing] = useState<CustomProvider | null>(null)
  const [authorizedIds, setAuthorizedIds] = useState<Record<string, boolean>>({})
  const [devicePrompt, setDevicePrompt] = useState<DeviceFlowPrompt | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const pid: BuiltinProviderId = isBuiltinProviderId(apiConfig.activeProvider)
    ? apiConfig.activeProvider
    : 'gemini'
  const meta = PROVIDER_META[pid]
  const pCfg = apiConfig.providers[pid]

  const refreshTokens = async () => {
    const entries = await Promise.all(
      apiConfig.customProviders.map(async (p) => {
        const token = await readToken(p.id)
        return [p.id, Boolean(token?.accessToken)] as const
      })
    )
    setAuthorizedIds(Object.fromEntries(entries))
  }

  useEffect(() => {
    void refreshTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.customProviders])

  const connectProvider = async (provider: CustomProvider) => {
    const resolved = resolveProvider(apiConfig, provider.id)
    if (!resolved) return
    setConnectingId(provider.id)
    try {
      if (provider.authMode === 'oauth_device') {
        const record = await runDeviceFlow(resolved, (prompt) => setDevicePrompt(prompt))
        setDevicePrompt(null)
        toast.success(`已取得 ${provider.name} 的访问令牌`)
        void record
      } else {
        await runPkceFlow(resolved)
        toast.success(`${provider.name} 授权成功`)
      }
      await refreshTokens()
    } catch (e) {
      setDevicePrompt(null)
      toast.error(e instanceof Error ? e.message : '授权失败')
    } finally {
      setConnectingId(null)
    }
  }

  const disconnectProvider = async (provider: CustomProvider) => {
    await clearToken(provider.id)
    toast.success('已解除授权')
    await refreshTokens()
  }

  const chatOptions = listProviders(apiConfig, 'chat')

  return (
    <>
      <PageHeader
        title="API 接口配置"
        actions={
          <Button size="sm" asChild>
            <Link to="/studio">
              <SparklesIcon className="size-4" />
              返回合成台
            </Link>
          </Button>
        }
      />

      <div className="mb-3 inline-flex rounded-xl border p-0.5">
        {(
          [
            ['builtin', '内置供应商'],
            ['custom', '自订供应商'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3.5 py-1.5 text-xs transition-colors ${
              tab === key ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'builtin' && (
        <>
          {/* 内置协议切换标签 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {PROVIDER_ORDER.map((id) => {
              const itemMeta = PROVIDER_META[id]
              const isActive = pid === id
              const hasKey = Boolean(apiConfig.providers[id].apiKey.trim())
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateApiConfig({ activeProvider: id })}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                    isActive
                      ? 'border-primary bg-primary/6 font-semibold shadow-xs'
                      : 'border-border/60 bg-card hover:bg-muted/40'
                  }`}
                >
                  <span className="truncate text-xs sm:text-sm">{itemMeta.name}</span>
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      hasKey ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    }`}
                    title={hasKey ? '已配置 Key' : '未配置 Key'}
                  />
                </button>
              )
            })}
          </div>

          <Section
            title={`${meta.name} 连接配置`}
            actions={
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" asChild>
                  <a href={meta.docUrl} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon className="size-3.5" />
                    文档
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateProviderConfig(pid, {
                      baseUrl: meta.defaultBaseUrl,
                      model: meta.models[0].value,
                    })
                    toast.success('已恢复默认')
                  }}
                >
                  <RotateCcwIcon className="size-3.5" />
                  重置
                </Button>
              </div>
            }
          >
            <Field label="Base URL">
              <Input
                type="url"
                value={pCfg.baseUrl}
                onChange={(e) => updateProviderConfig(pid, { baseUrl: e.target.value })}
                placeholder={meta.defaultBaseUrl}
              />
            </Field>

            <Field label="API Key">
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={pCfg.apiKey}
                  onChange={(e) => updateProviderConfig(pid, { apiKey: e.target.value })}
                  placeholder="输入 API Key（仅保存在本地浏览器）"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </Field>

            <Field label="默认模型 ID">
              <Select value={pCfg.model} onValueChange={(v) => updateProviderConfig(pid, { model: v })}>
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meta.models.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {pCfg.model === 'custom' && (
              <Field label="自定义模型 ID">
                <Input
                  value={pCfg.customModel}
                  onChange={(e) => updateProviderConfig(pid, { customModel: e.target.value })}
                  placeholder={pid === 'doubao' ? 'ep-2026xxxx 或模型 ID' : '输入模型 ID'}
                  className="font-mono text-xs"
                />
              </Field>
            )}
          </Section>
        </>
      )}

      {tab === 'custom' && (
        <>
          <Section
            title="自订供应商"
            actions={
              <Button size="sm" variant="outline" onClick={() => setEditing(newCustomProvider())}>
                <PlusIcon className="size-3.5" />
                新增供应商
              </Button>
            }
          >
            {apiConfig.customProviders.length === 0 && (
              <p className="text-xs text-muted-foreground">
                还没有自订供应商。可添加任何 OpenAI 兼容 / Gemini / 百炼 / 方舟 / MiniMax 接口，或用「自订 JSON 模板」接入任意厂商。
              </p>
            )}

            <div className="grid gap-2">
              {apiConfig.customProviders.map((p) => {
                const authorized = authorizedIds[p.id]
                const needsOAuth = p.authMode !== 'apiKey'
                const isActive = apiConfig.activeProvider === p.id
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-3 ${isActive ? 'border-primary/60 bg-primary/4' : 'border-border/60'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{p.name || '(未命名)'}</span>
                      <Badge variant="secondary">{p.protocol}</Badge>
                      <Badge variant="outline">{p.purpose === 'chat' ? '文字模型' : '生图'}</Badge>
                      {needsOAuth ? (
                        <Badge variant={authorized ? 'default' : 'outline'}>
                          {authorized ? '已授权' : '未授权'}
                        </Badge>
                      ) : (
                        <Badge variant={p.apiKey ? 'default' : 'outline'}>
                          {p.apiKey ? '已配置 Key' : '未配置 Key'}
                        </Badge>
                      )}
                      {isActive && <Badge>当前供应商</Badge>}
                    </div>
                    <div className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      {p.baseUrl} · {p.model || p.models[0] || '(未指定模型)'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setActiveProvider(p.id)}>
                        <CheckIcon className="size-3.5" />
                        设为当前
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}>
                        <PencilIcon className="size-3.5" />
                        编辑
                      </Button>
                      {needsOAuth && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={connectingId === p.id}
                            onClick={() => void connectProvider(p)}
                          >
                            <PlugZapIcon className="size-3.5" />
                            {connectingId === p.id ? '授权中…' : authorized ? '重新授权' : '连接'}
                          </Button>
                          {authorized && (
                            <Button size="sm" variant="ghost" onClick={() => void disconnectProvider(p)}>
                              <KeyRoundIcon className="size-3.5" />
                              解除授权
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeCustomProvider(p.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                        删除
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="提示词扩写">
            <Field label="文字模型供应商">
              <Select
                value={apiConfig.chatProviderId ?? 'none'}
                onValueChange={(v) => setChatProvider(v === 'none' ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="未启用" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未启用</SelectItem>
                  {chatOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              需先新增一个「文字模型」用途的 OpenAI Chat 兼容供应商（例如 Ollama Cloud：
              <span className="font-mono"> https://ollama.com/v1</span>）。设置后合成台会出现「AI 扩写提示词」。
            </p>
          </Section>
        </>
      )}

      {/* 全局传输设置 */}
      <Section title="全局请求选项">
        <Field label="参考图传参方式">
          <Select
            value={apiConfig.imagePassMode}
            onValueChange={(v) => updateApiConfig({ imagePassMode: v as ImagePassMode })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">传递图片 URL（免上传文件，推荐）</SelectItem>
              <SelectItem value="base64">转 Base64 编码传输</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="服务端 CORS 代理 (/api/proxy)">
          <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
            <span className="text-xs text-muted-foreground">
              {apiConfig.useProxy ? '已启用（解决跨域限制）' : '已关闭（浏览器直连）'}
            </span>
            <Switch
              checked={apiConfig.useProxy}
              onCheckedChange={(v) => updateApiConfig({ useProxy: v })}
            />
          </div>
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => toast.success('配置已保存')}>
          <CheckIcon className="size-4" />
          保存配置
        </Button>
      </div>

      {editing && (
        <ProviderEditor
          value={editing}
          isNew={!apiConfig.customProviders.some((p) => p.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            if (apiConfig.customProviders.some((p) => p.id === next.id)) {
              updateCustomProvider(next.id, next)
              toast.success('已更新供应商')
            } else {
              addCustomProvider(next)
            }
            setEditing(null)
          }}
        />
      )}

      <Dialog open={Boolean(devicePrompt)} onOpenChange={(open) => !open && setDevicePrompt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>完成设备授权</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>在浏览器中打开下面的地址，并输入验证码：</p>
            <a
              href={devicePrompt?.verificationUri}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-xs text-primary underline"
            >
              {devicePrompt?.verificationUri}
            </a>
            <div className="rounded-xl border bg-muted/40 py-3 text-center font-mono text-2xl tracking-[0.3em]">
              {devicePrompt?.userCode}
            </div>
            <p className="text-xs text-muted-foreground">授权完成后本窗口会自动关闭。</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProviderEditor({
  value,
  isNew,
  onSave,
  onClose,
}: {
  value: CustomProvider
  isNew: boolean
  onSave: (next: CustomProvider) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<CustomProvider>(value)
  const set = (patch: Partial<CustomProvider>) => setDraft((prev) => ({ ...prev, ...patch }))
  const oauth = draft.oauth ?? emptyOAuthConfig()
  const template = draft.template ?? { bodyTemplate: '', imagePath: '', extraHeaders: '' }
  const setOAuth = (patch: Partial<typeof oauth>) => set({ oauth: { ...oauth, ...patch } })
  const setTemplate = (patch: Partial<typeof template>) => set({ template: { ...template, ...patch } })

  const save = () => {
    if (!draft.name.trim()) {
      toast.error('请填写供应商名称')
      return
    }
    if (!draft.baseUrl.trim()) {
      toast.error('请填写 Base URL')
      return
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      models: draft.models.map((m) => m.trim()).filter(Boolean),
      model: draft.model.trim() || draft.models[0]?.trim() || '',
      oauth: draft.authMode === 'apiKey' ? undefined : oauth,
      template: draft.protocol === 'custom_json' ? template : undefined,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '新增供应商' : '编辑供应商'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">
            名称
            <Input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="例如 Ollama Cloud"
              className="mt-1"
            />
          </label>

          <label className="text-xs font-medium">
            用途
            <Select
              value={draft.purpose}
              onValueChange={(v) => set({ purpose: v as ProviderPurpose })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">生图</SelectItem>
                <SelectItem value="chat">文字模型（提示词扩写）</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium">
            请求协议
            <Select
              value={draft.protocol}
              onValueChange={(v) => set({ protocol: v as ProviderProtocol })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOL_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — {p.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium">
            认证方式
            <Select
              value={draft.authMode}
              onValueChange={(v) => set({ authMode: v as ProviderAuthMode })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_MODE_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium sm:col-span-2">
            Base URL
            <Input
              value={draft.baseUrl}
              onChange={(e) => set({ baseUrl: e.target.value })}
              placeholder="https://ollama.com/v1"
              className="mt-1 font-mono text-xs"
            />
          </label>

          <label className="text-xs font-medium sm:col-span-2">
            模型 ID（逗号分隔，第一项为默认）
            <Input
              value={draft.models.join(', ')}
              onChange={(e) => set({ models: e.target.value.split(',').map((m) => m.trim()) })}
              placeholder="gpt-oss:120b, kimi-k3"
              className="mt-1 font-mono text-xs"
            />
          </label>

          <label className="text-xs font-medium sm:col-span-2">
            默认模型
            <Input
              value={draft.model}
              onChange={(e) => set({ model: e.target.value })}
              placeholder={draft.models[0] || '留空则用第一项'}
              className="mt-1 font-mono text-xs"
            />
          </label>

          {draft.authMode === 'apiKey' && (
            <label className="text-xs font-medium sm:col-span-2">
              API Key
              <Input
                type="password"
                value={draft.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder="仅保存在本地浏览器"
                className="mt-1"
              />
            </label>
          )}

          {draft.authMode !== 'apiKey' && (
            <div className="space-y-3 rounded-xl border p-3 sm:col-span-2">
              <div className="text-xs font-semibold">OAuth 設定</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Client ID
                  <Input
                    value={oauth.clientId}
                    onChange={(e) => setOAuth({ clientId: e.target.value })}
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium">
                  Scopes
                  <Input
                    value={oauth.scopes}
                    onChange={(e) => setOAuth({ scopes: e.target.value })}
                    placeholder="read:user repo"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  Authorize URL
                  <Input
                    value={oauth.authorizeUrl}
                    onChange={(e) => setOAuth({ authorizeUrl: e.target.value })}
                    placeholder="https://github.com/login/oauth/authorize"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  Token URL
                  <Input
                    value={oauth.tokenUrl}
                    onChange={(e) => setOAuth({ tokenUrl: e.target.value })}
                    placeholder="https://github.com/login/oauth/access_token"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  Device Code URL（Device 流程用）
                  <Input
                    value={oauth.deviceCodeUrl}
                    onChange={(e) => setOAuth({ deviceCodeUrl: e.target.value })}
                    placeholder="https://github.com/login/device/code"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium">
                  Token 兑换位置
                  <Select
                    value={oauth.tokenExchange}
                    onValueChange={(v) => setOAuth({ tokenExchange: v as 'browser' | 'server' })}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="server">服务端 /api/oauth/token（带 secret，推荐）</SelectItem>
                      <SelectItem value="browser">浏览器直连（常被 CORS 挡）</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-medium">
                  Client Secret 環境變數名
                  <Input
                    value={oauth.clientSecretEnv}
                    onChange={(e) => setOAuth({ clientSecretEnv: e.target.value })}
                    placeholder="GITHUB_OAUTH_SECRET"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  附加授權參數
                  <Input
                    value={oauth.extraAuthParams}
                    onChange={(e) => setOAuth({ extraAuthParams: e.target.value })}
                    placeholder="audience=xxx&prompt=consent"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                服务端兑换需在 Cloudflare 设置同名 secret，并把 token 域名加进
                <span className="font-mono"> OAUTH_TOKEN_HOSTS </span>
                白名单，否则 /api/oauth/token 会回 403。
              </p>
            </div>
          )}

          {draft.protocol === 'custom_json' && (
            <div className="space-y-3 rounded-xl border p-3 sm:col-span-2">
              <div className="text-xs font-semibold">JSON 模板</div>
              <label className="block text-xs font-medium">
                请求 Body
                <Textarea
                  value={template.bodyTemplate}
                  onChange={(e) => setTemplate({ bodyTemplate: e.target.value })}
                  rows={6}
                  className="mt-1 font-mono text-xs"
                  placeholder='{"model":"{{model}}","prompt":"{{prompt}}","image":"{{image_url}}"}'
                />
              </label>
              <label className="block text-xs font-medium">
                取图路径
                <Input
                  value={template.imagePath}
                  onChange={(e) => setTemplate({ imagePath: e.target.value })}
                  placeholder="data[0].url 或 data.image_urls[0]"
                  className="mt-1 font-mono text-xs"
                />
              </label>
              <label className="block text-xs font-medium">
                额外 Headers（每行 Key: Value）
                <Textarea
                  value={template.extraHeaders}
                  onChange={(e) => setTemplate({ extraHeaders: e.target.value })}
                  rows={3}
                  className="mt-1 font-mono text-xs"
                  placeholder="X-Api-Version: 2"
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                可用占位符：<span className="font-mono">{'{{prompt}} {{model}} {{image_urls}} {{image_url}} {{n}} {{aspect_ratio}}'}</span>。
                字符串占位符建议写成带引号的 <span className="font-mono">&quot;{'{{prompt}}'}&quot;</span>。
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{isNew ? '添加' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
