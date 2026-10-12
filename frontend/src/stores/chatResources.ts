import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listKnowledgeBases, getKnowledgeBaseById } from '@/api/knowledge-base'
import { listModels, type ModelConfig } from '@/api/model'
import { listWebSearchProviders, type WebSearchProviderEntity } from '@/api/web-search-provider'
import { useOrganizationStore } from '@/stores/organization'
import { createCachedResource, createKeyedSnapshotCache } from './resourceCache'

type ResourceKey = 'knowledgeBases' | 'models' | 'webSearchProviders'

export type ListCreatorFilter = 'all' | 'mine' | 'others'

function isKbModelReady(kb: any): boolean {
  if (!kb.summary_model_id || kb.summary_model_id === '') return false
  const strategy = kb.indexing_strategy
  const needsEmbedding = !strategy || strategy.vector_enabled || strategy.keyword_enabled
  if (needsEmbedding && (!kb.embedding_model_id || kb.embedding_model_id === '')) return false
  return true
}

/**
 * 空间级资源（知识库 / 模型 / 联网搜索）的共享快照。
 *
 * 没有 TTL：每次 `ensureX()` 都会发请求（同一时刻只有一个在飞行，挂载突发共用它），
 * 写操作之后由调用方 `ensureX(true)`、`replaceModels()` 或 `invalidate()` 显式刷新。
 * 页面直接读这里的 ref 渲染，旧快照在新数据到达前先撑着。
 */
export const useChatResourcesStore = defineStore('chatResources', () => {
  const rawKnowledgeBases = ref<any[]>([])
  const allModels = ref<ModelConfig[]>([])
  const webSearchProviders = ref<WebSearchProviderEntity[]>([])

  const validKnowledgeBases = computed(() => rawKnowledgeBases.value.filter(isKbModelReady))

  const knowledgeBasesResource = createCachedResource(
    async () => {
      const res: any = await listKnowledgeBases()
      return res?.data && Array.isArray(res.data) ? (res.data as any[]) : []
    },
    (data) => {
      rawKnowledgeBases.value = data
    },
  )

  const modelsResource = createCachedResource(
    async () => {
      const models = await listModels()
      return Array.isArray(models) ? models : []
    },
    (models) => {
      allModels.value = models
    },
  )

  const webSearchProvidersResource = createCachedResource(
    async () => {
      const response = await listWebSearchProviders()
      const providers = (response as any)?.data
      return Array.isArray(providers) ? (providers as WebSearchProviderEntity[]) : []
    },
    (providers) => {
      webSearchProviders.value = providers
    },
  )

  const resources: Record<ResourceKey, ReturnType<typeof createCachedResource>> = {
    knowledgeBases: knowledgeBasesResource,
    models: modelsResource,
    webSearchProviders: webSearchProvidersResource,
  }

  // 单个知识库详情：拿到过就一直用，直到显式失效。
  const kbDetailCache = createKeyedSnapshotCache(async (kbId: string) => {
    try {
      const res: any = await getKnowledgeBaseById(kbId)
      return res?.data ?? null
    } catch {
      return null
    }
  })

  /** 是否已有快照（区别于「是否新鲜」：本 store 不再有新鲜度窗口）。 */
  function isLoaded(key: ResourceKey): boolean {
    return resources[key].isLoaded()
  }

  /**
   * 知识库列表（支持 creator 筛选）。creator=all 走共享快照。
   */
  async function fetchKnowledgeBasesForList(
    params?: { creator?: ListCreatorFilter },
    force = false,
  ): Promise<any[]> {
    const creator = params?.creator ?? 'all'
    // 带 creator 过滤的列表是列表页专用、不进快照，直接透传请求。
    // 写操作后的强刷同时把全量快照刷一遍。
    if (creator !== 'all') {
      if (force) void ensureKnowledgeBases(true).catch(() => {})
      const res: any = await listKnowledgeBases({ creator })
      return res?.data && Array.isArray(res.data) ? res.data : []
    }
    await ensureKnowledgeBases(force)
    return rawKnowledgeBases.value
  }

  // 共享资源是附带刷新：它的接口挂了不能连坐自己的列表，否则调用方的 catch
  // 会把已经拿到的自己的知识库一起清掉。
  const swallow = (p: Promise<unknown>) => p.catch(() => undefined)

  async function ensureKnowledgeBases(force = false): Promise<void> {
    const orgStore = useOrganizationStore()
    await Promise.all([
      knowledgeBasesResource.ensure(force),
      swallow(orgStore.fetchSharedKnowledgeBases({ force })),
    ])
  }

  async function ensureModels(force = false): Promise<void> {
    return modelsResource.ensure(force)
  }

  /** 用刚拉到的列表覆盖快照（设置页增删改模型之后调用），并作废飞行中的旧请求。 */
  function replaceModels(models: ModelConfig[]) {
    allModels.value = Array.isArray(models) ? models : []
    modelsResource.markLoaded()
  }

  async function ensureWebSearchProviders(force = false): Promise<void> {
    return webSearchProvidersResource.ensure(force)
  }

  /** 并行预取平台页面常用的空间级资源 */
  async function prefetchPlatformResources(force = false): Promise<void> {
    const orgStore = useOrganizationStore()
    await Promise.all([
      ensureKnowledgeBases(force),
      ensureModels(force),
      ensureWebSearchProviders(force),
      orgStore.fetchOrganizations({ force }),
    ])
  }

  /** 单个知识库详情（侧栏 + 详情页共用，去重并发请求） */
  async function fetchKnowledgeBaseById(kbId: string, force = false): Promise<any | null> {
    if (!kbId) return null
    return kbDetailCache.ensure(kbId, force)
  }

  function invalidateKnowledgeBaseDetail(kbId?: string) {
    kbDetailCache.invalidate(kbId)
  }

  function invalidate(...keys: ResourceKey[]) {
    if (keys.length === 0) {
      ;(Object.keys(resources) as ResourceKey[]).forEach((k) => resources[k].invalidate())
      rawKnowledgeBases.value = []
      allModels.value = []
      webSearchProviders.value = []
      invalidateKnowledgeBaseDetail()
      return
    }
    keys.forEach((k) => resources[k].invalidate())
    if (keys.includes('knowledgeBases')) {
      invalidateKnowledgeBaseDetail()
    }
  }

  return {
    rawKnowledgeBases,
    validKnowledgeBases,
    allModels,
    webSearchProviders,
    isLoaded,
    fetchKnowledgeBasesForList,
    ensureKnowledgeBases,
    ensureModels,
    replaceModels,
    ensureWebSearchProviders,
    prefetchPlatformResources,
    fetchKnowledgeBaseById,
    invalidateKnowledgeBaseDetail,
    invalidate,
  }
})
