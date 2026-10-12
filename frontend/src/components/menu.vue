<template>
    <div class="aside_box" :class="{ 'aside_box--collapsed': uiStore.sidebarCollapsed, 'aside_box--resizing': uiStore.sidebarResizing }">
        <!-- 展开时：Logo + 搜索/折叠按钮同行 -->
        <div class="logo_row" v-if="!uiStore.sidebarCollapsed">
            <div class="logo_box" @click="router.push('/platform/knowledge-bases')" style="cursor: pointer;">
                <img class="logo" src="@/assets/img/weknora.png" alt="">
                <sup v-if="isLiteEdition" class="lite-badge">Lite</sup>
            </div>
            <div class="logo_actions">
                <t-tooltip placement="bottom">
                    <template #content>
                        <span class="cmdk-tip">
                            <span class="cmdk-tip-label">{{ t('menu.search') }}</span>
                            <span class="cmdk-tip-keys">{{ cmdModKeyLabel }}K</span>
                        </span>
                    </template>
                    <div class="header-icon-btn" @click="commandPaletteStore.openPalette('')"
                        :aria-label="t('menu.search')">
                        <img class="header-icon-img" :src="getImgSrc('search.svg')" alt="">
                    </div>
                </t-tooltip>
                <div class="sidebar-toggle" @click="uiStore.toggleSidebar" :title="t('menu.collapseSidebar')">
                    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor" stroke-width="1.2" />
                        <line x1="7.5" y1="1.5" x2="7.5" y2="18.5" stroke="currentColor" stroke-width="1.2" />
                        <line x1="4" y1="7.5" x2="4" y2="12.5" stroke="currentColor" stroke-width="1.2"
                            stroke-linecap="round" />
                    </svg>
                </div>
            </div>
        </div>
        <!-- 折叠时：展开按钮 -->
        <t-tooltip v-else :content="t('menu.expandSidebar')" placement="right">
            <div class="menu_item sidebar-toggle-item" @click="uiStore.toggleSidebar">
                <div class="menu_item-box">
                    <div class="menu_icon">
                        <svg class="icon" viewBox="0 0 20 20" width="20" height="20" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor"
                                stroke-width="1.2" />
                            <line x1="7.5" y1="1.5" x2="7.5" y2="18.5" stroke="currentColor" stroke-width="1.2" />
                            <line x1="5" y1="10" x2="3" y2="8" stroke="currentColor" stroke-width="1.2"
                                stroke-linecap="round" />
                            <line x1="5" y1="10" x2="3" y2="12" stroke="currentColor" stroke-width="1.2"
                                stroke-linecap="round" />
                        </svg>
                    </div>
                </div>
            </div>
        </t-tooltip>

        <!-- 空间选择器：仅在用户可切换空间时显示 -->
        <TenantSelector v-if="canAccessAllTenants && !uiStore.sidebarCollapsed" />

        <!-- 侧栏边缘拖拽调宽，拖窄时自动收缩 -->
        <PanelResizeHandle edge="right" :label="t('knowledgeStages.resizeDrawer')"
            :value="uiStore.sidebarDisplayWidth" :min="SIDEBAR_COLLAPSED_WIDTH" :max="SIDEBAR_MAX_WIDTH"
            @start="startSidebarResize" @resize="resizeSidebar" @end="uiStore.sidebarResizing = false" />

        <!-- 上半部分：主导航菜单 -->
        <div class="menu_top">
            <!-- 全局搜索入口：折叠态保留为图标项 + 深色 tooltip -->
            <div class="menu_box menu_box--cmdk" v-if="uiStore.sidebarCollapsed">
                <t-tooltip placement="right">
                    <template #content>
                        <span class="cmdk-tip">
                            <span class="cmdk-tip-label">{{ t('menu.search') }}</span>
                            <span class="cmdk-tip-keys">{{ cmdModKeyLabel }}K</span>
                        </span>
                    </template>
                    <div class="menu_item menu_item--cmdk" @click="commandPaletteStore.openPalette('')">
                        <div class="menu_item-box">
                            <div class="menu_icon">
                                <img class="icon" :src="getImgSrc('search.svg')" alt="">
                            </div>
                        </div>
                    </div>
                </t-tooltip>
            </div>
            <div class="menu_box" v-for="(item, index) in topMenuItems" :key="index">
                <t-tooltip :content="item.title" placement="right" :disabled="!uiStore.sidebarCollapsed">
                    <div @click="handleMenuClick(item.path)" :data-guide="`nav-${item.path}`"
                        :class="['menu_item', isMenuItemActive(item.path) ? 'menu_item_active' : '']">
                        <div class="menu_item-box">
                            <div class="menu_icon">
                                <img class="icon"
                                    :src="getImgSrc(item.path === 'knowledge-bases' ? knowledgeIcon : item.path === 'organizations' ? organizationIcon : item.icon + '.svg')"
                                    alt="">
                            </div>
                            <template v-if="!uiStore.sidebarCollapsed">
                                <span class="menu_title" :title="item.title">{{ item.title }}</span>
                                <span v-if="item.path === 'organizations' && orgStore.totalPendingJoinRequestCount > 0"
                                    class="menu-pending-badge"
                                    :title="t('organization.settings.pendingJoinRequestsBadge')">{{
                                        orgStore.totalPendingJoinRequestCount }}</span>
                            </template>
                        </div>
                    </div>
                </t-tooltip>
            </div>
        </div>

        <!-- 下半部分：用户菜单 -->
        <div class="menu_bottom">
            <UserMenu />
        </div>

    </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, watch, computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PanelResizeHandle from './PanelResizeHandle.vue';
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/utils/sidebarWidth';
import { useMenuStore } from '@/stores/menu';
import { useAuthStore } from '@/stores/auth';
import { useDeploymentCapabilitiesStore } from '@/stores/deploymentCapabilities';
import { useOrganizationStore } from '@/stores/organization';
import { useUIStore } from '@/stores/ui';
import { useCommandPaletteStore } from '@/stores/commandPalette';
import UserMenu from '@/components/UserMenu.vue';
import TenantSelector from '@/components/TenantSelector.vue';
import { useI18n } from 'vue-i18n';
import { useEditorResourcesStore } from '@/stores/editorResources';
import { useChatResourcesStore } from '@/stores/chatResources';

