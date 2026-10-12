type QueryValue = string | number | null | undefined | Array<string | number | null>
export type SettingsRouteQuery = Record<string, QueryValue>

/**
 * 兼容旧书签：历史上部分设置项以 `?section=integrations&tab=xxx` 形式存在，
 * 相关入口已下线，这里只保留透传（不再做任何别名映射）。
 */
export function normalizeSettingsSection(section: string, _tab?: string | null): string {
  return section
}

/**
 * Settings left-nav → URL. Every page is `?section=<navKey>`; `tab` is dropped.
 */
export function buildSettingsRouteQuery(
  sectionKey: string,
  currentQuery: object = {},
): SettingsRouteQuery {
  const query: SettingsRouteQuery = { ...(currentQuery as SettingsRouteQuery) }
  delete query.tab
  query.section = sectionKey
  return query
}

export function settingsQueryUnchanged(
  currentQuery: object,
  nextQuery: SettingsRouteQuery,
): boolean {
  const current = currentQuery as SettingsRouteQuery
  return String(current.section ?? '') === String(nextQuery.section ?? '')
    && current.tab == null
    && nextQuery.tab == null
}
