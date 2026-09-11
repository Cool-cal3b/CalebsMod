package main

import (
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
		}
	}()
}

func (n *NotificationService) GetNotificationState() (notificationagent.State, error) {
	return notificationagent.GetState()
}

func (n *NotificationService) RegisterNotificationDevice(username string) (notificationagent.State, error) {
	return notificationagent.Register(username)
}

func (n *NotificationService) GetPingRecipients() ([]notificationagent.Recipient, error) {
	return notificationagent.GetRecipients()
}

func (n *NotificationService) PingPlayer(username string) (notificationagent.PingResult, error) {
	return notificationagent.SendPing(username)
}

func (n *NotificationService) UpdateNotificationSettings(settings notificationagent.Settings) (notificationagent.State, error) {
	return notificationagent.UpdateSettings(settings)
}
