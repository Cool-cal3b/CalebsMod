import { useCallback, useEffect, useState } from "react";
import {
  WorldRequest,
  SelectWorldZIP,
  DownloadWorldBackup,
} from "../wailsjs/go/main/Admin";
import ConfirmModal from "./components/ConfirmModal";
import Progress from "./components/Progress";
import { useToast, errorText } from "./components/Toast";
import {
  AlertIcon,
  ArchiveIcon,
  CheckCircleIcon,
  DownloadIcon,
  GlobeIcon,
  PackageIcon,
  PlusIcon,
  RestoreIcon,
  SettingsIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
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
  danger?: boolean;
  action: () => Promise<unknown>;
};
type Tab = "modpack" | "settings" | "backups" | "manage";

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

const words = (s: string) => {
  const text = s.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function ago(ms: number) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const megabytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

function splitPath(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? ["", path] : [path.slice(0, i + 1), path.slice(i + 1)];
}

export default function Worlds({ players }: { players: string[] }) {
  const toast = useToast();
  const [list, setList] = useState<List | null>(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [dismissed, setDismissed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState("fresh");
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState<Tab>("modpack");
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
      return true;
    } catch (e) {
      toast.error("Could not complete action", errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const confirm = (
    title: string,
    message: string,
    label: string,
    action: () => Promise<unknown>,
    danger = false,
  ) => setConfirmation({ title, message, label, action, danger });
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
  const pendingSet = new Set(pending);
  const shown =
    detail?.draft.filter((f) =>
      (f.relativePath + " " + f.fileName)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  const dirtySettings = Object.keys(settings).length;
  const archivedCount = list?.worlds.filter((w) => w.archived).length || 0;
  const visibleWorlds =
    list?.worlds.filter(
      (w) => showArchived || !w.archived || w.id === selected,
    ) || [];
  const playerText = players.length
    ? `Players currently online: ${players.join(", ")}. They will receive a 60-second warning before Minecraft stops.`
    : "If players join before maintenance starts, they will receive a 60-second warning.";
  const opRunning = operation?.status === "running";
  const opFailed =
    operation?.status === "failed" || operation?.status === "recovery_required";
  const showOperation =
    operation && (opRunning || operation.id !== dismissed);
  const submitCreate = async () => {
    const ok = await run(async () => {
      if (mode === "import") {
        const result = await SelectWorldZIP("/api/worlds/import", name);
        return result ? JSON.parse(result) : undefined;
      }
      return request("POST", "", {
        name,
        sourceId: source || undefined,
        copy: mode === "copy",
        seed: mode === "fresh" && seed ? seed : undefined,
      });
    });
    if (ok) {
      setCreating(false);
      setName("");
      setSeed("");
    }
  };

  return (
    <section className="worlds" aria-label="World management">
      {error && (
        <div className="notice notice--danger" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}
      {showOperation && operation && (
        <div
          className={`card op-banner${opFailed ? " op-banner--failed" : ""}`}
          role="status"
        >
          {opRunning ? (
            <Progress
              label={`${words(operation.kind)}: ${words(operation.phase).toLowerCase()}${
                operation.progress
                  ? ` (checked ${operation.progress.done} of ${operation.progress.total} backup files)`
                  : ""
              }`}
              percent={
                operation.progress && operation.progress.total
                  ? (operation.progress.done / operation.progress.total) * 100
                  : null
              }
            />
          ) : (
            <div className="op-banner__row">
              {opFailed ? (
                <AlertIcon className="op-banner__icon t-warn" />
              ) : (
                <CheckCircleIcon className="op-banner__icon t-ok" />
              )}
              <div className="op-banner__text">
                <strong>
                  {words(operation.kind)} {words(operation.status).toLowerCase()}
                </strong>
                {operation.error ? (
                  <span>{operation.error}</span>
                ) : (
                  <span>Last step: {words(operation.phase).toLowerCase()}</span>
                )}
              </div>
              <button
                className="icon-btn"
                aria-label="Dismiss"
                onClick={() => setDismissed(operation.id)}
              >
                <XIcon />
              </button>
            </div>
          )}
        </div>
      )}
      {(list?.maintenance || list?.editing) && (
        <div className="notice notice--warn notice--action">
          <AlertIcon />
          <span>
            World controls are locked while an operation runs. Recover only if
            the server process was interrupted.
          </span>
          <button
            className="btn btn--sm"
            disabled={busy}
            onClick={() => void run(() => request("POST", "/recover"))}
          >
            Recover interrupted operation
          </button>
        </div>
      )}
      {list?.world && !list.switchingEnabled && (
        <div className="notice notice--info notice--action">
          <ShieldIcon />
          <span>
            <strong>Switching is locked.</strong> Release the updated Windows
            and macOS clients first; older clients cannot sync world-specific
            modpacks.
          </span>
          <button
            className="btn btn--sm"
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
            Enable switching
          </button>
        </div>
      )}

      {!list ? (
        <div className="card worlds-empty">
          <span className="spinner" />
          Loading worlds…
        </div>
      ) : !list.world ? (
        <div className="card worlds-empty worlds-empty--adopt">
          <GlobeIcon className="worlds-empty__icon" />
          <h2>Preserve the existing world</h2>
          <p className="muted">
            Save and stop Minecraft, make a permanent recovery ZIP, and verify a
            restore before registering Original World. Its folder stays in
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
      ) : (
        <div className="worlds-layout">
          <aside className="card world-nav" aria-label="Worlds">
            <div className="world-nav__head">
              <h2>Worlds</h2>
              <button
                className="btn btn--sm"
                disabled={locked}
                onClick={() => setCreating(true)}
              >
                <PlusIcon />
                New
              </button>
            </div>
            <nav className="world-nav__list">
              {visibleWorlds.map((w) => (
                <button
                  key={w.id}
                  className={`world-nav__item${w.id === selected ? " is-selected" : ""}${w.archived ? " is-archived" : ""}`}
                  aria-current={w.id === selected ? "true" : undefined}
                  onClick={() => setSelected(w.id)}
                >
                  <span className="world-nav__name">
                    <span
                      className={w.active ? "dot dot--ok" : "dot dot--off"}
                      title={w.active ? "Active" : undefined}
                    />
                    <span className="world-nav__label">{w.name}</span>
                    {w.pendingChanges && (
                      <span
                        className="world-nav__pending"
                        title="Unapplied modpack changes"
                      />
                    )}
                  </span>
                  <span className="world-nav__meta">
                    {w.active
                      ? "Active"
                      : w.archived
                        ? "Archived"
                        : `${w.mods} mods`}
                    {" · "}
                    {w.latestBackup
                      ? `backed up ${ago(w.latestBackup.createdAt)}`
                      : "no backup"}
                  </span>
                </button>
              ))}
            </nav>
            {archivedCount > 0 && (
              <label className="world-nav__foot">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived ({archivedCount})
              </label>
            )}
          </aside>

          <div className="card world-detail">
            {!detail ? (
              <div className="worlds-empty">
                <span className="spinner" />
                Loading world…
              </div>
            ) : (
              <>
                <header className="world-detail__head">
                  <div className="world-detail__title">
                    <div className="row row--wrap">
                      <h2>{detail.name}</h2>
                      {detail.active && (
                        <span className="badge badge--ok">Active</span>
                      )}
                      {detail.archived && <span className="badge">Archived</span>}
                      {detail.original && (
                        <span className="badge badge--info">Original</span>
                      )}
                    </div>
                    <p className="meta">
                      {detail.mods} mods · revision {detail.revision} ·
                      Minecraft 1.20.1 · Forge 47.4.10
                    </p>
                  </div>
                  <div className="world-detail__actions">
                    <button
                      className="btn"
                      disabled={locked}
                      onClick={() =>
                        confirm(
                          `Back up ${detail.name}?`,
                          `${detail.active ? playerText + " " : ""}A running world is saved and stopped for a consistent ZIP, then restarted.`,
                          "Create backup",
                          () => request("POST", "/" + selected + "/backup"),
                        )
                      }
                    >
                      <RestoreIcon />
                      Back up now
                    </button>
                    {!detail.active && !detail.archived && (
                      <button
                        className="btn btn--primary"
                        disabled={locked || !list.switchingEnabled}
                        title={
                          list.switchingEnabled
                            ? undefined
                            : "Enable switching first"
                        }
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
                  </div>
                </header>

                <div className="tabs" role="tablist">
                  {(
                    [
                      ["modpack", "Modpack", PackageIcon, pending.length],
                      ["settings", "Settings", SettingsIcon, dirtySettings],
                      ["backups", "Backups", RestoreIcon, detail.backups.length],
                      ["manage", "Manage", ArchiveIcon, 0],
                    ] as const
                  ).map(([key, label, Icon, count]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={tab === key}
                      className={`tabs__tab${tab === key ? " is-active" : ""}`}
                      onClick={() => setTab(key)}
                    >
                      <Icon />
                      {label}
                      {count > 0 && (
                        <span
                          className={`tabs__count${
                            key !== "backups" ? " tabs__count--warn" : ""
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="world-detail__body" role="tabpanel">
                  {tab === "modpack" && (
                    <>
                      {pending.length > 0 ? (
                        <div className="notice notice--warn notice--action">
                          <AlertIcon />
                          <span>
                            <strong>
                              {pending.length} unapplied{" "}
                              {pending.length === 1 ? "change" : "changes"}.
                            </strong>{" "}
                            Players get them after you apply; the world is
                            backed up first.
                          </span>
                          <button
                            className="btn btn--sm btn--ghost"
                            disabled={locked}
                            onClick={() =>
                              confirm(
                                "Discard the draft?",
                                "This removes unpublished modpack edits and returns the draft to the published pack.",
                                "Discard draft",
                                () =>
                                  request("PATCH", "/" + selected + "/draft", {
                                    discard: true,
                                  }),
                                true,
                              )
                            }
                          >
                            Discard
                          </button>
                          <button
                            className="btn btn--sm btn--primary"
                            disabled={locked || detail.archived}
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
                        </div>
                      ) : (
                        <p className="meta">
                          Uploads and edits go into a draft. Nothing reaches
                          players until you apply it.
                        </p>
                      )}
                      <div className="pack-toolbar">
                        <input
                          className="input input--search"
                          type="search"
                          placeholder="Search pack files"
                          aria-label="Search pack files"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
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
                          Upload ZIP
                        </button>
                      </div>
                      <div className="pack-list">
                        {shown.length === 0 ? (
                          <p className="pack-list__empty">
                            {search
                              ? "No files match your search."
                              : "This pack is empty. Upload a ZIP to add mods."}
                          </p>
                        ) : (
                          shown.slice(0, 100).map((file) => {
                            const [dir, base] = splitPath(file.relativePath);
                            return (
                              <div className="pack-row" key={file.relativePath}>
                                <div
                                  className="pack-row__path"
                                  title={file.relativePath}
                                >
                                  <span className="pack-row__name">
                                    {base}
                                    {pendingSet.has(file.relativePath) && (
                                      <span className="badge badge--warn">
                                        Changed
                                      </span>
                                    )}
                                  </span>
                                  <span className="pack-row__dir">{dir}</span>
                                </div>
                                <select
                                  className="input select select--sm"
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
                                      request(
                                        "PATCH",
                                        "/" + selected + "/draft",
                                        {
                                          relativePath: file.relativePath,
                                          serverOnly:
                                            e.target.value === "server",
                                          clientOnly:
                                            e.target.value === "client",
                                        },
                                      ),
                                    )
                                  }
                                >
                                  <option value="both">Client and server</option>
                                  <option value="server">Server only</option>
                                  <option value="client">Client only</option>
                                </select>
                                <button
                                  className="icon-btn icon-btn--danger"
                                  aria-label={`Remove ${file.relativePath} from draft`}
                                  title="Remove from draft"
                                  disabled={locked}
                                  onClick={() =>
                                    void run(() =>
                                      request(
                                        "PATCH",
                                        "/" + selected + "/draft",
                                        {
                                          relativePath: file.relativePath,
                                          remove: true,
                                        },
                                      ),
                                    )
                                  }
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="pack-foot">
                        <span className="meta">
                          {shown.length} {search ? "matching" : ""} files
                          {shown.length > 100 ? ", first 100 shown" : ""}
                        </span>
                        {pending.length > 0 && (
                          <details className="pack-pending">
                            <summary>All changed paths</summary>
                            <ul>
                              {pending.map((path) => (
                                <li key={path}>
                                  {path}
                                  {!draftByPath.has(path) && (
                                    <span className="badge badge--danger">
                                      Removed
                                    </span>
                                  )}
                                  {!publishedByPath.has(path) && (
                                    <span className="badge badge--ok">
                                      Added
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </>
                  )}

                  {tab === "settings" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          const result = await request<{
                            restartRequired: string[];
                          }>("PATCH", "/" + selected + "/settings", {
                            settings,
                          });
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
                      <div className="settings-grid">
                        {detail.settings.settings.map((setting) => {
                          const dirty = setting.key in settings;
                          return (
                            <label className="field" key={setting.key}>
                              <span className="field__label">
                                {setting.label}
                                {dirty && (
                                  <span className="field__dirty">Edited</span>
                                )}
                              </span>
                              {setting.type === "boolean" || setting.options ? (
                                <select
                                  className="input select"
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
                                  className="input"
                                  type={
                                    setting.type === "number" ? "number" : "text"
                                  }
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
                              <span className="field__hint">
                                {setting.description}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div
                        className={`save-bar${dirtySettings ? " is-dirty" : ""}`}
                      >
                        <span className="meta">
                          {dirtySettings
                            ? `${dirtySettings} unsaved ${dirtySettings === 1 ? "change" : "changes"}`
                            : "All settings saved"}
                        </span>
                        <span className="spacer" />
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={!dirtySettings}
                          onClick={() => setSettings({})}
                        >
                          Reset
                        </button>
                        <button
                          className="btn btn--primary"
                          disabled={locked || !dirtySettings}
                        >
                          Save settings
                        </button>
                      </div>
                    </form>
                  )}

                  {tab === "backups" && (
                    <>
                      <p className="meta">
                        The latest 10 automatic backups are kept. Manual and
                        migration backups are kept forever. Restoring creates
                        a separate world, so nothing is overwritten.
                      </p>
                      {detail.backups.length === 0 ? (
                        <p className="pack-list__empty">No backups yet.</p>
                      ) : (
                        <div className="pack-list">
                          {detail.backups.map((backup) => (
                            <div className="backup-row" key={backup.id}>
                              <div className="backup-row__info">
                                <strong>
                                  {new Date(backup.createdAt).toLocaleString()}
                                </strong>
                                <span className="meta">
                                  {ago(backup.createdAt)} ·{" "}
                                  {megabytes(backup.size)}
                                </span>
                              </div>
                              <span className="badge">{words(backup.kind)}</span>
                              <div className="backup-row__actions">
                                {backup.kind !== "migration" && (
                                  <button
                                    className="btn btn--sm btn--ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      void run(() =>
                                        DownloadWorldBackup(backup.id),
                                      )
                                    }
                                  >
                                    <DownloadIcon />
                                    Download
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
                                  Restore as copy
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {tab === "manage" && (
                    <div className="manage-list">
                      <form
                        className="manage-row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(() =>
                            request("PATCH", "/" + selected, { name: rename }),
                          ).then((ok) => ok && setRename(""));
                        }}
                      >
                        <div className="manage-row__text">
                          <strong>Rename</strong>
                          <span className="meta">
                            Shown to players in the launcher.
                          </span>
                        </div>
                        <div className="manage-row__control">
                          <input
                            className="input"
                            aria-label="New world name"
                            value={rename}
                            placeholder={detail.name}
                            maxLength={80}
                            onChange={(e) => setRename(e.target.value)}
                          />
                          <button
                            className="btn"
                            disabled={locked || !rename.trim()}
                          >
                            Rename
                          </button>
                        </div>
                      </form>
                      <div className="manage-row">
                        <div className="manage-row__text">
                          <strong>
                            {detail.archived ? "Unarchive" : "Archive"}
                          </strong>
                          <span className="meta">
                            {detail.active
                              ? "Switch to another world before archiving this one."
                              : detail.archived
                                ? "Return this world to the main list."
                                : "Hide this world from the list. Its save and backups are kept."}
                          </span>
                        </div>
                        <button
                          className="btn"
                          disabled={locked || detail.active}
                          onClick={() =>
                            void run(() =>
                              request("PATCH", "/" + selected, {
                                archived: !detail.archived,
                              }),
                            )
                          }
                        >
                          <ArchiveIcon />
                          {detail.archived ? "Unarchive" : "Archive"}
                        </button>
                      </div>
                      <div className="manage-row manage-row--danger">
                        <div className="manage-row__text">
                          <strong>Delete world</strong>
                          <span className="meta">
                            {detail.original
                              ? "Original World is protected and cannot be deleted."
                              : detail.active
                                ? "Switch to another world before deleting this one."
                                : "Permanently removes the save, mods, settings, and every backup."}
                          </span>
                        </div>
                        <button
                          className="btn btn--danger"
                          disabled={locked || detail.active || detail.original}
                          onClick={() =>
                            confirm(
                              `Delete ${detail.name}?`,
                              `Permanently delete ${detail.name}, including its save, player progress, mods, settings, and all server backups. This cannot be undone. Download a backup first if you want to keep a copy.`,
                              "Delete world",
                              async () => {
                                await request("DELETE", "/" + detail.id);
                                toast.success("World deleted");
                              },
                              true,
                            )
                          }
                        >
                          <TrashIcon />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {creating && list && (
        <div className="modal__scrim" onClick={() => setCreating(false)}>
          <form
            className="modal modal--form"
            role="dialog"
            aria-modal="true"
            aria-label="New world"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
            onSubmit={(e) => {
              e.preventDefault();
              void submitCreate();
            }}
          >
            <h2 className="modal__title">New world</h2>
            <p className="modal__message">
              Each world keeps its own save, modpack, and settings. Only one
              runs at a time.
            </p>
            <div className="segmented" role="radiogroup" aria-label="Start from">
              {[
                ["fresh", "Fresh world"],
                ["copy", "Copy a world"],
                ["import", "Import ZIP"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  className={`segmented__opt${mode === value ? " is-active" : ""}`}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field__label">Name</span>
              <input
                className="input"
                value={name}
                maxLength={80}
                required
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {mode !== "import" && (
              <label className="field">
                <span className="field__label">
                  {mode === "copy" ? "Source world" : "Start with modpack from"}
                </span>
                <select
                  className="input select"
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
                <span className="field__hint">
                  {mode === "copy"
                    ? "Copies the save, player progress, modpack, and settings."
                    : "Copies only the modpack and settings. The map is new."}
                </span>
              </label>
            )}
            {mode === "fresh" && (
              <label className="field">
                <span className="field__label">
                  Seed <span className="field__optional">optional</span>
                </span>
                <input
                  className="input"
                  value={seed}
                  maxLength={128}
                  placeholder="Random"
                  onChange={(e) => setSeed(e.target.value)}
                />
              </label>
            )}
            {mode === "import" && (
              <p className="field__hint">
                Choose a complete backup ZIP downloaded from this panel.
              </p>
            )}
            <div className="modal__actions">
              <button
                type="button"
                className="btn"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                disabled={locked || !name.trim()}
                type="submit"
              >
                {busy && <span className="spinner" />}
                {mode === "import" ? "Choose ZIP…" : "Create world"}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal
        isOpen={!!confirmation}
        title={confirmation?.title || ""}
        message={confirmation?.message || ""}
        confirmLabel={confirmation?.label}
        tone={confirmation?.danger ? "danger" : "neutral"}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) void run(confirmation.action);
        }}
      />
    </section>
  );
}
