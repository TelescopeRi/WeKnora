# 任务清单

## 阶段 1：删除 MCP 链文件
- [x] 删 internal/mcp/（19 文件）
- [x] 删 handler/service/repository/types/interfaces/middleware/router 的 MCP 文件

## 阶段 2：删除 WebSearch 链文件
- [x] 删 internal/infrastructure/web_search/（26 文件）
- [x] 删 handler/service/repository/types/interfaces 的 web_search 文件
- [x] 删 searchutil/conversion.go

## 阶段 3：修改装配文件
- [x] router：routes_infra.go / router.go / rbac.go / deployment_capabilities.go
- [x] handler/deployment_capabilities.go
- [x] container/container.go（import/Provide/2 函数）
- [x] types：tenant_api_key.go / const.go / context_clone.go / tenant.go / config_redaction.go
- [x] middleware/auth.go
- [x] handler/tenant.go + handler/dto/tenant.go + 相关测试

## 阶段 4：验证
- [x] go build ./... 通过
- [x] 汇报 searchutil/sourceloc 保留结论
