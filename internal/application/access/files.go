package access

import (
	"context"
	"fmt"
	"strings"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	secutils "github.com/Tencent/WeKnora/internal/utils"
)

// FileAccess is a request-local result, produced before storage is opened.
// Physical locators are not a substitute for KB authorization.
type FileAccess struct {
	OwnerTenantID    uint64
	Path             string
	Filename         string
	StorageBackendID string
}

// FileCatalog resolves logical references to their stored owner and locator.
type FileCatalog interface {
	ResolvePath(context.Context, string) (string, *types.StoredResource, error)
}

func resolveFile(
	ctx context.Context,
	catalog FileCatalog,
	reference string,
) (FileAccess, *types.StoredResource, error) {
	file := FileAccess{Path: reference, Filename: reference}
	if catalog == nil {
		if _, resource := types.ParseResourcePath(reference); resource {
			return file, nil, ErrNotFound
		}
		return file, nil, nil
	}
	path, resource, err := catalog.ResolvePath(ctx, reference)
	if err != nil {
		return file, nil, ErrNotFound
	}
	file.Path = path
	file.Filename = path
	if resource != nil {
		file.OwnerTenantID = resource.TenantID
		file.StorageBackendID = resource.StorageBackendID
		if strings.TrimSpace(resource.OriginalName) != "" {
			file.Filename = resource.OriginalName
		}
	}
	return file, resource, nil
}

// ResolveKBFile requires the route's exact KB grant and an independent live
// explicit binding check. Rewriting the execution tenant is insufficient.
func ResolveKBFile(
	ctx context.Context,
	grant *KBAccess,
	kbID, reference string,
	catalog FileCatalog,
	bindings interfaces.KBResourceLookup,
) (FileAccess, error) {
	var empty FileAccess
	if grant == nil || grant.KnowledgeBase == nil || grant.KnowledgeBase.ID != kbID ||
		grant.Caller != types.CallerFromContext(ctx) || !grant.Permission.HasPermission(types.OrgRoleViewer) {
		return empty, ErrForbidden
	}
	if err := types.AuthorizeTenantAPIKeyKnowledgeBases(ctx, kbID); err != nil {
		return empty, err
	}
	file, resource, err := resolveFile(ctx, catalog, reference)
	if err != nil {
		return empty, err
	}
	owner := grant.EffectiveTenantID
	if owner == 0 || (resource != nil && resource.TenantID != owner) {
		return empty, ErrForbidden
	}
	if err := secutils.ValidateKBScopedStoragePath(file.Path, owner); err != nil {
		return empty, ErrForbidden
	}
	if bindings == nil {
		return empty, ErrForbidden
	}
	bound, err := bindings.IsReferencedByKnowledgeBase(ctx, owner, kbID, reference)
	if err != nil {
		return empty, fmt.Errorf("check KB file binding: %w", err)
	}
	if !bound {
		return empty, ErrForbidden
	}
	file.OwnerTenantID = owner
	return file, nil
}