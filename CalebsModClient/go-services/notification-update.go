package go_services

import "CalebsModClient/notificationagent"

// PrepareNotificationAgentForUpdate releases the installed executable before
// the updater's rename dance. It is deliberately a small bridge so the update
// service does not own the notification process lifecycle.
func PrepareNotificationAgentForUpdate() error {
	return notificationagent.PrepareForUpdate()
}

func EnsureNotificationAgentRunning() error {
	return notificationagent.EnsureRunning()
}

func StartUpdatedNotificationAgent(path string) error {
	return notificationagent.StartAt(path)
}
