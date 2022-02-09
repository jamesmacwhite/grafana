package chatmodel

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
)

type PermissionChecker struct {
	bus      bus.Bus
	features featuremgmt.FeatureToggles
}

func NewPermissionChecker(bus bus.Bus, features featuremgmt.FeatureToggles) *PermissionChecker {
	return &PermissionChecker{bus: bus, features: features}
}

func (c *PermissionChecker) getDashboardByUid(ctx context.Context, orgID int64, uid string) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Uid: uid, OrgId: orgID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (c *PermissionChecker) getDashboardById(ctx context.Context, orgID int64, id int64) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Id: id, OrgId: orgID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (c *PermissionChecker) CheckReadPermissions(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, contentTypeID int, objectID string) (bool, error) {
	switch contentTypeID {
	case ContentTypeOrg:
		return false, nil
	case ContentTypeDashboard:
		if !c.features.IsEnabled(featuremgmt.FlagLiveDashboardDiscussions) {
			return false, nil
		}
		dash, err := c.getDashboardByUid(ctx, orgId, objectID)
		if err != nil {
			return false, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanView(); err != nil || !ok {
			return false, nil
		}
	case ContentTypeAnnotation:
		if !c.features.IsEnabled(featuremgmt.FlagLiveAnnotationDiscussions) {
			return false, nil
		}
		repo := annotations.GetRepository()
		annotationID, err := strconv.ParseInt(objectID, 10, 64)
		if err != nil {
			return false, nil
		}
		items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: orgId})
		if err != nil || len(items) != 1 {
			return false, nil
		}
		dashboardID := items[0].DashboardId
		if dashboardID == 0 {
			return false, nil
		}
		dash, err := c.getDashboardById(ctx, orgId, dashboardID)
		if err != nil {
			return false, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanView(); err != nil || !ok {
			return false, nil
		}
	default:
		return false, nil
	}
	return true, nil
}

func (c *PermissionChecker) CheckWritePermissions(ctx context.Context, orgId int64, signedInUser *models.SignedInUser, contentTypeID int, objectID string) (bool, error) {
	switch contentTypeID {
	case ContentTypeOrg:
		return false, nil
	case ContentTypeDashboard:
		if !c.features.IsEnabled(featuremgmt.FlagLiveDashboardDiscussions) {
			return false, nil
		}
		dash, err := c.getDashboardByUid(ctx, orgId, objectID)
		if err != nil {
			return false, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanEdit(); err != nil || !ok {
			return false, nil
		}
	case ContentTypeAnnotation:
		if !c.features.IsEnabled(featuremgmt.FlagLiveAnnotationDiscussions) {
			return false, nil
		}
		repo := annotations.GetRepository()
		annotationID, err := strconv.ParseInt(objectID, 10, 64)
		if err != nil {
			return false, nil
		}
		items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: orgId})
		if err != nil || len(items) != 1 {
			return false, nil
		}
		dashboardID := items[0].DashboardId
		if dashboardID == 0 {
			return false, nil
		}
		dash, err := c.getDashboardById(ctx, orgId, dashboardID)
		if err != nil {
			return false, nil
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanEdit(); err != nil || !ok {
			return false, nil
		}
	default:
		return false, nil
	}
	return true, nil
}