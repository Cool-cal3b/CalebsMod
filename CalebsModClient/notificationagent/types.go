package notificationagent

const ProtocolVersion = 2

// BuildVersion is set by the release script with -ldflags. Development builds
// intentionally share the literal value below.
var BuildVersion = "dev"

type Settings struct {
	StartWithWindows bool `json:"startWithWindows"`
	DirectPings      bool `json:"directPings"`
	PlayerJoined     bool `json:"playerJoined"`
	PlayerLeft       bool `json:"playerLeft"`
}

type Device struct {
	ID                 string `json:"id"`
	Username           string `json:"username"`
	UUID               string `json:"uuid"`
	DeviceName         string `json:"deviceName"`
	AcceptsDirectPings bool   `json:"acceptsDirectPings"`
	CreatedAt          int64  `json:"createdAt"`
	LastConnectedAt    *int64 `json:"lastConnectedAt"`
}

type Recipient struct {
	Username           string `json:"username"`
	AcceptsDirectPings bool   `json:"acceptsDirectPings"`
	Connected          bool   `json:"connected"`
}

type State struct {
	AgentRunning     bool        `json:"agentRunning"`
	BackendConnected bool        `json:"backendConnected"`
	Registered       bool        `json:"registered"`
	Username         string      `json:"username"`
	Device           *Device     `json:"device,omitempty"`
	Recipients       []Recipient `json:"recipients"`
	Settings         Settings    `json:"settings"`
	LastError        string      `json:"lastError,omitempty"`
	ProtocolVersion  int         `json:"protocolVersion"`
	BuildVersion     string      `json:"buildVersion"`
}

type PingResult struct {
	EventID      string `json:"eventId"`
	DeliveredNow bool   `json:"deliveredNow"`
	ExpiresAt    int64  `json:"expiresAt"`
}
