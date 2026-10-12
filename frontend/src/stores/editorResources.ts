import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getStorageEngineConfig,
  getStorageEngineStatus,
  getPromptTemplates,
  getParserEngines,
  getSystemInfo,
  type PromptTemplatesConfig,
  type StorageEngineStatusItem,
  type ParserEngineInfo,
  type SystemInfo,
} from '@/api/system'
import { getTenantRetrievalConfig } from '@/api/retrieval'
import { isStorageConfigDenied } from './storageEngineAccess'
import { createCachedResource } from './resourceCache'

export function pickUsableStorageProvider(
  candidate: string | undefined,
  engines: StorageEngineStatusItem[],
  allowedProviders: string[],
): string {
  const provider = candidate?.trim() || ''
  const isUsable = (name: string) => {
    if (!name) return false
    const status = engines.find((item) => item.name === name)
    if (status) return status.allowed !== false && status.available !== false
    if (engines.length > 0) return false
    if (allowedProviders.length > 0) return allowedProviders.includes(name)
    return false
  }

  if (isUsable(provider)) return provider
  const fallback = engines.find((item) => item.allowed !== false && item.available !== false)?.name
  if (fallback) return fallback
  return allowedProviders[0] || provider || 'local'
}

type EditorResourceKey =
  | 'storageEngine'
  | 'promptTemplates'
  | 'tenantRetrievalConfig'
  | 'parserEngines'
  | 'systemInfo'

/**
 * 知识库 / 设置页面共用的配置类资源快照。
 * 无 TTL，每次 ensure 发一次请求（并发共用），写操作后显式 `ensureX(true)` 或 `invalidate()`。
 */
export const useEditorResourcesStore = defineStore('editorResources', () => {
  const storageConfig = ref<Awaited<ReturnType<typeof getStorageEngineConfig>>['data'] | null>(null)
  const storageStatus = ref<StorageEngineStatusItem[]>([])
  const storageAllowedProviders = ref<string[]>([])
  const promptTemplates = ref<PromptTemplatesConfig | null>(null)
  const tenantRetrievalConfig = ref<Record<string, unknown> | null>(null)
  const parserEngines = ref<ParserEngineInfo[]>([])
  const systemInfo = ref<SystemInfo | null>(null)

  const storageEngineResource = createCachedResource(
    async () => {
      const [configRes, statusRes] = await Promise.all([
        // The config endpoint is admin-only (it carries integration secrets),
        // while every creator — Contributors included — needs the status list
        // to pick a usable provider. A permission rejection on the config
        // call must therefore degrade to "no admin config", not break the
        // whole editor dependency chain (#2991).
        getStorageEngineConfig().catch((error: unknown) => {
          if (isStorageConfigDenied(error)) return null
          throw error
        }),
        getStorageEngineStatus(),
      ])
      return { configRes, statusRes }
    },
    ({ configRes, statusRes }) => {
      storageConfig.value = configRes?.data ?? null
      storageStatus.value = statusRes?.data?.engines ?? []
      storageAllowedProviders.value = statusRes?.data?.allowed_providers ?? []
    },
  )

  const promptTemplatesResource = createCachedResource(
    async () => {
      const tmplRes = await getPromptTemplates()
      return tmplRes?.data ?? null
    },
    (config) => {
      promptTemplates.value = config
    },
  )

  const tenantRetrievalConfigResource = createCachedResource(
    async () => {
      const retrievalRes: any = await getTenantRetrievalConfig()
      return (retrievalRes?.data ?? null) as Record<string, unknown> | null
    },
    (config) => {
      tenantRetrievalConfig.value = config
    },
  )

  const parserEnginesResource = createCachedResource(
    async () => {
      const resp = await getParserEngines()
      return resp?.data && Array.isArray(resp.data) ? resp.data : []
    },
    (rows) => {
      parserEngines.value = rows
    },
  )

  const systemInfoResource = createCachedResource(
    async () => {
      const response = await getSystemInfo()
      return response?.data ?? null
    },
    (info) => {
      systemInfo.value = info
    },
  )

  const resources: Record<EditorResourceKey, ReturnType<typeof createCachedResource>> = {
    storageEngine: storageEngineResource,
    promptTemplates: promptTemplatesResource,
    tenantRetrievalConfig: tenantRetrievalConfigResource,
    parserEngines: parserEnginesResource,
    systemInfo: systemInfoResource,
  }

  async function ensureStorageEngine(force = false): Promise<void> {
    return storageEngineResource.ensure(force)
  }

  function resolveUsableStorageProvider(candidate?: string): string {
    return pickUsableStorageProvider(
      candidate,
      storageStatus.value || [],
      storageAllowedProviders.value || [],
    )
  }

  async function ensurePromptTemplates(force = false): Promise<void> {
    return promptTemplatesResource.ensure(force)
  }

  async function ensureTenantRetrievalConfig(force = false): Promise<void> {
    return tenantRetrievalConfigResource.ensure(force)
  }

  async function ensureParserEngines(force = false): Promise<void> {
    return parserEnginesResource.ensure(force)
  }

  async function ensureSystemInfo(force = false): Promise<void> {
    return systemInfoResource.ensure(force)
  }

  function invalidate(...keys: EditorResourceKey[]) {
    if (keys.length === 0) {
      ;(Object.keys(resources) as EditorResourceKey[]).forEach((k) => resources[k].invalidate())
      storageConfig.value = null
      storageStatus.value = []
      storageAllowedProviders.value = []
      promptTemplates.value = null
      tenantRetrievalConfig.value = null
      parserEngines.value = []
      systemInfo.value = null
      return
    }
    keys.forEach((k) => resources[k].invalidate())
  }

  return {
    storageConfig,
    storageStatus,
    storageAllowedProviders,
    promptTemplates,
    tenantRetrievalConfig,
    parserEngines,
    systemInfo,
    ensureStorageEngine,
    resolveUsableStorageProvider,
    ensurePromptTemplates,
    ensureTenantRetrievalConfig,
    ensureParserEngines,
    ensureSystemInfo,
    invalidate,
  }
})
