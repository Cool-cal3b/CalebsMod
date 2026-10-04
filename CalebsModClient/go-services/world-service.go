package go_services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type ActiveWorld struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Original         bool   `json:"original"`
	Revision         int    `json:"revision"`
	Generation       string `json:"generation"`
	MinecraftVersion string `json:"minecraftVersion"`
	ForgeVersion     string `json:"forgeVersion"`
}
type ActiveWorldResponse struct {
	World       *ActiveWorld `json:"world"`
	Maintenance bool         `json:"maintenance"`
}
type WorldPack struct {
	WorldID    string     `json:"worldId"`
	Generation string     `json:"generation"`
	Revision   int        `json:"revision"`
	Files      []SyncFile `json:"files"`
}

var worldIDPattern = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)
var worldHashPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)
var worldSyncMutex sync.Mutex

func FetchActiveWorld() (ActiveWorldResponse, error) {
	var out ActiveWorldResponse
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Get(GetServerUrl() + "/api/worlds/active")
	if err != nil {
		return out, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return out, nil
	} // Server before world management was installed.
	if resp.StatusCode != 200 {
		return out, fmt.Errorf("world status failed: %s", resp.Status)
	}
	if err = json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return out, err
	}
	if out.World != nil && (!worldIDPattern.MatchString(out.World.ID) || out.World.MinecraftVersion != MINECRAFT_VERSION || out.World.ForgeVersion != FORGE_VERSION) {
		return out, fmt.Errorf("world uses unsupported identity or Minecraft versions")
	}
	return out, nil
}
func worldInstanceName(world *ActiveWorld) string {
	if world.Original {
		return INSTANCE_NAME
	}
	return "CalebsMod-" + world.ID
}
func fetchWorldPack(world *ActiveWorld) (WorldPack, error) {
	var pack WorldPack
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Get(fmt.Sprintf("%s/api/worlds/%s/pack?revision=%d", GetServerUrl(), world.ID, world.Revision))
	if err != nil {
		return pack, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return pack, fmt.Errorf("world changed or is in maintenance; retry when it is ready (%s)", resp.Status)
	}
	err = json.NewDecoder(resp.Body).Decode(&pack)
	if err == nil && (pack.WorldID != world.ID || pack.Generation != world.Generation || pack.Revision != world.Revision) {
		err = fmt.Errorf("pack does not match the selected world")
	}
	seen := map[string]bool{}
	for _, f := range pack.Files {
		if _, pathErr := safeInstanceFile("root", f.RelativePath); pathErr != nil {
			return pack, pathErr
		}
		key := strings.ToLower(f.RelativePath)
		if seen[key] || !worldHashPattern.MatchString(f.Sha256) {
			return pack, fmt.Errorf("invalid pack manifest")
		}
		seen[key] = true
	}
	return pack, err
}
func safeInstanceFile(root, relative string) (string, error) {
	if relative == "" || strings.ContainsAny(relative, "\\:\x00") || strings.HasPrefix(relative, "/") {
		return "", fmt.Errorf("unsafe pack path: %s", relative)
	}
	for _, part := range strings.Split(relative, "/") {
		if part == "" || part == "." || part == ".." || strings.TrimRight(part, ". ") != part {
			return "", fmt.Errorf("unsafe pack path: %s", relative)
		}
	}
	allowed := false
	for _, dir := range []string{"mods/", "config/", "defaultconfigs/", "resourcepacks/", "shaderpacks/", "panoramas/", "thingpacks/", "fancymenu_data/", "globalresources/", "patchouli_books/"} {
		if strings.HasPrefix(relative, dir) {
			allowed = true
		}
	}
	if !allowed && relative != "options.txt" && relative != "servers.dat" && relative != "server.dat" {
		return "", fmt.Errorf("unmanaged pack path: %s", relative)
	}
	target := filepath.Join(root, filepath.FromSlash(relative))
	current := root
	for _, part := range strings.Split(relative, "/") {
		if info, err := os.Lstat(current); err == nil && info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("instance path contains a link")
		}
		current = filepath.Join(current, part)
	}
	if info, err := os.Lstat(target); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("instance target is a link")
	}
	return target, nil
}
func ensureWorldInstance(prism string, world *ActiveWorld) (string, error) {
	instance := filepath.Join(prism, "instances", worldInstanceName(world))
	if err := os.MkdirAll(GameRootPath(instance), 0755); err != nil {
		return "", err
	}
	for name, contents := range map[string]string{"instance.cfg": strings.Replace(buildInstanceCfg(), "name=CalebsMod", "name="+strings.NewReplacer("\n", " ", "\r", " ").Replace(world.Name), 1), "mmc-pack.json": buildMmcPackJson()} {
		target := filepath.Join(instance, name)
		if _, err := os.Stat(target); os.IsNotExist(err) {
			if err = os.WriteFile(target, []byte(contents), 0644); err != nil {
				return "", err
			}
		}
	}
	return instance, nil
}
func syncWorldInstance(prism string, world *ActiveWorld) error {
	worldSyncMutex.Lock()
	defer worldSyncMutex.Unlock()
	instance, err := ensureWorldInstance(prism, world)
	if err != nil {
		return err
	}
	root := GameRootPath(instance)
	pack, err := fetchWorldPack(world)
	if err != nil {
		return err
	}
	statePath := filepath.Join(instance, ".calebs-world-sync.json")
	var previous WorldPack
	if data, readErr := os.ReadFile(statePath); readErr == nil {
		if err = json.Unmarshal(data, &previous); err != nil {
			return fmt.Errorf("local sync state is invalid: %w", err)
		}
	}
	if previous.WorldID != "" && previous.WorldID != world.ID {
		return fmt.Errorf("instance belongs to a different world")
	}
	if previous.WorldID == "" && world.Original {
		// Preserve obsolete legacy JARs outside the live mods directory. They have
		// no previous managed-path inventory, and leaving them loaded breaks Forge.
		expected := map[string]bool{}
		for _, f := range pack.Files {
			expected[strings.ToLower(f.RelativePath)] = true
		}
		entries, readErr := os.ReadDir(filepath.Join(root, "mods"))
		if readErr != nil && !os.IsNotExist(readErr) {
			return readErr
		}
		for _, entry := range entries {
			relative := "mods/" + entry.Name()
			if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".jar") || expected[strings.ToLower(relative)] {
				continue
			}
			source, pathErr := safeInstanceFile(root, relative)
			if pathErr != nil {
				return pathErr
			}
			directory := filepath.Join(instance, "legacy-mods-preserved")
			if err = os.MkdirAll(directory, 0755); err != nil {
				return err
			}
			destination := filepath.Join(directory, fmt.Sprintf("%d-%s", time.Now().UnixNano(), entry.Name()))
			if err = os.Rename(source, destination); err != nil {
				return err
			}
		}
	}
	old := map[string]SyncFile{}
	for _, f := range previous.Files {
		old[f.RelativePath] = f
	}
	next := map[string]SyncFile{}
	for _, f := range pack.Files {
		next[f.RelativePath] = f
	}
	pendingPath := statePath + ".pending"
	if err = os.WriteFile(pendingPath, []byte("syncing"), 0644); err != nil {
		return err
	}
	changed := []SyncFile{}
	unchanged := []SyncFile{}
	for _, f := range pack.Files {
		prior, exists := old[f.RelativePath]
		if exists && prior.Sha256 != f.Sha256 || f.FileType == "mod" && previous.WorldID == "" {
			changed = append(changed, f)
		} else {
			unchanged = append(unchanged, f)
		}
	}
	// Runtime-written configs are preserved unless their published entry changed.
	if err = syncBoundFiles(root, changed, verifyHash, world); err != nil {
		return err
	}
	if err = syncBoundFiles(root, unchanged, verifyMissing, world); err != nil {
		return err
	}
	for relative := range old {
		if _, exists := next[relative]; exists {
			continue
		}
		target, pathErr := safeInstanceFile(root, relative)
		if pathErr != nil {
			return pathErr
		}
		if err = os.Remove(target); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	if err = addServerToServersFile(root); err != nil {
		return err
	}
	active, err := FetchActiveWorld()
	if err != nil {
		return err
	}
	if active.Maintenance || active.World == nil || active.World.ID != world.ID || active.World.Revision != world.Revision || active.World.Generation != world.Generation {
		return fmt.Errorf("world changed during sync; retry")
	}
	data, err := json.Marshal(pack)
	if err != nil {
		return err
	}
	tmp := statePath + ".tmp"
	if err = os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	if err = os.Rename(tmp, statePath); err != nil {
		return err
	}
	return os.Remove(pendingPath)
}
func syncBoundFiles(root string, files []SyncFile, mode verifyMode, world *ActiveWorld) error {
	for _, file := range files {
		if _, err := safeInstanceFile(root, file.RelativePath); err != nil {
			return err
		}
	}
	pending := pendingFiles(root, files, mode)
	done := 0
	for _, batch := range batchFiles(pending) {
		var last error
		for attempt := 0; attempt < syncBatchAttempts; attempt++ {
			zipPath, err := downloadBatch(batch, world)
			if err == nil {
				targets := map[string][]string{}
				for _, f := range batch {
					targets[f.Sha256] = append(targets[f.Sha256], f.RelativePath)
				}
				err = extractBatch(zipPath, root, targets)
				os.Remove(zipPath)
			}
			last = err
			if err == nil {
				break
			}
		}
		if last != nil {
			return last
		}
		done += len(batch)
		reportProgress("downloading", done, len(pending))
	}
	return nil
}
func startWorldMinecraftClient(world *ActiveWorld) (bool, error) {
	prism, err := ensurePrismLauncherInstalled()
	if err != nil {
		return false, err
	}
	if err = syncWorldInstance(prism, world); err != nil {
		return false, err
	}
	active, err := FetchActiveWorld()
	if err != nil {
		return false, err
	}
	if active.Maintenance || active.World == nil || active.World.ID != world.ID || active.World.Revision != world.Revision {
		return false, fmt.Errorf("world changed before launch; retry")
	}
	address, err := getServerAddress()
	if err != nil {
		return false, err
	}
	address = reachableGameAddress(strings.Split(address, ":")[0])
	err = launchPrismInstance(prism, worldInstanceName(world), address)
	return err == nil, err
}
func resetWorldClient(world *ActiveWorld) (bool, error) {
	prism, err := getPrismLauncherPath()
	if err != nil {
		return false, err
	}
	if err = KillPrismLauncher(); err != nil {
		return false, err
	}
	instance := filepath.Join(prism, "instances", worldInstanceName(world))
	pack, err := fetchWorldPack(world)
	if err != nil {
		return false, err
	}
	for _, f := range pack.Files {
		if f.RelativePath == "options.txt" || f.RelativePath == "servers.dat" {
			continue
		}
		target, pathErr := safeInstanceFile(GameRootPath(instance), f.RelativePath)
		if pathErr != nil {
			return false, pathErr
		}
		if err = os.Remove(target); err != nil && !os.IsNotExist(err) {
			return false, err
		}
	}
	err = syncWorldInstance(prism, world)
	return err == nil, err
}