const chatResources = useChatResourcesStore();
const editorResources = useEditorResourcesStore();

const { t } = useI18n();
const usemenuStore = useMenuStore();
const authStore = useAuthStore();
const deploymentCapabilities = useDeploymentCapabilitiesStore();
const orgStore = useOrganizationStore();
const uiStore = useUIStore();
const commandPaletteStore = useCommandPaletteStore();

// Platform-aware label for the ⌘K hint. navigator.platform is deprecated but
// the alternatives (userAgentData.platform) aren't universally available yet;
// this check is good enough for Mac vs. non-Mac.
const isMacLike = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');
const cmdModKeyLabel = isMacLike ? '⌘' : 'Ctrl';
const route = useRoute();
const router = useRouter();
const currentpath = ref('');
type MenuItem = { title: string; icon: string; path: string };
const { visibleMenuArr } = storeToRefs(usemenuStore);
const isLiteEdition = ref(false);

// 是否可以访问所有空间
const canAccessAllTenants = computed(() => authStore.canAccessAllTenants);

// 是否处于知识库详情页
const isInKnowledgeBase = computed<boolean>(() => {
    return route.name === 'knowledgeBaseDetail' ||
        route.name === 'knowledgeBaseSettings';
});

// 统一的菜单项激活状态判断
const isMenuItemActive = (itemPath: string): boolean => {
    const currentRoute = route.name;

    switch (itemPath) {
        case 'knowledge-bases':
            return currentRoute === 'knowledgeBaseList' ||
                currentRoute === 'knowledgeBaseDetail' ||
                currentRoute === 'knowledgeBaseSettings';
        case 'organizations':
            return currentRoute === 'organizationList';
        case 'settings':
            return currentRoute === 'settings';
        default:
            return itemPath === currentpath.value;
    }
};

// 侧栏只渲染导航类入口；settings / logout 由 UserMenu 承担
const TOP_MENU_PATHS = new Set(['knowledge-bases', 'organizations']);

const topMenuItems = computed<MenuItem[]>(() => {
    return (visibleMenuArr.value as unknown as MenuItem[]).filter((item: MenuItem) => TOP_MENU_PATHS.has(item.path));
});

// 当前知识库信息
const currentKbName = ref<string>('')
const currentKbInfo = ref<any>(null)

async function loadCurrentKbInfo(kbId: string) {
    if (!kbId || !isInKnowledgeBase.value) {
        currentKbName.value = ''
        currentKbInfo.value = null
        return
    }
    const data = await chatResources.fetchKnowledgeBaseById(kbId)
    if (data) {
        currentKbName.value = data.name || ''
        currentKbInfo.value = data
    } else {
        currentKbInfo.value = null
    }
}

