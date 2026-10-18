# 第二轮裁剪 Spec：MCP / 联网搜索 / 来源定位 残留清理

## 目标
用户指令："先把这些残留的文件或者代码删干净"，针对：
1. `internal/mcp/` + service 层 `mcp_*.go`（MCP 端点、凭证、OAuth）
2. `internal/searchutil/` + service 层 `web_search*.go`（联网搜索）
3. `internal/sourceloc/`（用户认为纯 Agent 附属）

## 扫描结论（与用户清单的差异）
- **可整删**：`internal/mcp/`、`internal/infrastructure/web_search/`、MCP/WebSearch 的 handler / service / repository / types / interfaces / middleware / router 文件
- **不可整删**：
  - `internal/searchutil/` — 被 reranking/mmr.go（TokenizeSimple/Jaccard）、docparser/image_resolver.go（HTMLImageSrcRegex/URLGroup）、wiki_ingest*/knowledge_process/chunk/graph/slug_fuzzy（MergeTextChunks/ImageURLsInContent/JoinChunkContent/ExtractSnippet）依赖。仅删 `conversion.go`（ConvertWebSearchResults 只被 web_search.go 用）
  - `internal/sourceloc/` — 被 docparser/mineru_layout.go、paddleocr_vl_*.go（Unit/Align）与 knowledge_source_locators.go、searchutil/imageinfo.go 依赖，全部保留

## 删除文件清单
### MCP 链
- `internal/mcp/` 全目录（19 文件）
- handler：mcp_oauth.go、mcp_service.go、mcp_metadata.go、mcp_metadata_test.go、mcp_endpoint.go、mcp_credentials.go
- service：mcp_service.go、mcp_service_test.go、mcp_metadata.go、mcp_metadata_test.go、mcp_endpoint.go、mcp_endpoint_test.go
- repository：mcp_metadata.go、mcp_metadata_test.go、mcp_endpoint.go、mcp_oauth.go、mcp_oauth_test.go、mcp_service.go
- types：mcp.go、mcp_test.go、mcp_metadata.go、mcp_oauth.go、mcp_endpoint.go、mcp_endpoint_tools.go、mcp_endpoint_tools_test.go
- interfaces：mcp_metadata.go、mcp_service.go、mcp_endpoint.go
- middleware：mcp_endpoint_auth.go、mcp_endpoint_auth_test.go
- router：routes_mcp_endpoint.go、routes_mcp_endpoint_test.go

### WebSearch 链
- `internal/infrastructure/web_search/` 全目录（26 文件）
- handler：web_search.go、web_search_provider.go、web_search_provider_credentials.go
- service：web_search.go、web_search_provider.go、web_search_provider_test.go、web_search_state.go、web_search_filters_test.go
- repository：web_search_provider.go
- types：web_search.go、web_search_test.go、web_search_filters.go、web_search_filters_test.go、web_search_provider.go、web_search_provider_test.go
- interfaces：web_search.go、web_search_provider.go、web_search_state.go
- searchutil：conversion.go

## 修改文件清单（三处必改模式：router → container → 类型/中间件）
1. router/routes_infra.go：删 RegisterMCPServiceRoutes / RegisterWebSearchRoutes / RegisterWebSearchProviderRoutes
2. router/router.go：删 RouterParams 8 个字段 + 3 处注册调用
3. router/rbac.go：删 apiKeyManageMCPServices / apiKeyManageWebSearch + 注释提及
4. router/deployment_capabilities.go：删 MCPServer/MCP/WebSearch 3 项
5. handler/deployment_capabilities.go：删 capability keys/struct 字段/map 项
6. container/container.go：删 import + 17 处 Provide/Invoke + registerMCPCleanup + registerWebSearchProviders
7. types/tenant_api_key.go：删 2 个 capability 常量 + Normalize 分支
8. types/const.go：删 MCPEndpointContextKey
9. types/context_clone.go：删 MCPEndpointContextKey 条目
10. middleware/auth.go：删 mcp-oauth/callback 白名单
11. types/tenant.go：删 Tenant.WebSearchConfig 字段
12. types/config_redaction.go：删 WebSearchConfigForResponse
13. types/config_redaction_test.go：删 WebSearch 相关测试
14. handler/tenant.go：删 KV 分支 web-search-config + GetTenantWebSearchConfig + updateTenantWebSearchConfigInternal
15. handler/dto/tenant.go：删 WebSearchConfig 字段与映射
16. handler/dto/tenant_test.go、handler/tenant_secret_disclosure_test.go：删 WebSearch 断言

## 验证
- `go build ./...` 全绿
- 不涉及 searchutil/sourceloc 核心函数删除
