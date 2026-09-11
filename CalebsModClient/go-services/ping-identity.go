package go_services

import (
	"CalebsModClient/notificationagent"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Pings are addressed by Minecraft name, so a PC has to prove which account it
// plays as before the server will deliver to it. Nobody types their name in:
// Prism already knows who is logged in, and Mojang's session server vouches
// for it exactly as it does when a player connects to a Minecraft server. The
// access token read from Prism is only ever sent to Mojang, never to our API.

const mojangJoinURL = "https://sessionserver.mojang.com/session/minecraft/join"

// How long after a launch to keep trying. Prism refreshes the account's
// session while it launches, and a first-time player only counts as having
// played here once their join has reached the server log.
const (
	pingIdentityRetryWindow   = 5 * time.Minute
	pingIdentityRetryInterval = 30 * time.Second
)

var (
	pingIdentityMu      sync.Mutex
	errPingIdentityBusy = errors.New("ping registration already in progress")
)

type prismAccount struct {
	Active  bool   `json:"active"`
	Type    string `json:"type"`
	Profile struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"profile"`
	// Prism's name for the Minecraft services token, left over from Yggdrasil.
	Ygg struct {
		Token string `json:"token"`
	} `json:"ygg"`
}

// EnsurePingIdentity registers this PC for pings as the account Prism plays
// as, unless it is already registered as that account.
func EnsurePingIdentity() error {
	if !notificationagent.Supported() {
		return nil
	}
	if !pingIdentityMu.TryLock() {
		return errPingIdentityBusy
	}
	defer pingIdentityMu.Unlock()

	account, err := activePrismAccount()
	if err != nil {
		return err
	}
	state, err := notificationagent.GetState()
	if err != nil {
		return err
	}
	if state.Registered && strings.EqualFold(state.Username, account.Profile.Name) {
		return nil
	}

	serverID, err := newSessionServerID()
	if err != nil {
		return err
	}
	if err := joinMojangSession(account, serverID); err != nil {
		return err
	}
	_, err = notificationagent.Register(account.Profile.Name, serverID)
	return err
}

// EnsurePingIdentityAfterLaunch retries registration in the background for a
// few minutes after the game is launched, which is when it is most likely to
// succeed.
func EnsurePingIdentityAfterLaunch() {
	if !notificationagent.Supported() {
		return
	}
	go func() {
		deadline := time.Now().Add(pingIdentityRetryWindow)
		for {
			err := EnsurePingIdentity()
			if err == nil {
				return
			}
			if time.Now().After(deadline) {
				fmt.Printf("Note: could not register for pings: %v\n", err)
				return
			}
			time.Sleep(pingIdentityRetryInterval)
		}
	}()
}

func activePrismAccount() (*prismAccount, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(prismPath, "accounts.json"))
	if err != nil {
		return nil, fmt.Errorf("read PrismLauncher accounts: %w", err)
	}
	var file struct {
		Accounts []prismAccount `json:"accounts"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("parse PrismLauncher accounts: %w", err)
	}

	var usable []*prismAccount
	for i := range file.Accounts {
		account := &file.Accounts[i]
		if account.Type != "MSA" || account.Profile.Name == "" || account.Ygg.Token == "" {
			continue
		}
		if account.Active {
			return account, nil
		}
		usable = append(usable, account)
	}
	// With no default set Prism asks which account to play as, unless there is
	// only one to choose from.
	if len(usable) == 1 {
		return usable[0], nil
	}
	return nil, errors.New("no default Minecraft account is set in PrismLauncher")
}

func joinMojangSession(account *prismAccount, serverID string) error {
	body, err := json.Marshal(map[string]string{
		"accessToken":     account.Ygg.Token,
		"selectedProfile": account.Profile.ID,
		"serverId":        serverID,
	})
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(mojangJoinURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("contact Mojang session server: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusNoContent, http.StatusOK:
		return nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return errors.New("PrismLauncher's Minecraft session has expired; it is refreshed the next time the game launches")
	default:
		return fmt.Errorf("Mojang session server returned %s", resp.Status)
	}
}

// newSessionServerID has the shape of the SHA-1 hex digest a Minecraft server
// would use. Its only job is to be unguessable.
func newSessionServerID() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
