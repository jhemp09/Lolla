import { useState } from "react";
import { signUp, signIn } from "../state/useAuth";
import { useSyncConfig } from "../state/useSyncSettings";

export function AuthScreen() {
  const config = useSyncConfig();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!config.configured) {
    return (
      <div className="user-picker">
        <h1 style={{ fontSize: 28 }}>Welcome 🎪</h1>
        <p>
          This build isn't connected to a Supabase project yet, so accounts
          aren't available. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> and redeploy.
        </p>
      </div>
    );
  }

  const submit = async () => {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) return;
    if (mode === "signup" && !firstName.trim()) return;

    setBusy(true);
    setError("");
    const result =
      mode === "signup"
        ? await signUp(trimmedUser, password, firstName, groupCode)
        : await signIn(trimmedUser, password);
    setBusy(false);

    if (result.error) setError(result.error);
    // On success, the session updates via onAuthStateChange and App.tsx re-renders past this screen.
  };

  return (
    <div className="user-picker">
      <h1 style={{ fontSize: 28 }}>Welcome 🎪</h1>
      <p>
        {mode === "signup"
          ? "Create an account so your ratings and schedule sync with your group."
          : "Welcome back — log in to pick up where you left off."}
      </p>

      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      {mode === "signup" && (
        <>
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <p className="status-text" style={{ maxWidth: 280, marginTop: -8 }}>
            This is how your group will see you — shown next to your ratings and schedule.
          </p>
          <input
            placeholder="Group code (optional)"
            value={groupCode}
            onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ textTransform: "uppercase" }}
          />
          <p className="status-text" style={{ maxWidth: 280 }}>
            Got a code from a friend already in a group? Enter it above to join
            them. Otherwise leave it blank and you'll get a new code to share.
          </p>
        </>
      )}

      {error && (
        <p className="status-text err" style={{ maxWidth: 280 }}>
          {error}
        </p>
      )}

      <button className="primary-btn" onClick={submit} disabled={busy}>
        {busy ? "…" : mode === "signup" ? "Create account" : "Log in"}
      </button>

      <button
        className="secondary-btn"
        onClick={() => {
          setMode(mode === "signup" ? "login" : "signup");
          setError("");
        }}
      >
        {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
      </button>
    </div>
  );
}
