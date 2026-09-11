package notificationagent

const ProtocolVersion = 1

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
	DeviceName         string `json:"deviceName"`
	Status             string `json:"status"`
	AcceptsDirectPings bool   `json:"acceptsDirectPings"`
	CreatedAt          int64  `json:"createdAt"`
	ApprovedAt         *int64 `json:"approvedAt"`
	LastConnectedAt    *int64 `json:"lastConnectedAt"`
}

type Recipient struct {
	Username           string `json:"username"`
	AcceptsDirectPings bool   `json:"acceptsDirectPings"`
	Connected          bool   `json:"connected"`
}

type State struct {
	AgentRunning       bool        `json:"agentRunning"`
	BackendConnected   bool        `json:"backendConnected"`
	RegistrationStatus string      `json:"registrationStatus"`
	Username           string      `json:"username"`
	Device             *Device     `json:"device,omitempty"`
	Recipients         []Recipient `json:"recipients"`
	Settings           Settings    `json:"settings"`
	LastError          string      `json:"lastError,omitempty"`
	ProtocolVersion    int         `json:"protocolVersion"`
	BuildVersion       string      `json:"buildVersion"`
}

type PingResult struct {
	EventID      string `json:"eventId"`
	DeliveredNow bool   `json:"deliveredNow"`
	ExpiresAt    int64  `json:"expiresAt"`
}
