import "./App.css";
import { useEffect, useState } from "react";
import {
  AdminKeyIsSet,
  IsLoggedIn,
  Login,
  SetAdminKey,
  ClearAdminKey,
  StartServer,
  StopServer,
  RestartServer,
  UpdateDns,
  GetServerStatus,
} from "../wailsjs/go/main/Admin";
import { go_services } from "../wailsjs/go/models";
import TopBar from "./components/TopBar";
import ConfirmModal from "./components/ConfirmModal";
import { useToast, errorText } from "./components/Toast";
import {
  KeyIcon,
  PowerIcon,
  StopIcon,
  SyncIcon,
  GlobeIcon,
  UsersIcon,
} from "./components/Icons";
import Worlds from "./Worlds";

export default function Admin() {
  const toast = useToast();
  const [loggedIn, setLoggedIn] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clear, setClear] = useState(false);
  const [status, setStatus] = useState<go_services.ServerStatusResponse | null>(
    null,
  );
  useEffect(() => {
    void (async () => {
      try {
        const saved = await AdminKeyIsSet();
        setSavedKey(saved);
        if (await IsLoggedIn()) setLoggedIn(true);
        else if (saved) {
          await Login();
          setLoggedIn(true);
        }
      } catch (e) {
        setError(errorText(e));
      }
    })();
  }, []);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await GetServerStatus();
        if (!cancelled) setStatus(next);
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
  }, [loggedIn]);
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      if (secret.trim()) await SetAdminKey(secret.trim());
      await Login();
      setSavedKey(true);
      setLoggedIn(true);
      setSecret("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const control = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast.success(
        "Server action started",
        "Progress appears above the world list.",
      );
    } catch (e) {
      toast.error("Server action failed", errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const running = !!status?.dockerStatus.running;
  const maintenance = !!status?.maintenance;
  const players = status?.players.players || [];
  const state = !status
    ? { label: "Checking", dot: "dot", text: "t-off" }
    : maintenance
      ? { label: "Maintenance", dot: "dot dot--warn", text: "t-warn" }
      : running
        ? { label: "Running", dot: "dot dot--ok dot--live", text: "t-ok" }
        : { label: "Stopped", dot: "dot dot--off", text: "t-off" };
  return (
    <div className="page">
      <TopBar
        backTo="/"
        title="Admin"
        actions={
          loggedIn ? (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setClear(true)}
            >
              <KeyIcon />
              Change secret
            </button>
          ) : undefined
        }
      />
      {!loggedIn ? (
        <div className="page__body">
          <form
            className="card auth-card"
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <div className="auth-card__head">
              <span className="auth-card__icon">
                <KeyIcon />
              </span>
              <h1>Admin sign in</h1>
              <p className="muted">
                Enter the admin secret to manage the server and its worlds.
              </p>
            </div>
            <label className="field">
              <span className="field__label">Admin secret</span>
              <input
                className="input"
                type="password"
                value={secret}
                autoFocus
                autoComplete="current-password"
                placeholder={savedKey ? "Saved secret will be used" : ""}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            {error && (
              <div className="notice notice--danger" role="alert">
                {error}
              </div>
            )}
            <button
              className="btn btn--primary btn--block"
              disabled={busy || (!secret.trim() && !savedKey)}
            >
              {busy && <span className="spinner" />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      ) : (
        <div className="page__body admin-body">
          <section className="card server-panel" aria-label="Server status">
            <div className="server-panel__info">
              <span className="eyebrow">Minecraft server</span>
              <div className="server-panel__title">
                <h1>{status?.world?.name || "No active world"}</h1>
                <span className={`server-panel__state ${state.text}`}>
                  <span className={state.dot} />
                  {state.label}
                </span>
              </div>
              <div className="server-panel__players">
                <UsersIcon />
                {players.length ? (
                  <>
                    <span>{players.length} online</span>
                    {players.map((p) => (
                      <span className="badge" key={p}>
                        {p}
                      </span>
                    ))}
                  </>
                ) : (
                  <span>No players online</span>
                )}
              </div>
            </div>
            <div className="server-panel__actions">
              {running ? (
                <>
                  <button
                    className="btn"
                    disabled={busy || maintenance}
                    onClick={() => void control(RestartServer)}
                  >
                    <SyncIcon />
                    Restart
                  </button>
                  <button
                    className="btn"
                    disabled={busy || maintenance}
                    onClick={() => void control(StopServer)}
                  >
                    <StopIcon />
                    Save and stop
                  </button>
                </>
              ) : (
                <button
                  className="btn btn--primary"
                  disabled={busy || maintenance || !status}
                  onClick={() => void control(StartServer)}
                >
                  <PowerIcon />
                  Start server
                </button>
              )}
              <button
                className="btn btn--ghost"
                disabled={busy || maintenance}
                title="Point the server address at this PC's current public IP"
                onClick={() => void control(UpdateDns)}
              >
                <GlobeIcon />
                Update DNS
              </button>
            </div>
          </section>
          <Worlds players={players} />
        </div>
      )}
      <ConfirmModal
        isOpen={clear}
        title="Clear the saved secret?"
        message="Enter the admin secret again the next time you open this panel."
        confirmLabel="Clear secret"
        tone="neutral"
        onCancel={() => setClear(false)}
        onConfirm={() => {
          void ClearAdminKey().then(() => {
            setLoggedIn(false);
            setSavedKey(false);
            setClear(false);
            setError("");
          });
        }}
      />
    </div>
  );
}
