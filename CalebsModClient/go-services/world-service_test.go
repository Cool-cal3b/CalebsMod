package go_services

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type worldRoundTripper func(*http.Request) (*http.Response, error)

func (fn worldRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) { return fn(req) }
func worldTestTransport(t *testing.T, world *ActiveWorld, files []SyncFile, contents map[string][]byte, changeOnLaunch *bool) {
	t.Helper()
	previous := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = previous })
	activeReads := 0
	http.DefaultTransport = worldRoundTripper(func(req *http.Request) (*http.Response, error) {
		status := 200
		var body []byte
		switch {
		case req.URL.Path == "/api/worlds/active":
			activeReads++
			next := *world
			if changeOnLaunch != nil && *changeOnLaunch && activeReads > 0 {
				next.Revision++
			}
			body, _ = json.Marshal(ActiveWorldResponse{World: &next})
		case strings.HasSuffix(req.URL.Path, "/pack"):
			if req.URL.Query().Get("revision") != fmt.Sprint(world.Revision) {
				t.Error("pack request was not revision-bound")
			}
			body, _ = json.Marshal(WorldPack{WorldID: world.ID, Generation: world.Generation, Revision: world.Revision, Files: files})
		case req.URL.Path == "/api/modpack/batch-zip":
			var payload struct {
				WorldID    string   `json:"worldId"`
				Revision   int      `json:"revision"`
				Generation string   `json:"generation"`
				Hashes     []string `json:"sha256s"`
			}
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				return nil, err
			}
			if payload.WorldID != world.ID || payload.Revision != world.Revision || payload.Generation != world.Generation {
				t.Error("batch request was not bound to the selected world and revision")
			}
			var buffer bytes.Buffer
			writer := zip.NewWriter(&buffer)
			for _, hash := range payload.Hashes {
				entry, _ := writer.Create(hash)
				entry.Write(contents[hash])
			}
			writer.Close()
			body = buffer.Bytes()
		default:
			status = 404
			body = []byte("unexpected test route")
		}
		return &http.Response{StatusCode: status, Status: fmt.Sprintf("%d", status), Header: make(http.Header), Body: io.NopCloser(bytes.NewReader(body))}, nil
	})
}
func worldFile(relative, contents, kind string) (SyncFile, []byte) {
	data := []byte(contents)
	hash := sha256.Sum256(data)
	return SyncFile{Sha256: hex.EncodeToString(hash[:]), RelativePath: relative, FileName: filepath.Base(relative), FileSize: int64(len(data)), FileType: kind}, data
}
func testWorld() *ActiveWorld {
	return &ActiveWorld{ID: "11111111-1111-4111-8111-111111111111", Name: "Original World", Original: true, Revision: 1, Generation: "generation", MinecraftVersion: MINECRAFT_VERSION, ForgeVersion: FORGE_VERSION}
}

