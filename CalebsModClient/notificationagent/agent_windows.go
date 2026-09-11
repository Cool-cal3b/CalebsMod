//go:build windows

package notificationagent

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/Microsoft/go-winio"
	"github.com/gorilla/websocket"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"gopkg.in/toast.v1"
)

const (
	pipePrefix              = `\\.\pipe\CalebsMod.NotificationAgent.`
	mutexPrefix             = `Local\CalebsMod.NotificationAgent.`
	stateFileName           = "notifications.json"
	logFileName             = "notification-agent.log"
	taskName                = "CalebsMod Notification Agent"
	appID                   = "CalebWashburn.CalebsModClient"
	requestTimeout          = 10 * time.Second
	closeInvalidCredentials = 4002
	maxLogSize              = 1024 * 1024
	cryptProtectUIForbidden = 0x1
)

type persistedState struct {
	Settings       Settings         `json:"settings"`
	DeviceID       string           `json:"deviceId,omitempty"`
	Username       string           `json:"username,omitempty"`
	EncryptedToken string           `json:"encryptedToken,omitempty"`
	SeenEvents     map[string]int64 `json:"seenEvents,omitempty"`
}

type ipcRequest struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type ipcResponse struct {
	ID     string      `json:"id"`
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type wsMessage struct {
	Version   int             `json:"version,omitempty"`
	Type      string          `json:"type"`
	RequestID string          `json:"requestId,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
}

type agentRuntime struct {
	mu        sync.RWMutex
	persisted persistedState
	state     State
	token     string
	conn      *websocket.Conn
	writeMu   sync.Mutex
	pendingMu sync.Mutex
	pending   map[string]chan wsMessage
	wake      chan struct{}
	stop      chan struct{}
	stopOnce  sync.Once
	logger    *log.Logger
}

func Supported() bool { return true }

func IsAgentMode() bool {
	for _, arg := range os.Args[1:] {
		if arg == "--agent" {
			return true
		}
	}
	return false
}

func RunAgent() error {
	sid, err := currentUserSID()
	if err != nil {
		return err
	}
	name, _ := windows.UTF16PtrFromString(mutexPrefix + sid)
	handle, mutexErr := windows.CreateMutex(nil, true, name)
	if handle != 0 {
		defer windows.CloseHandle(handle)
	}
	if errors.Is(mutexErr, windows.ERROR_ALREADY_EXISTS) {
		return nil
	}
	if mutexErr != nil {
		return fmt.Errorf("create agent mutex: %w", mutexErr)
	}

	persisted, token, err := loadPersisted()
	if err != nil {
		return err
	}
	logger := newLogger()
	a := &agentRuntime{
		persisted: persisted,
		token:     token,
		pending:   make(map[string]chan wsMessage),
		wake:      make(chan struct{}, 1),
		stop:      make(chan struct{}),
		logger:    logger,
	}
	a.state = State{
		AgentRunning:    true,
		Registered:      persisted.DeviceID != "",
		Username:        persisted.Username,
		Recipients:      []Recipient{},
		Settings:        persisted.Settings,
		ProtocolVersion: ProtocolVersion,
		BuildVersion:    BuildVersion,
	}

	listener, err := winio.ListenPipe(pipeName(sid), &winio.PipeConfig{
		SecurityDescriptor: "D:P(A;;GA;;;" + sid + ")",
		MessageMode:        false,
	})
	if err != nil {
		return fmt.Errorf("listen on notification pipe: %w", err)
	}
	defer listener.Close()

	ensureToastIdentity()
	go a.websocketLoop()
	go func() { <-a.stop; listener.Close() }()
	logger.Printf("agent started (protocol=%d build=%s)", ProtocolVersion, BuildVersion)

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-a.stop:
				return nil
			default:
				return err
			}
		}
		go a.handleIPC(conn)
	}
}

func EnsureRunning() error {
	var state State
	if callAgent("state", nil, &state) == nil {
		if state.ProtocolVersion == ProtocolVersion && (state.BuildVersion == BuildVersion || BuildVersion == "dev") {
			return nil
		}
		_ = callAgent("shutdown", nil, nil)
		waitForAgentExit(3 * time.Second)
	}

	persisted, _, _ := loadPersisted()
	if !isDevMode() && persisted.Settings.StartWithWindows {
		_ = setStartupTask(true)
	}
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	if err := StartAt(exePath); err != nil {
		return err
	}

	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		if callAgent("state", nil, &state) == nil {
			return nil
		}
		time.Sleep(75 * time.Millisecond)
	}

	// A successful Task Scheduler invocation only means the request was accepted.
	// Fall back to a direct launch if the task did not actually produce an agent;
	// the named mutex still guarantees that a late task start cannot create a duplicate.
	if err := launchDirect(exePath); err != nil {
		return fmt.Errorf("notification agent task did not start and fallback launch failed: %w", err)
	}
	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if callAgent("state", nil, &state) == nil {
			return nil
		}
		time.Sleep(75 * time.Millisecond)
	}
	return errors.New("notification agent did not start")
}

func StartAt(exePath string) error {
	persisted, _, _ := loadPersisted()
	if !isDevMode() && persisted.Settings.StartWithWindows {
		if err := runStartupTask(); err == nil {
			return nil
		}
	}
	return launchDirect(exePath)
}

func launchDirect(exePath string) error {
	cmd := exec.Command(exePath, "--agent")
	cmd.Dir = filepath.Dir(exePath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

func runStartupTask() error {
	cmd := exec.Command("schtasks.exe", "/Run", "/TN", taskName)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("start notification task: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func GetState() (State, error) {
	if err := EnsureRunning(); err != nil {
		return State{}, err
	}
	var state State
	return state, callAgent("state", nil, &state)
}

// Register exchanges a Mojang session join for device credentials. The caller
// has already joined serverID as username; the agent never sees the token.
func Register(username, serverID string) (State, error) {
	if err := EnsureRunning(); err != nil {
		return State{}, err
	}
	var state State
	err := callAgent("register", map[string]string{"username": username, "serverId": serverID}, &state)
	return state, err
}

func SendPing(username string) (PingResult, error) {
	if err := EnsureRunning(); err != nil {
		return PingResult{}, err
	}
	var result PingResult
	err := callAgent("ping", map[string]string{"username": username}, &result)
	return result, err
}

func UpdateSettings(settings Settings) (State, error) {
	if err := EnsureRunning(); err != nil {
		return State{}, err
	}
	var state State
	err := callAgent("settings", settings, &state)
	return state, err
}

func PrepareForUpdate() error {
	var state State
	if callAgent("state", nil, &state) != nil {
		return nil
	}
	if err := callAgent("shutdown", nil, nil); err != nil {
		return err
	}
	if !waitForAgentExit(5 * time.Second) {
		return errors.New("notification agent did not stop; update cancelled")
	}
	return nil
}

func (a *agentRuntime) handleIPC(conn io.ReadWriteCloser) {
	defer conn.Close()
	var request ipcRequest
	if err := json.NewDecoder(conn).Decode(&request); err != nil {
		return
	}
	response := ipcResponse{ID: request.ID}
	result, err := a.dispatchIPC(request)
	if err != nil {
		response.Error = err.Error()
	} else {
		response.Result = result
	}
	_ = json.NewEncoder(conn).Encode(response)
}

func (a *agentRuntime) dispatchIPC(request ipcRequest) (interface{}, error) {
	switch request.Method {
	case "state":
		return a.snapshot(), nil
	case "register":
		var params struct {
			Username string `json:"username"`
			ServerID string `json:"serverId"`
		}
		if err := json.Unmarshal(request.Params, &params); err != nil {
			return nil, err
		}
		if err := a.register(params.Username, params.ServerID); err != nil {
			return nil, err
		}
		return a.snapshot(), nil
	case "ping":
		var params struct {
			Username string `json:"username"`
		}
		if err := json.Unmarshal(request.Params, &params); err != nil {
			return nil, err
		}
		message, err := a.request("ping.send", map[string]string{"recipientUsername": params.Username})
		if err != nil {
			return nil, err
		}
		var data struct {
			Event struct {
				ID        string `json:"id"`
				ExpiresAt int64  `json:"expiresAt"`
			} `json:"event"`
			DeliveredNow bool `json:"deliveredNow"`
		}
		if err := json.Unmarshal(message.Data, &data); err != nil {
			return nil, err
		}
		return PingResult{EventID: data.Event.ID, DeliveredNow: data.DeliveredNow, ExpiresAt: data.Event.ExpiresAt}, nil
	case "settings":
		var settings Settings
		if err := json.Unmarshal(request.Params, &settings); err != nil {
			return nil, err
		}
		if err := a.updateSettings(settings); err != nil {
			return nil, err
		}
		return a.snapshot(), nil
	case "shutdown":
		// Let the IPC response reach the caller before the listener closes and
		// main exits the background process.
		go func() {
			time.Sleep(100 * time.Millisecond)
			a.stopOnce.Do(func() { close(a.stop) })
		}()
		return map[string]bool{"stopping": true}, nil
	default:
		return nil, fmt.Errorf("unknown agent method %q", request.Method)
	}
}

func (a *agentRuntime) register(username, serverID string) error {
	// Sending the credentials this PC already holds lets the server move the
	// existing device to the new account instead of orphaning it.
	a.mu.RLock()
	deviceID, token := a.persisted.DeviceID, a.token
	a.mu.RUnlock()
	hostname, _ := os.Hostname()
	body, _ := json.Marshal(map[string]string{
		"username":   strings.TrimSpace(username),
		"serverId":   serverID,
		"deviceName": hostname,
		"deviceId":   deviceID,
		"token":      token,
	})
	client := &http.Client{Timeout: requestTimeout}
	resp, err := client.Post(serverHTTPURL()+"/api/notifications/devices/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("registration failed: %s", strings.TrimSpace(string(responseBody)))
	}
	var registered struct{ DeviceID, Token, Username string }
	if err := json.Unmarshal(responseBody, &registered); err != nil {
		return err
	}
	encrypted, err := protect([]byte(registered.Token))
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.token = registered.Token
	a.persisted.DeviceID = registered.DeviceID
	a.persisted.Username = registered.Username
	a.persisted.EncryptedToken = encrypted
	a.state.Username = registered.Username
	a.state.Registered = true
	a.state.Device = nil
	a.state.Recipients = []Recipient{}
	err = savePersisted(a.persisted)
	a.mu.Unlock()
	a.closeSocket()
	a.signalWake()
	return err
}

func (a *agentRuntime) updateSettings(settings Settings) error {
	if settings.PlayerJoined || settings.PlayerLeft {
		return errors.New("join and leave notifications are not available yet")
	}
	if !isDevMode() {
		if err := setStartupTask(settings.StartWithWindows); err != nil {
			return err
		}
	}
	a.mu.Lock()
	a.persisted.Settings = settings
	a.state.Settings = settings
	err := savePersisted(a.persisted)
	a.mu.Unlock()
	if err != nil {
		return err
	}
	if a.snapshot().BackendConnected {
		_, err = a.request("settings.update", map[string]bool{"acceptsDirectPings": settings.DirectPings})
	}
	return err
}

func (a *agentRuntime) websocketLoop() {
	backoff := time.Second
	for {
		select {
		case <-a.stop:
			a.closeSocket()
			return
		default:
		}
		a.mu.RLock()
		deviceID, token := a.persisted.DeviceID, a.token
		a.mu.RUnlock()
		if deviceID == "" || token == "" {
			select {
			case <-a.stop:
				return
			case <-a.wake:
				continue
			}
		}

		started := time.Now()
		conn, _, err := (&websocket.Dialer{HandshakeTimeout: requestTimeout}).Dial(serverWebSocketURL(), nil)
		if err != nil {
			a.connectionFailed(err)
		} else {
			a.mu.Lock()
			a.conn = conn
			a.state.BackendConnected = true
			a.state.LastError = ""
			a.mu.Unlock()
			err = a.write("auth", newRequestID(), map[string]interface{}{
				"deviceId": deviceID, "token": token, "protocolVersion": ProtocolVersion,
			})
			if err == nil {
				err = a.readSocket(conn)
			}
			// The server no longer knows these credentials. Retrying them would
			// fail forever; dropping them lets the client register again.
			if websocket.IsCloseError(err, closeInvalidCredentials) {
				a.forgetDevice()
			}
			a.connectionFailed(err)
		}
		stable := time.Since(started) > 30*time.Second
		if stable {
			backoff = time.Second
		}
		jitterRange := backoff / 4
		if jitterRange > time.Second {
			jitterRange = time.Second
		}
		delay := backoff + time.Duration(rand.Int63n(int64(jitterRange)+1))
		select {
		case <-a.stop:
			return
		case <-a.wake:
			backoff = time.Second
		case <-time.After(delay):
			if !stable && backoff < time.Minute {
				backoff *= 2
				if backoff > time.Minute {
					backoff = time.Minute
				}
			}
		}
	}
}

func (a *agentRuntime) readSocket(conn *websocket.Conn) error {
	for {
		var message wsMessage
		if err := conn.ReadJSON(&message); err != nil {
			return err
		}
		if message.RequestID != "" && a.completeRequest(message) {
			continue
		}
		a.handleServerMessage(message)
	}
}

func (a *agentRuntime) handleServerMessage(message wsMessage) {
	switch message.Type {
	case "auth.result":
		var data struct {
			Device Device `json:"device"`
		}
		if json.Unmarshal(message.Data, &data) == nil {
			a.setDevice(data.Device)
			go a.syncCapabilities()
		}
	case "recipients.snapshot":
		var data struct {
			Recipients []Recipient `json:"recipients"`
		}
		if json.Unmarshal(message.Data, &data) == nil {
			a.mu.Lock()
			a.state.Recipients = data.Recipients
			a.mu.Unlock()
		}
	case "notification":
		var data struct {
			Event struct {
				ID        string `json:"id"`
				Type      string `json:"type"`
				ExpiresAt int64  `json:"expiresAt"`
				Payload   struct {
					SenderUsername string `json:"senderUsername"`
				} `json:"payload"`
			} `json:"event"`
		}
		if json.Unmarshal(message.Data, &data) != nil || data.Event.ID == "" {
			return
		}
		go a.handleNotification(data.Event.ID, data.Event.Type, data.Event.Payload.SenderUsername, data.Event.ExpiresAt)
	}
}

func (a *agentRuntime) handleNotification(id, eventType, sender string, expiresAt int64) {
	if time.Now().UnixMilli() >= expiresAt {
		return
	}
	a.mu.Lock()
	_, seen := a.persisted.SeenEvents[id]
	if !seen {
		if a.persisted.SeenEvents == nil {
			a.persisted.SeenEvents = make(map[string]int64)
		}
		for eventID, seenAt := range a.persisted.SeenEvents {
			if seenAt < time.Now().Add(-time.Hour).UnixMilli() {
				delete(a.persisted.SeenEvents, eventID)
			}
		}
		a.persisted.SeenEvents[id] = time.Now().UnixMilli()
		_ = savePersisted(a.persisted)
	}
	settings := a.persisted.Settings
	a.mu.Unlock()

	if !seen && settings.DirectPings && eventType == "direct_ping" {
		notification := toast.Notification{AppID: appID, Title: "Minecraft Ping", Message: sender + " pinged you to play Minecraft", Audio: toast.Default}
		if err := notification.Push(); err != nil {
			a.mu.Lock()
			delete(a.persisted.SeenEvents, id)
			_ = savePersisted(a.persisted)
			a.mu.Unlock()
			a.setError(fmt.Errorf("show toast: %w", err))
			return
		}
	}
	_ = a.write("notification.ack", newRequestID(), map[string]string{"eventId": id})
}

func (a *agentRuntime) request(messageType string, data interface{}) (wsMessage, error) {
	id := newRequestID()
	response := make(chan wsMessage, 1)
	a.pendingMu.Lock()
	a.pending[id] = response
	a.pendingMu.Unlock()
	defer func() { a.pendingMu.Lock(); delete(a.pending, id); a.pendingMu.Unlock() }()
	if err := a.write(messageType, id, data); err != nil {
		return wsMessage{}, err
	}
	select {
	case message := <-response:
		if message.Type == "error" {
			var data struct {
				Message      string `json:"message"`
				RetryAfterMs int64  `json:"retryAfterMs"`
			}
			_ = json.Unmarshal(message.Data, &data)
			if data.RetryAfterMs > 0 {
				return wsMessage{}, fmt.Errorf("%s (try again in %s)", data.Message, (time.Duration(data.RetryAfterMs) * time.Millisecond).Round(time.Second))
			}
			return wsMessage{}, errors.New(data.Message)
		}
		return message, nil
	case <-time.After(requestTimeout):
		return wsMessage{}, errors.New("notification server timed out")
	case <-a.stop:
		return wsMessage{}, errors.New("notification agent is stopping")
	}
}

func (a *agentRuntime) completeRequest(message wsMessage) bool {
	a.pendingMu.Lock()
	response := a.pending[message.RequestID]
	a.pendingMu.Unlock()
	if response == nil {
		return false
	}
	response <- message
	return true
}

func (a *agentRuntime) write(messageType, requestID string, data interface{}) error {
	a.mu.RLock()
	conn := a.conn
	connected := a.state.BackendConnected
	a.mu.RUnlock()
	if conn == nil || !connected {
		return errors.New("notification server is not connected")
	}
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	return conn.WriteJSON(map[string]interface{}{"version": ProtocolVersion, "type": messageType, "requestId": requestID, "data": data})
}

func (a *agentRuntime) connectionFailed(err error) {
	a.mu.Lock()
	if a.conn != nil {
		_ = a.conn.Close()
		a.conn = nil
	}
	a.state.BackendConnected = false
	if err != nil {
		a.state.LastError = err.Error()
		a.logger.Printf("websocket disconnected: %v", err)
	}
	a.mu.Unlock()
	a.pendingMu.Lock()
	for _, response := range a.pending {
		data, _ := json.Marshal(map[string]string{"message": "notification server disconnected"})
		select {
		case response <- wsMessage{Type: "error", Data: data}:
		default:
		}
	}
	a.pending = make(map[string]chan wsMessage)
	a.pendingMu.Unlock()
}

func (a *agentRuntime) closeSocket() {
	a.mu.Lock()
	if a.conn != nil {
		_ = a.conn.Close()
		a.conn = nil
	}
	a.mu.Unlock()
}
func (a *agentRuntime) signalWake() {
	select {
	case a.wake <- struct{}{}:
	default:
	}
}
func (a *agentRuntime) setError(err error) {
	a.mu.Lock()
	a.state.LastError = err.Error()
	a.logger.Print(err)
	a.mu.Unlock()
}
func (a *agentRuntime) setDevice(device Device) {
	a.mu.Lock()
	a.state.Device = &device
	a.state.Username = device.Username
	a.state.Registered = true
	a.mu.Unlock()
}
func (a *agentRuntime) forgetDevice() {
	a.mu.Lock()
	a.token = ""
	a.persisted.DeviceID = ""
	a.persisted.Username = ""
	a.persisted.EncryptedToken = ""
	a.state.Registered = false
	a.state.Username = ""
	a.state.Device = nil
	a.state.Recipients = []Recipient{}
	if err := savePersisted(a.persisted); err != nil {
		a.logger.Printf("forget device: %v", err)
	}
	a.mu.Unlock()
	a.logger.Print("server rejected device credentials; waiting to register again")
}
func (a *agentRuntime) snapshot() State {
	a.mu.RLock()
	defer a.mu.RUnlock()
	out := a.state
	out.Recipients = append([]Recipient{}, a.state.Recipients...)
	return out
}

func (a *agentRuntime) syncCapabilities() {
	settings := a.snapshot().Settings
	_, _ = a.request("settings.update", map[string]bool{"acceptsDirectPings": settings.DirectPings})
}

func callAgent(method string, params interface{}, result interface{}) error {
	sid, err := currentUserSID()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	conn, err := winio.DialPipeContext(ctx, pipeName(sid))
	if err != nil {
		return err
	}
	defer conn.Close()
	id := newRequestID()
	request := map[string]interface{}{"id": id, "method": method, "params": params}
	if err := json.NewEncoder(conn).Encode(request); err != nil {
		return err
	}
	var response ipcResponse
	if err := json.NewDecoder(conn).Decode(&response); err != nil {
		return err
	}
	if response.Error != "" {
		return errors.New(response.Error)
	}
	if result != nil {
		encoded, _ := json.Marshal(response.Result)
		if err := json.Unmarshal(encoded, result); err != nil {
			return err
		}
	}
	return nil
}

func currentUserSID() (string, error) {
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return "", err
	}
	return user.User.Sid.String(), nil
}
func pipeName(sid string) string {
	suffix := sid
	if isDevMode() {
		suffix += ".dev"
	}
	return pipePrefix + suffix
}
func isDevMode() bool { return os.Getenv("CALEBS_MOD_ENV") == "dev" }
func serverHTTPURL() string {
	if isDevMode() {
		return "http://localhost:3001"
	}
	return "https://mc.calebwash.com"
}
func serverWebSocketURL() string {
	parsed, _ := url.Parse(serverHTTPURL())
	if parsed.Scheme == "https" {
		parsed.Scheme = "wss"
	} else {
		parsed.Scheme = "ws"
	}
	parsed.Path = "/api/notifications/socket"
	return parsed.String()
}
func newRequestID() string { return fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Int63()) }

func stateDir() (string, error) {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		return "", errors.New("LOCALAPPDATA is not set")
	}
	return filepath.Join(base, "CalebsModClient"), nil
}
func statePath() (string, error) {
	dir, err := stateDir()
	if err != nil {
		return "", err
	}
	name := stateFileName
	if isDevMode() {
		name = "notifications-dev.json"
	}
	return filepath.Join(dir, name), nil
}
func defaultPersisted() persistedState {
	return persistedState{Settings: Settings{StartWithWindows: true, DirectPings: true}, SeenEvents: make(map[string]int64)}
}
func loadPersisted() (persistedState, string, error) {
	state := defaultPersisted()
	path, err := statePath()
	if err != nil {
		return state, "", err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return state, "", nil
	}
	if err != nil {
		return state, "", err
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, "", err
	}
	if state.SeenEvents == nil {
		state.SeenEvents = make(map[string]int64)
	}
	if state.EncryptedToken == "" {
		return state, "", nil
	}
	token, err := unprotect(state.EncryptedToken)
	return state, string(token), err
}
func savePersisted(state persistedState) error {
	path, err := statePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0600); err != nil {
		return err
	}
	return windows.Rename(temp, path)
}

func protect(data []byte) (string, error) {
	if len(data) == 0 {
		return "", nil
	}
	in := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}
	var out windows.DataBlob
	if err := windows.CryptProtectData(&in, nil, nil, 0, nil, cryptProtectUIForbidden, &out); err != nil {
		return "", err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(out.Data)))
	return base64.StdEncoding.EncodeToString(append([]byte(nil), unsafe.Slice(out.Data, out.Size)...)), nil
}
func unprotect(encoded string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, nil
	}
	in := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}
	var out windows.DataBlob
	if err := windows.CryptUnprotectData(&in, nil, nil, 0, nil, cryptProtectUIForbidden, &out); err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(out.Data)))
	return append([]byte(nil), unsafe.Slice(out.Data, out.Size)...), nil
}

func setStartupTask(enabled bool) error {
	if isDevMode() {
		return nil
	}
	if !enabled {
		cmd := exec.Command("schtasks.exe", "/Delete", "/TN", taskName, "/F")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		if output, err := cmd.CombinedOutput(); err != nil && !strings.Contains(strings.ToLower(string(output)), "cannot find") {
			return fmt.Errorf("remove startup task: %w", err)
		}
		return nil
	}
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	quotedPath := strings.ReplaceAll(exePath, "'", "''")
	script := `$action=New-ScheduledTaskAction -Execute '` + quotedPath + `' -Argument '--agent';` +
		`$trigger=New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name);` +
		`$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero);` +
		`$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited;` +
		`Register-ScheduledTask -TaskName '` + taskName + `' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("register startup task: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func waitForAgentExit(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		var state State
		if callAgent("state", nil, &state) != nil {
			return true
		}
		time.Sleep(75 * time.Millisecond)
	}
	return false
}

func newLogger() *log.Logger {
	dir, err := stateDir()
	if err != nil {
		return log.New(io.Discard, "", 0)
	}
	_ = os.MkdirAll(dir, 0700)
	path := filepath.Join(dir, logFileName)
	if info, err := os.Stat(path); err == nil && info.Size() >= maxLogSize {
		_ = os.Remove(path + ".1")
		_ = os.Rename(path, path+".1")
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return log.New(io.Discard, "", 0)
	}
	return log.New(file, "", log.LstdFlags|log.Lmicroseconds)
}

func ensureToastIdentity() {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\AppUserModelId\`+appID, registry.SET_VALUE)
	if err == nil {
		defer key.Close()
		_ = key.SetStringValue("DisplayName", "Caleb's Mod Client")
		if exePath, pathErr := os.Executable(); pathErr == nil {
			_ = key.SetStringValue("IconUri", exePath)
		}
	}
	dll := windows.NewLazySystemDLL("shell32.dll")
	proc := dll.NewProc("SetCurrentProcessExplicitAppUserModelID")
	if id, idErr := windows.UTF16PtrFromString(appID); idErr == nil {
		_, _, _ = proc.Call(uintptr(unsafe.Pointer(id)))
	}
}
