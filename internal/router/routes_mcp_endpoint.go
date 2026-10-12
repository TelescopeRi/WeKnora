package router

import (
	"github.com/Tencent/WeKnora/internal/handler"
	"github.com/gin-gonic/gin"
)

// RegisterMCPEndpointRoutes registers the management API for workspace MCP
// endpoints. Endpoints are tenant-wide integration surfaces: reads for every
// member, mutations for admins, and API keys need the manage_channels
// capability.
func RegisterMCPEndpointRoutes(r *gin.RouterGroup, h *handler.MCPEndpointHandler, g *rbacGuards) {
	if h == nil {
		return
	}
	grp := g.apiKeyGroup(r.Group("/mcp-endpoints"), apiKeyManageChannels(apiKeyFullAccess()))
	grp.GET("", g.Viewer(), h.ListMCPEndpoints)
	grp.GET("/tools", g.Viewer(), h.ListToolCatalog)
	grp.POST("", g.Admin(), h.CreateMCPEndpoint)
	grp.GET("/:endpoint_id", g.Viewer(), h.GetMCPEndpoint)
	grp.PUT("/:endpoint_id", g.Admin(), h.UpdateMCPEndpoint)
	grp.DELETE("/:endpoint_id", g.Admin(), h.DeleteMCPEndpoint)
	grp.POST("/:endpoint_id/rotate-token", g.Admin(), h.RotateMCPEndpointToken)
}
