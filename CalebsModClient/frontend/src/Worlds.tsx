import { useCallback, useEffect, useState } from "react";
import {
  WorldRequest,
  SelectWorldZIP,
  DownloadWorldBackup,
} from "../wailsjs/go/main/Admin";
import ConfirmModal from "./components/ConfirmModal";
import { useToast, errorText } from "./components/Toast";
import {
  GlobeIcon,
  PackageIcon,
  RestoreIcon,
  DownloadIcon,
  UploadIcon,
  SettingsIcon,
} from "./components/Icons";

type File = {
  relativePath: string;
  fileName: string;
  sha256: string;
  fileType: string;
  serverOnly: boolean;
  clientOnly: boolean;
};
type Backup = {
  id: string;
  kind: string;
  createdAt: number;
  size: number;
  sha256: string;
};
type World = {
  id: string;
  name: string;
  active: boolean;
  original: boolean;
  archived: boolean;
  initialized: boolean;
  revision: number;
  mods: number;
  pendingChanges: boolean;
  latestBackup: Backup | null;
};
type Setting = {
  key: string;
  label: string;
  description: string;
  type: string;
  value: string;
  min?: number;
  max?: number;
  options?: string[];
};
type Detail = World & {
  published: File[];
  draft: File[];
  backups: Backup[];
  settings: { settings: Setting[] };
};
type Operation = {
  id: string;
  kind: string;
  phase: string;
  status: string;
  error?: string;
  progress?: { done: number; total: number };
};
type List = {
  world: World | null;
  maintenance: boolean;
  editing: boolean;
  switchingEnabled: boolean;
  worlds: World[];
  operations: Operation[];
};
type Confirmation = {
  title: string;
  message: string;
  label: string;
  action: () => Promise<unknown>;
};

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  return JSON.parse(
    await WorldRequest(
      method,
      "/api/worlds" + endpoint,
      body === undefined ? "" : JSON.stringify(body),
    ),
  );
}