onMounted(async () => {
    const routeName = typeof route.name === 'string' ? route.name : (route.name ? String(route.name) : '')
    currentpath.value = routeName;

    isLiteEdition.value = authStore.isLiteMode
    editorResources.ensureSystemInfo().then(() => {
        if (editorResources.systemInfo?.edition === 'lite') {
            isLiteEdition.value = true
            authStore.setLiteMode(true)
        }
    }).catch(() => { })

    await loadCurrentKbInfo((route.params as any)?.kbId as string)

    // 若组织列表未加载则拉取一次，用于侧栏「待审批」角标
    if (deploymentCapabilities.isSupported('organizations') && orgStore.organizations.length === 0) {
        orgStore.fetchOrganizations();
    }
});

watch([() => route.name, () => route.params], (newvalue, oldvalue) => {
    const nameStr = typeof newvalue[0] === 'string' ? (newvalue[0] as string) : (newvalue[0] ? String(newvalue[0]) : '')
    currentpath.value = nameStr;

    // 路由变化时更新图标状态和知识库信息
    getIcon(nameStr);

    // 如果切换了知识库，更新知识库名称
    if (newvalue[1].kbId !== oldvalue?.[1]?.kbId) {
        loadCurrentKbInfo((newvalue[1] as any)?.kbId as string);
    }
});

let knowledgeIcon = ref('zhishiku-green.svg');
let organizationIcon = ref('organization.svg');
const getIcon = (path: string) => {
    const currentRoute = route.name;
    knowledgeIcon.value = (currentRoute === 'knowledgeBaseList' ||
        currentRoute === 'knowledgeBaseDetail' ||
        currentRoute === 'knowledgeBaseSettings') ? 'zhishiku-green.svg' : 'zhishiku.svg';
    organizationIcon.value = currentRoute === 'organizationList' ? 'organization-green.svg' : 'organization.svg';
}
getIcon(typeof route.name === 'string' ? route.name as string : (route.name ? String(route.name) : ''))

const handleMenuClick = async (path: string) => {
    if (path === 'knowledge-bases') {
        // 知识库菜单项：如果在知识库内部，跳转到当前知识库文件页；否则跳转到知识库列表
        const kbId = await getCurrentKbId()
        if (kbId) {
            router.push(`/platform/knowledge-bases/${kbId}`)
        } else {
            router.push('/platform/knowledge-bases')
        }
    } else if (path === 'organizations') {
        // 组织菜单项：跳转到组织列表
        router.push('/platform/organizations')
    } else {
        router.push(`/platform/${path}`)
    }
}

const getCurrentKbId = async (): Promise<string | null> => {
    const kbId = (route.params as any)?.kbId as string
    if (isInKnowledgeBase.value && kbId) {
        return kbId
    }
    return null
}

const getImgSrc = (url: string) => {
    return new URL(`/src/assets/img/${url}`, import.meta.url).href;
}