func TestWorldSyncPreservesOriginalSettingsAndBindsDownloads(t *testing.T) {
	prism := t.TempDir()
	world := testWorld()
	instance := filepath.Join(prism, "instances", INSTANCE_NAME)
	root := GameRootPath(instance)
	for _, dir := range []string{"mods", "config", "saves/local", "screenshots"} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0755); err != nil {
			t.Fatal(err)
		}
	}
	os.WriteFile(filepath.Join(root, "config", "example.toml"), []byte("player settings"), 0644)
	os.WriteFile(filepath.Join(root, "mods", "obsolete.jar"), []byte("old mod"), 0644)
	os.WriteFile(filepath.Join(root, "saves", "local", "level.dat"), []byte("local save"), 0644)
	mod, data := worldFile("mods/current.jar", "current mod", "mod")
	config, configData := worldFile("config/example.toml", "default settings", "config")
	worldTestTransport(t, world, []SyncFile{mod, config}, map[string][]byte{mod.Sha256: data, config.Sha256: configData}, nil)
	if err := syncWorldInstance(prism, world); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(filepath.Join(root, "config", "example.toml"))
	if string(got) != "player settings" {
		t.Fatal("runtime config was overwritten")
	}
	got, _ = os.ReadFile(filepath.Join(root, "mods", "current.jar"))
	if string(got) != "current mod" {
		t.Fatal("mod was not installed")
	}
	if _, err := os.Stat(filepath.Join(root, "mods", "obsolete.jar")); !os.IsNotExist(err) {
		t.Fatal("obsolete mod is still loaded")
	}
	preserved, _ := os.ReadDir(filepath.Join(instance, "legacy-mods-preserved"))
	if len(preserved) != 1 {
		t.Fatal("obsolete legacy mod was not preserved")
	}
	if _, err := os.Stat(filepath.Join(root, "saves", "local", "level.dat")); err != nil {
		t.Fatal("local save was removed")
	}
}
func TestWorldSyncDoesNotCommitAfterWorldChanges(t *testing.T) {
	prism := t.TempDir()
	world := testWorld()
	mod, data := worldFile("mods/current.jar", "mod", "mod")
	changed := true
	worldTestTransport(t, world, []SyncFile{mod}, map[string][]byte{mod.Sha256: data}, &changed)
	if err := syncWorldInstance(prism, world); err == nil {
		t.Fatal("sync succeeded after active revision changed")
	}
	instance := filepath.Join(prism, "instances", INSTANCE_NAME)
	if _, err := os.Stat(filepath.Join(instance, ".calebs-world-sync.json")); !os.IsNotExist(err) {
		t.Fatal("partial revision was committed")
	}
	if _, err := os.Stat(filepath.Join(instance, ".calebs-world-sync.json.pending")); err != nil {
		t.Fatal("interrupted sync marker is missing")
	}
}
func TestWorldInstancesAndPathIsolation(t *testing.T) {
	original := testWorld()
	other := *original
	other.Original = false
	other.ID = "22222222-2222-4222-8222-222222222222"
	if worldInstanceName(original) == worldInstanceName(&other) {
		t.Fatal("worlds share an instance")
	}
	root := t.TempDir()
	for _, relative := range []string{"../world", "config/../../world", "saves/level.dat", "mods\\bad.jar", "config/bad:stream", "/mods/bad.jar", "mods/bad."} {
		if _, err := safeInstanceFile(root, relative); err == nil {
			t.Fatalf("unsafe path accepted: %s", relative)
		}
	}
}

func TestWorldRequestAllowsAuthenticatedDelete(t *testing.T) {
	previous := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = previous })
	endpoint := "/api/worlds/11111111-1111-4111-8111-111111111111"
	http.DefaultTransport = worldRoundTripper(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodDelete || req.URL.Path != endpoint {
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.Path)
		}
		if req.Header.Get("Authorization") != "Bearer "+GetToken() {
			t.Fatal("admin authorization header is missing")
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"deletedId":"world"}`))}, nil
	})
	if _, err := WorldRequest(http.MethodDelete, endpoint, ""); err != nil {
		t.Fatal(err)
	}
}

func TestNewWorldInstanceCarriesOptionsAndFollowsRenames(t *testing.T) {
	prism := t.TempDir()
	originalRoot := GameRootPath(filepath.Join(prism, "instances", INSTANCE_NAME))
	if err := os.MkdirAll(originalRoot, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(originalRoot, "options.txt"), []byte("key_key.jump:key.keyboard.space"), 0644); err != nil {
		t.Fatal(err)
	}
	world := &ActiveWorld{ID: "f94338b4-f198-44b7-bf1b-7f9b9dd00549", Name: "Season 2"}
	instance, err := ensureWorldInstance(prism, world)
	if err != nil {
		t.Fatal(err)
	}
	options, err := os.ReadFile(filepath.Join(GameRootPath(instance), "options.txt"))
	if err != nil || string(options) != "key_key.jump:key.keyboard.space" {
		t.Fatalf("options not carried over: %q %v", options, err)
	}
	// A player's later changes in the new world are never replaced.
	if err = os.WriteFile(filepath.Join(GameRootPath(instance), "options.txt"), []byte("changed"), 0644); err != nil {
		t.Fatal(err)
	}
	world.Name = "Season Two"
	if _, err = ensureWorldInstance(prism, world); err != nil {
		t.Fatal(err)
	}
	if options, _ = os.ReadFile(filepath.Join(GameRootPath(instance), "options.txt")); string(options) != "changed" {
		t.Fatalf("options overwritten: %q", options)
	}
	cfg, _ := os.ReadFile(filepath.Join(instance, "instance.cfg"))
	if !strings.Contains(string(cfg), "\nname=Season Two") && !strings.HasPrefix(string(cfg), "name=Season Two") {
		t.Fatalf("instance not renamed:\n%s", cfg)
	}
}
