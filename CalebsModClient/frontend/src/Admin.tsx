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
  ServerIcon,
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
      toast.success("Server action started", "Follow its progress in Worlds.");
    } catch (e) {
      toast.error("Server action failed", errorText(e));
    } finally {
      setBusy(false);
    }
  };
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
      <div className="page__body">
        {!loggedIn ? (
          <section className="card">
            <div className="card__head">
              <KeyIcon />
              <h1>Admin sign in</h1>
            </div>
            <form
              className="card__body world-form"
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <label>
                Admin secret
                <input
                  type="password"
                  value={secret}
                  autoComplete="current-password"
                  onChange={(e) => setSecret(e.target.value)}
                />
              </label>
              {error && (
                <p className="t-warn" role="alert">
                  {error}
                </p>
              )}
              <button
                className="btn btn--primary"
                disabled={busy || (!secret.trim() && !savedKey)}
              >
                {busy ? "Signing in�" : "Sign in"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="card">
              <div className="card__head">
                <ServerIcon />
                <h2>{status?.world?.name || "Original World"}</h2>
                <span className="spacer" />
                <span>
                  {status?.maintenance
                    ? "Maintenance"
                    : status?.dockerStatus.running
                      ? "Running"
                      : "Stopped"}
                </span>
              </div>
              <div className="card__body">
                <p>
                  {status?.players.online ?? 0} players online
                  {status?.players.players?.length
                    ? `: ${status.players.players.join(", ")}`
                    : ""}
                </p>
                <div className="world-toolbar">
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      status?.maintenance ||
                      status?.dockerStatus.running
                    }
                    onClick={() => void control(StartServer)}
                  >
                    <PowerIcon />
                    Start
                  </button>
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      status?.maintenance ||
                      !status?.dockerStatus.running
                    }
                    onClick={() => void control(StopServer)}
                  >
                    <StopIcon />
                    Save and stop
                  </button>
                  <button
                    className="btn"
                    disabled={busy || status?.maintenance}
                    onClick={() => void control(RestartServer)}
                  >
                    <SyncIcon />
                    Restart
                  </button>
                  <button
                    className="btn"
                    disabled={busy || status?.maintenance}
                    onClick={() => void control(UpdateDns)}
                  >
                    <GlobeIcon />
                    Update DNS
                  </button>
                </div>
              </div>
            </section>
            <Worlds players={status?.players.players || []} />
          </>
        )}
      </div>
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
