package chats

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/chats/chatmodel"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg         *setting.Cfg
	bus         bus.Bus
	live        *live.GrafanaLive
	storage     Storage
	permissions *chatmodel.PermissionChecker
}

func ProvideService(cfg *setting.Cfg, bus bus.Bus, store *sqlstore.SQLStore, live *live.GrafanaLive, features featuremgmt.FeatureToggles) *Service {
	s := &Service{
		cfg:  cfg,
		bus:  bus,
		live: live,
		storage: &sqlStorage{
			sql: store,
		},
		permissions: chatmodel.NewPermissionChecker(bus, features),
	}
	return s
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}