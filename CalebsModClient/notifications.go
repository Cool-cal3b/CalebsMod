package main

import (
	go_services "CalebsModClient/go-services"
	"CalebsModClient/notificationagent"
	"context"
	"fmt"
)

type NotificationService struct {
	ctx context.Context
}

func NewNotificationService() *NotificationService { return &NotificationService{} }

func (n *NotificationService) startup(ctx context.Context) {
	n.ctx = ctx
	go func() {
		if err := notificationagent.EnsureRunning(); err != nil {
			fmt.Printf("Note: notification agent could not start: %v\n", err)
			return
		}
		// Picks up an account switched in Prism since the last run. A player who
		// has never launched usually fails here and succeeds after launching.
		if err := go_services.EnsurePingIdentity(); err != nil {
			fmt.Printf("Note: not registered for pings yet: %v\n", err)
		}
	}()
}

func (n *NotificationService) GetNotificationState() (notificationagent.State, error) {
	return notificationagent.GetState()
}

func (n *NotificationService) PingPlayer(username string) (notificationagent.PingResult, error) {
	return notificationagent.SendPing(username)
}

// SetPingsEnabled is the only switch the UI offers. Starting with Windows
// exists so pings can arrive while the client is closed, so turning pings off
// turns that off too.
func (n *NotificationService) SetPingsEnabled(enabled bool) (notificationagent.State, error) {
	state, err := notificationagent.GetState()
	if err != nil {
		return state, err
	}
	settings := state.Settings
	settings.DirectPings = enabled
	settings.StartWithWindows = enabled
	return notificationagent.UpdateSettings(settings)
}
