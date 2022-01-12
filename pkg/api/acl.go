package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// updateDashboardACL updates a dashboard's ACL items.
//
// Stubbable by tests.
var updateDashboardACL = func(ctx context.Context, s dashboards.Store, dashID int64, items []*models.DashboardAcl) error {
	return s.UpdateDashboardACLCtx(ctx, dashID, items)
}
