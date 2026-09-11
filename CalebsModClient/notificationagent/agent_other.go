//go:build !windows

package notificationagent

import "fmt"

var errUnsupported = fmt.Errorf("notification agent is currently available on Windows only")

func IsAgentMode() bool                      { return false }
func RunAgent() error                        { return errUnsupported }
func EnsureRunning() error                   { return errUnsupported }
func GetState() (State, error)               { return State{}, errUnsupported }
func Register(string) (State, error)         { return State{}, errUnsupported }
func GetRecipients() ([]Recipient, error)    { return nil, errUnsupported }
func SendPing(string) (PingResult, error)    { return PingResult{}, errUnsupported }
func UpdateSettings(Settings) (State, error) { return State{}, errUnsupported }
func PrepareForUpdate() error                { return nil }
func StartAt(string) error                   { return nil }
