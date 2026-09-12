package go_services

import (
	"encoding/json"
	"fmt"
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
// The server clamps days to 183 (~6 months).
func GetRecentPlayers(days int) (RecentPlayersResponse, error) {
	resp, err := MakeGetRequest(fmt.Sprintf("/api/players/recent?days=%d", days))
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
