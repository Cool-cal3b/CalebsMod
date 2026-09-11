//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/user"
	"syscall"
	"time"
)

func prepareNotificationAgentForUpdate() error {
	current, err := user.Current()
	if err != nil || current.Uid == "" {
		return nil
	}
	pipe := `\\.\pipe\CalebsMod.NotificationAgent.` + current.Uid
	file, err := openAgentPipe(pipe)
	if err != nil {
		return nil
	}
	request := map[string]interface{}{"id": "bootstrapper-update", "method": "shutdown", "params": nil}
	if err := json.NewEncoder(file).Encode(request); err != nil {
		file.Close()
		return err
	}
	var response struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(file).Decode(&response); err != nil {
		file.Close()
		return err
	}
	file.Close()
	if response.Error != "" {
		return errors.New(response.Error)
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		probe, probeErr := openAgentPipe(pipe)
		if probeErr != nil {
			return nil
		}
		probe.Close()
		time.Sleep(75 * time.Millisecond)
	}
	return errors.New("notification agent did not stop")
}

func openAgentPipe(path string) (*os.File, error) {
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	handle, err := syscall.CreateFile(pathPtr, syscall.GENERIC_READ|syscall.GENERIC_WRITE, 0, nil, syscall.OPEN_EXISTING, 0, 0)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(handle), fmt.Sprintf("agent-pipe-%d", handle)), nil
}
