import { reactive, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useDeploymentCapabilitiesStore } from '@/stores/deploymentCapabilities'
import type { DeploymentCapabilityKey } from '@/config/deploymentCapabilities'

interface MenuItem {
  title: string
  titleKey?: string
  icon: string
  path: string
  requiredCapability?: DeploymentCapabilityKey
}

export const useMenuStore = defineStore('menuStore', () => {
  const menuArr = reactive<MenuItem[]>([
    { title: '', titleKey: 'menu.knowledgeBase', icon: 'zhishiku', path: 'knowledge-bases' },
    { title: '', titleKey: 'menu.organizations', icon: 'organization', path: 'organizations', requiredCapability: 'organizations' },
    { title: '', titleKey: 'menu.settings', icon: 'setting', path: 'settings' },
    { title: '', titleKey: 'menu.logout', icon: 'logout', path: 'logout' }
  ])

  const prefillQuery = ref('')

  const applyMenuTranslations = () => {
    menuArr.forEach(item => {
      if (item.titleKey) {
        item.title = i18n.global.t(item.titleKey)
      }
    })
  }

  applyMenuTranslations()

  watch(
    () => i18n.global.locale.value,
    () => {
      applyMenuTranslations()
    }
  )

  const liteHiddenPaths = new Set(['logout', 'organizations'])

  // 共享空间 (organizations) 仅对当前空间的 admin / owner 暴露入口。
  // viewer / contributor 即便在共享空间里拥有资源，也无需自行管理共享关系，
  // 入口在侧栏只会徒增噪音；后端 RBAC 才是权限的最终来源（见 middleware/rbac.go）。
  const visibleMenuArr = computed(() => {
    const authStore = useAuthStore()
    const deploymentCapabilities = useDeploymentCapabilitiesStore()
    return menuArr.filter(item => {
      if (authStore.isLiteMode && liteHiddenPaths.has(item.path)) {
        return false
      }
      if (item.path === 'organizations' && !authStore.hasRole('admin')) {
        return false
      }
      if (!deploymentCapabilities.isSupported(item.requiredCapability)) {
        return false
      }
      return true
    })
  })

  const setPrefillQuery = (q: string) => {
    prefillQuery.value = q
  }

  const consumePrefillQuery = () => {
    const q = prefillQuery.value
    prefillQuery.value = ''
    return q
  }

  return {
    menuArr,
    visibleMenuArr,
    prefillQuery,
    setPrefillQuery,
    consumePrefillQuery
  }
})