func WorldRequest(method, endpoint, payload string) (string, error) {
	if !strings.HasPrefix(endpoint, "/api/worlds") || strings.Contains(endpoint, "..") {
		return "", fmt.Errorf("invalid world endpoint")
	}
	if method != "GET" && method != "POST" && method != "PATCH" {
		return "", fmt.Errorf("invalid request method")
	}
	req, err := http.NewRequest(method, GetServerUrl()+endpoint, strings.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+GetToken())
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 32*1024*1024))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%s", body)
	}
	return string(body), nil
}
func UploadWorldFile(endpoint, file, name string) (string, error) {
	if !strings.HasPrefix(endpoint, "/api/worlds/") || strings.Contains(endpoint, "..") {
		return "", fmt.Errorf("invalid upload endpoint")
	}
	input, err := os.Open(file)
	if err != nil {
		return "", err
	}
	defer input.Close()
	reader, writer := io.Pipe()
	defer reader.Close()
	multipartWriter := multipart.NewWriter(writer)
	go func() {
		if name != "" {
			if err := multipartWriter.WriteField("name", name); err != nil {
				writer.CloseWithError(err)
				return
			}
		}
		part, err := multipartWriter.CreateFormFile("file", filepath.Base(file))
		if err == nil {
			_, err = io.Copy(part, input)
		}
		if err == nil {
			err = multipartWriter.Close()
		}
		writer.CloseWithError(err)
	}()
	req, err := http.NewRequest("POST", GetServerUrl()+endpoint, reader)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+GetToken())
	req.Header.Set("Content-Type", multipartWriter.FormDataContentType())
	resp, err := (&http.Client{Timeout: time.Hour}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%s", body)
	}
	return string(body), nil
}
func DownloadWorldBackup(id, destination string) error {
	if !worldIDPattern.MatchString(id) {
		return fmt.Errorf("invalid backup id")
	}
	req, err := http.NewRequest("GET", GetServerUrl()+"/api/worlds/backups/"+url.PathEscape(id)+"/download", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+GetToken())
	resp, err := (&http.Client{Timeout: time.Hour}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("backup download failed: %s", resp.Status)
	}
	file, err := os.CreateTemp(filepath.Dir(destination), "world-backup-*.partial")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	hash := sha256.New()
	_, err = io.Copy(io.MultiWriter(file, hash), resp.Body)
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if expected := resp.Header.Get("X-Checksum-Sha256"); expected == "" || hex.EncodeToString(hash.Sum(nil)) != expected {
		return fmt.Errorf("backup checksum mismatch")
	}
	return os.Rename(file.Name(), destination)
}