let sidebarResizeStartWidth = 0
const startSidebarResize = () => {
    sidebarResizeStartWidth = uiStore.sidebarDisplayWidth
    uiStore.sidebarResizing = true
}
const resizeSidebar = (delta: number, keyboard: boolean) => {
    if (keyboard && uiStore.sidebarCollapsed && delta > 0) {
        uiStore.expandSidebar()
    } else if (keyboard && uiStore.sidebarWidth === SIDEBAR_MIN_WIDTH && delta < 0) {
        uiStore.collapseSidebar()
    } else {
        uiStore.resizeSidebar(sidebarResizeStartWidth + delta)
    }
}
</script>
<style lang="less" scoped>
.aside_box {
    // 侧栏水平栅格：图标列与文案列统一对齐（Logo / 菜单）
    --sidebar-inset-x: 14px;
    --sidebar-icon-size: 18px;
    --sidebar-icon-gap: 8px;

    min-width: 0;
    width: var(--sidebar-width, 260px);
    flex-shrink: 0;
    padding: 8px 6px 6px;
    background: var(--td-bg-color-sidebar);
    box-sizing: border-box;
    /* Avoid 100vh because <html> carries a `zoom` multiplier for font-size
       control; 100vh is evaluated against the unscaled viewport and then
       scaled, so at "large" the sidebar would extend past the window. The
       ancestor chain (html/body/#app/.main) is already height: 100%. */
    height: 100%;
    overflow: visible;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--td-component-stroke);
    box-shadow: 1px 0 0 rgba(0, 0, 0, 0.02);
    transition: width 0.25s ease, min-width 0.25s ease;
    position: relative;

    // macOS Wails 桌面：红绿灯位于 HiddenInset 标题栏区域，需让出顶部空间
    html.wails-desktop & {
        padding-top: 30px;
    }

    &--resizing {
        transition: none;
    }

    &--collapsed {
        min-width: 60px;
        width: 60px;
        padding: 8px 3px 6px;
        overflow: visible;

        .menu_item {
            justify-content: center;
            padding: 7px 0;

            .menu_item-box {
                justify-content: center;
                width: auto;
            }

            .menu_icon {
                margin-right: 0;
            }
        }

        .menu_bottom {
            align-items: center;
        }

        .menu_top {
            margin-right: 0;
            padding-right: 0;
        }
    }

    .logo_row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 50px;
        flex-shrink: 0;
        padding: 0 10px 0 var(--sidebar-inset-x);
    }

    .sidebar-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        cursor: pointer;
        color: var(--td-text-color-secondary);
        border-radius: var(--app-radius-xs);
        transition: background-color var(--app-motion-base) ease;
        box-sizing: border-box;

        &:hover {
            background: var(--td-bg-color-container-hover);
            color: var(--td-text-color-primary);
        }
    }

    .logo_box {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        overflow: hidden;

        .logo {
            width: 128px;
            height: auto;
        }

        .lite-badge {
            margin-left: 2px;
            align-self: flex-start;
            margin-top: 2px;
            font-size: 9px;
            font-weight: 600;
            color: var(--td-text-color-placeholder);
            user-select: none;
            white-space: nowrap;
        }
    }

    .menu_top {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        margin-right: -4px;
        padding-right: 4px;

        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
        transition: scrollbar-color var(--app-motion-base) ease;

        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
        }

        &::-webkit-scrollbar-thumb {
            background-color: transparent;
            border-radius: var(--app-radius-sm);
            transition: background-color var(--app-motion-base) ease;
        }

        &:hover {
            scrollbar-color: var(--td-scrollbar-color) transparent;

            &::-webkit-scrollbar-thumb {
                background-color: var(--td-scrollbar-color);
            }
        }

        &::-webkit-scrollbar-thumb:hover {
            background-color: var(--td-scrollbar-hover-color);
        }
    }

    .menu_bottom {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
    }

    .menu_box {
        display: flex;
        flex-direction: column;
    }

    .menu_item_active {
        border-radius: var(--app-radius-xs);
        background: var(--td-bg-color-secondarycontainer) !important;

        .menu_icon,
        .menu_title {
            color: var(--td-brand-color) !important;
        }
    }

    .menu_item {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 34px;
        padding: 6px 10px 6px var(--sidebar-inset-x);
        box-sizing: border-box;
        margin-bottom: 1px;
        border-radius: var(--app-radius-xs);
        transition: background-color var(--app-motion-base) ease;

        .menu_item-box {
            display: flex;
            align-items: center;
        }

        &:hover {
            border-radius: var(--app-radius-xs);
            background: var(--td-bg-color-container-hover);

            .menu_icon,
            .menu_title {
                color: var(--td-text-color-primary);
            }
        }
    }

    .menu_icon {
        display: flex;
        flex: 0 0 var(--sidebar-icon-size);
        width: var(--sidebar-icon-size);
        margin-right: var(--sidebar-icon-gap);
        color: var(--td-text-color-secondary);

        .icon {
            width: 18px;
            height: 18px;
            overflow: hidden;
        }
    }

    .menu_title {
        color: var(--td-text-color-primary);
        text-overflow: ellipsis;
        font-family: var(--app-font-family);
        font-size: var(--app-text-base);
        font-style: normal;
        font-weight: 600;
        line-height: 20px;
        overflow: hidden;
        white-space: nowrap;
        max-width: 120px;
        flex: 1;
    }

    .menu-pending-badge {
        flex-shrink: 0;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background: var(--td-error-color);
        color: #fff;
        font-size: 11px;
        line-height: 18px;
        text-align: center;
        box-sizing: border-box;
    }
}

.menu_item-box {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
}

// 顶部 logo_row 右侧的图标按钮组（搜索 + 折叠），与折叠按钮风格一致
.logo_actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: var(--app-radius-sm);
    color: var(--td-text-color-secondary);
    transition: background-color var(--app-motion-base) ease;
    box-sizing: border-box;

    &:hover {
        background: var(--td-bg-color-container-hover);
    }
}

.header-icon-img {
    width: 18px;
    height: 18px;
    display: block;
}

.cmdk-tip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.cmdk-tip-keys {
    opacity: 0.7;
}
</style>