export default function Worlds({ players }: { players: string[] }) {
  const toast = useToast();
  const [list, setList] = useState<List | null>(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState("fresh");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [rename, setRename] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = busy || !!list?.maintenance || !!list?.editing;
  const refresh = useCallback(async () => {
    const next = await request<List>("GET", "");
    setList(next);
    setError("");
    setSelected((current) =>
      next.worlds.some((world) => world.id === current)
        ? current
        : next.world?.id || next.worlds[0]?.id || "",
    );
    setSource((current) =>
      next.worlds.some((world) => world.id === current) ? current : "",
    );
    if (next.operations.length) setOperation(next.operations[0]);
    return next;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    setSettings({});
    setSearch("");
    setDetail(null);
    setRename("");
    const poll = async () => {
      if (!selected) return;
      try {
        const next = await request<Detail>("GET", "/" + selected);
        if (!cancelled) setDetail(next);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selected]);
  useEffect(() => {
    if (!operation || operation.status !== "running") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await request<Operation>(
          "GET",
          "/operations/" + operation.id,
        );
        if (cancelled) return;
        setOperation(next);
        if (next.status === "completed") {
          toast.success("World operation completed");
          await refresh();
          if (selected) setDetail(await request<Detail>("GET", "/" + selected));
        }
        if (next.status === "failed" || next.status === "recovery_required")
          toast.error(
            "World operation failed",
            next.error || "Recovery is required.",
          );
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    };
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [operation?.id, operation?.status, refresh, selected, toast]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setConfirmation(null);
    try {
      const result = (await action()) as Operation | undefined;
      if (result?.id && result.status) setOperation(result);
      const next = await refresh();
      if (selected && next.worlds.some((world) => world.id === selected))
        setDetail(await request<Detail>("GET", "/" + selected));
      else setDetail(null);
    } catch (e) {
      toast.error("Could not complete action", errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = (
    title: string,
    message: string,
    label: string,
    action: () => Promise<unknown>,
  ) => setConfirmation({ title, message, label, action });
  const publishedByPath = new Map(
    detail?.published.map((f) => [f.relativePath, f]) || [],
  );
  const draftByPath = new Map(
    detail?.draft.map((f) => [f.relativePath, f]) || [],
  );
  const pending = [
    ...new Set([...publishedByPath.keys(), ...draftByPath.keys()]),
  ].filter(
    (path) =>
      JSON.stringify(publishedByPath.get(path)) !==
      JSON.stringify(draftByPath.get(path)),
  );
  const shown =
    detail?.draft.filter((f) =>
      (f.relativePath + " " + f.fileName)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  const playerText = players.length
    ? `Players currently online: ${players.join(", ")}. They will receive a 60-second warning before Minecraft stops.`
    : "If players join before maintenance starts, they will receive a 60-second warning.";
  return (
    <section className="worlds" aria-label="World management">
      <div className="page-head">
        <h1>Worlds</h1>
        <p className="lede">
          Each world keeps its own save, mods, and settings. One world runs at a
          time.
        </p>
      </div>
      {error && (
        <p className="t-warn" role="alert">
          {error}
        </p>
      )}
      {operation && (
        <div className="card world-operation" role="status">
          <strong>
            {operation.kind}: {operation.phase.replace(/_/g, " ")}
          </strong>
          <span>{operation.status.replace(/_/g, " ")}</span>
          {operation.status === "running" && operation.progress && (
            <span>
              Checked {operation.progress.done} of {operation.progress.total}{" "}
              backup files
            </span>
          )}
          {operation.error && <p className="t-warn">{operation.error}</p>}
        </div>
      )}
      {(list?.maintenance || list?.editing) && (
        <div className="card world-operation">
          <p>
            World controls are busy. Wait for the current operation to finish.
            Recover only if the server process was interrupted.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void run(() => request("POST", "/recover"))}
          >
            Recover interrupted operation
          </button>
        </div>
      )}
      {list && !list.world && (
        <div className="card">
          <div className="card__body">
            <h2>Preserve the existing world</h2>
            <p>
              Save and stop Minecraft, make a permanent recovery ZIP, and verify
              a restore before registering Original World. Its folder stays in
              place.
            </p>
            <button
              className="btn btn--primary"
              disabled={locked}
              onClick={() =>
                confirm(
                  "Preserve Original World?",
                  `${playerText} This creates and verifies a complete recovery backup before adopting the existing setup. Minecraft restarts if it was running.`,
                  "Back up and adopt",
                  () => request("POST", "/adopt"),
                )
              }
            >
              Back up and adopt Original World
            </button>
          </div>
        </div>
      )}
      {list?.world && (
        <>
          {!list.switchingEnabled && (
            <div className="card">
              <div className="card__body">
                <strong>
                  Switching is locked until client updates are released
                </strong>
                <p>
                  Release the updated Windows and macOS clients before enabling
                  switches.
                </p>
                <button
                  className="btn"
                  disabled={locked}
                  onClick={() =>
                    confirm(
                      "Enable world switching?",
                      "Confirm that the updated Windows and macOS clients have been released. Older clients cannot sync world-specific modpacks.",
                      "Enable switching",
                      () => request("POST", "/enable-switching"),
                    )
                  }
                >
                  Enable switching after client updates
                </button>
              </div>
            </div>
          )}
          <div className="world-toolbar">
            <label>
              Selected world{" "}
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {list.worlds
                  .filter((w) => showArchived || !w.archived)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.active ? " (active)" : ""}
                      {w.archived ? " (archived)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />{" "}
              Show archived
            </label>
          </div>
          <section className="card">
            <div className="card__head">
              <GlobeIcon />
              <h2>Add a world</h2>
            </div>
            <form
              className="card__body world-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (mode === "import") {
                    const result = await SelectWorldZIP(
                      "/api/worlds/import",
                      name,
                    );
                    return result ? JSON.parse(result) : undefined;
                  }
                  return request("POST", "", {
                    name,
                    sourceId: source || undefined,
                    copy: mode === "copy",
                    seed: mode === "fresh" && seed ? seed : undefined,
                  });
                });
              }}
            >
              <label>
                Name
                <input
                  value={name}
                  maxLength={80}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Create from
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="fresh">Fresh world</option>
                  <option value="copy">Copy a world and its progress</option>
                  <option value="import">Import complete backup ZIP</option>
                </select>
              </label>
              {mode !== "import" && (
                <label>
                  {mode === "copy"
                    ? "Source world"
                    : "Modpack and settings baseline"}
                  <select
                    value={source}
                    required={mode === "copy"}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">
                      {mode === "copy"
                        ? "Select a world"
                        : "Empty pack, then upload mods"}
                    </option>
                    {list.worlds.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "fresh" && (
                <label>
                  Seed (optional)
                  <input
                    value={seed}
                    maxLength={128}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
              )}
              <button
                className="btn btn--primary"
                disabled={locked || !name.trim()}
                type="submit"
              >
                {mode === "import" ? "Choose backup ZIP" : "Add world"}
              </button>
            </form>
          </section>
          {detail && (
            <>
              <section className="card">
                <div className="card__head">
                  <GlobeIcon />
                  <h2>{detail.name}</h2>
                  <span className="spacer" />
                  <span>
                    {detail.active
                      ? "Active"
                      : detail.archived
                        ? "Archived"
                        : "Inactive"}
                  </span>
                </div>
                <div className="card__body">
                  <p>
                    {detail.mods} mods · published revision {detail.revision} ·
                    Minecraft 1.20.1 / Forge 47.4.10
                  </p>
                  <div className="world-toolbar">
                    {!detail.active && !detail.archived && (
                      <button
                        className="btn btn--primary"
                        disabled={locked || !list.switchingEnabled}
                        onClick={() =>
                          confirm(
                            `Switch to ${detail.name}?`,
                            `${playerText} ${list.world?.name} will be saved and backed up before the selected world starts.`,
                            "Back up and switch",
                            () => request("POST", "/" + selected + "/switch"),
                          )
                        }
                      >
                        Switch to this world
                      </button>
                    )}
                    <button
                      className="btn"
                      disabled={locked}
                      onClick={() =>
                        confirm(
                          `Back up ${detail.name}?`,
                          `${detail.active ? playerText : ""} A running world is saved and stopped for a consistent ZIP, then restarted.`,
                          "Create backup",
                          () => request("POST", "/" + selected + "/backup"),
                        )
                      }
                    >
                      Create backup
                    </button>
                    {!detail.active && (
                      <button
                        className="btn"
                        disabled={locked}
                        onClick={() =>
                          void run(() =>
                            request("PATCH", "/" + selected, {
                              archived: !detail.archived,
                            }),
                          )
                        }
                      >
                        {detail.archived ? "Unarchive" : "Archive"}
                      </button>
                    )}
                    <button
                      className="btn btn--danger"
                      disabled={locked || detail.active || detail.original}
                      title={
                        detail.original
                          ? "Original World is protected"
                          : detail.active
                            ? "Switch to another world before deleting this one"
                            : undefined
                      }
                      onClick={() =>
                        confirm(
                          `Delete ${detail.name}?`,
                          `Permanently delete ${detail.name}, including its save, player progress, mods, settings, and all server backups. This cannot be undone. Download a backup first if you want to keep a copy.`,
                          "Delete world",
                          async () => {
                            await request("DELETE", "/" + detail.id);
                            toast.success("World deleted");
                          },
                        )
                      }
                    >
                      Delete world
                    </button>
                  </div>
                  <form
                    className="world-toolbar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(() =>
                        request("PATCH", "/" + selected, { name: rename }),
                      );
                    }}
                  >
                    <label>
                      Rename
                      <input
                        value={rename}
                        placeholder={detail.name}
                        maxLength={80}
                        onChange={(e) => setRename(e.target.value)}
                      />
                    </label>
                    <button className="btn" disabled={locked || !rename.trim()}>
                      Rename world
                    </button>
                  </form>
                </div>
              </section>
              <section className="card">
                <div className="card__head">
                  <PackageIcon />
                  <h2>Modpack for {detail.name}</h2>
                </div>
                <div className="card__body">
                  <p>
                    {pending.length} pending file changes. Uploads and edits
                    stay in a draft until applied.
                  </p>
                  <div className="world-toolbar">
                    <button
                      className="btn"
                      disabled={locked || detail.archived}
                      onClick={() =>
                        void run(async () => {
                          const result = await SelectWorldZIP(
                            "/api/worlds/" + selected + "/draft/upload",
                            "",
                          );
                          return result ? JSON.parse(result) : undefined;
                        })
                      }
                    >
                      <UploadIcon />
                      Upload to draft
                    </button>
                    <button
                      className="btn btn--primary"
                      disabled={locked || !pending.length || detail.archived}
                      onClick={() =>
                        confirm(
                          "Apply modpack changes?",
                          `${playerText} ${detail.name} is backed up before applying ${pending.length} changed paths: ${pending.slice(0, 8).join(", ")}${pending.length > 8 ? ", …" : ""}. Its running server will restart.`,
                          "Back up and apply",
                          () => request("POST", "/" + selected + "/apply"),
                        )
                      }
                    >
                      Apply changes
                    </button>
                    <button
                      className="btn"
                      disabled={locked || !pending.length}
                      onClick={() =>
                        confirm(
                          "Discard the draft?",
                          "This removes unpublished modpack edits and returns the draft to the published pack.",
                          "Discard draft",
                          () =>
                            request("PATCH", "/" + selected + "/draft", {
                              discard: true,
                            }),
                        )
                      }
                    >
                      Discard draft
                    </button>
                  </div>
                  <label>
                    Search pack files
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="world-file-list">
                    {shown.slice(0, 100).map((file) => (
                      <div className="world-file" key={file.relativePath}>
                        <span title={file.relativePath}>
                          {file.relativePath}
                        </span>
                        <select
                          aria-label={`Side for ${file.relativePath}`}
                          value={
                            file.serverOnly
                              ? "server"
                              : file.clientOnly
                                ? "client"
                                : "both"
                          }
                          disabled={locked}
                          onChange={(e) =>
                            void run(() =>
                              request("PATCH", "/" + selected + "/draft", {
                                relativePath: file.relativePath,
                                serverOnly: e.target.value === "server",
                                clientOnly: e.target.value === "client",
                              }),
                            )
                          }
                        >
                          <option value="both">Client and server</option>
                          <option value="server">Server only</option>
                          <option value="client">Client only</option>
                        </select>
                        <button
                          className="btn btn--ghost-danger btn--sm"
                          disabled={locked}
                          onClick={() =>
                            void run(() =>
                              request("PATCH", "/" + selected + "/draft", {
                                relativePath: file.relativePath,
                                remove: true,
                              }),
                            )
                          }
                        >
                          Remove from draft
                        </button>
                      </div>
                    ))}
                  </div>
                  <p>
                    {shown.length} matching files
                    {shown.length > 100 ? " (first 100 shown)" : ""}
                  </p>
                  {pending.length > 0 && (
                    <details>
                      <summary>All pending paths</summary>
                      <ul>
                        {pending.map((path) => (
                          <li key={path}>{path}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </section>
              <section className="card">
                <div className="card__head">
                  <SettingsIcon />
                  <h2>Settings for {detail.name}</h2>
                </div>
                <form
                  className="card__body"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const result = await request<{
                        restartRequired: string[];
                      }>("PATCH", "/" + selected + "/settings", { settings });
                      setSettings({});
                      if (result.restartRequired.length)
                        toast.success(
                          "Settings saved",
                          "Restart this world to apply the remaining settings.",
                        );
                      return result;
                    });
                  }}
                >
                  <div className="world-settings">
                    {detail.settings.settings.map((setting) => (
                      <label key={setting.key}>
                        {setting.label}
                        {setting.type === "boolean" || setting.options ? (
                          <select
                            value={settings[setting.key] ?? setting.value}
                            disabled={locked}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [setting.key]: e.target.value,
                              })
                            }
                          >
                            {(setting.options || ["true", "false"]).map(
                              (option) => (
                                <option key={option}>{option}</option>
                              ),
                            )}
                          </select>
                        ) : (
                          <input
                            type={setting.type === "number" ? "number" : "text"}
                            value={settings[setting.key] ?? setting.value}
                            min={setting.min}
                            max={setting.max}
                            disabled={locked}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [setting.key]: e.target.value,
                              })
                            }
                          />
                        )}
                        <small>{setting.description}</small>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn btn--primary"
                    disabled={locked || !Object.keys(settings).length}
                  >
                    Save settings
                  </button>
                </form>
              </section>
              <section className="card">
                <div className="card__head">
                  <RestoreIcon />
                  <h2>Backups for {detail.name}</h2>
                </div>
                <div className="card__body">
                  <p>
                    Keep the latest 10 automatic backups. Manual and migration
                    backups are retained. Restores create a separate world.
                  </p>
                  {detail.backups.length === 0 ? (
                    <p>No backups yet.</p>
                  ) : (
                    detail.backups.map((backup) => (
                      <div className="world-backup" key={backup.id}>
                        <div>
                          <strong>
                            {new Date(backup.createdAt).toLocaleString()}
                          </strong>
                          <p>
                            {backup.kind} ·{" "}
                            {(backup.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <div className="world-toolbar">
                          {backup.kind !== "migration" && (
                            <button
                              className="btn btn--sm"
                              disabled={busy}
                              onClick={() =>
                                void run(() => DownloadWorldBackup(backup.id))
                              }
                            >
                              <DownloadIcon />
                              Download ZIP
                            </button>
                          )}
                          <button
                            className="btn btn--sm"
                            disabled={locked}
                            onClick={() =>
                              confirm(
                                "Restore as a new world?",
                                `Create a separate world named ${detail.name} (restored). Review it before switching.`,
                                "Restore copy",
                                () =>
                                  request(
                                    "POST",
                                    "/backups/" + backup.id + "/restore",
                                    {
                                      name:
                                        detail.name.slice(0, 65) +
                                        " (restored)",
                                    },
                                  ),
                              )
                            }
                          >
                            Restore copy
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
      <ConfirmModal
        isOpen={!!confirmation}
        title={confirmation?.title || ""}
        message={confirmation?.message || ""}
        confirmLabel={confirmation?.label}
        tone="neutral"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) void run(confirmation.action);
        }}
      />
    </section>
  );
}
