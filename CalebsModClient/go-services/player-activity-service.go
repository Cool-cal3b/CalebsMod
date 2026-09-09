package go_services

import (
	"encoding/json"
	"io"
)

type RecentPlayer struct {
	Username  string `json:"username"`
	Uuid      string `json:"uuid"`
	LastSeen  int64  `json:"lastSeen"`
	JoinCount int    `json:"joinCount"`
}

type RecentPlayersResponse struct {
	WindowDays int            `json:"windowDays"`
	Players    []RecentPlayer `json:"players"`
}

// GetRecentPlayers fetches the unauthenticated /api/players/recent so the home
// screen can show who has been on lately, not just who is on right now.
func GetRecentPlayers() (RecentPlayersResponse, error) {
	resp, err := MakeGetRequest("/api/players/recent?days=7")
	if err != nil {
		return RecentPlayersResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return RecentPlayersResponse{}, err
	}

	var out RecentPlayersResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return RecentPlayersResponse{}, err
	}
	return out, nil
}
