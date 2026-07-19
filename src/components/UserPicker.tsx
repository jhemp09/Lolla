import { useState } from "react";
import { setUserName } from "../state/useUser";
import { setGroupCode, generateGroupCode } from "../state/useGroup";

export function UserPicker() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setGroupCode(code.trim() ? code : generateGroupCode());
    setUserName(trimmedName);
  };

  return (
    <div className="user-picker">
      <h1 style={{ fontSize: 28 }}>Welcome 🎪</h1>
      <p>
        Pick a name so your ratings and schedule can sync with your group.
        No password, no account — just a name.
      </p>
      <input
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <input
        placeholder="Group code (optional)"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ textTransform: "uppercase" }}
      />
      <p className="status-text" style={{ maxWidth: 280 }}>
        Got a code from a friend already in a group? Enter it above to join
        them. Otherwise leave it blank and you'll get a new code to share.
      </p>
      <button className="primary-btn" onClick={submit} disabled={!name.trim()}>
        Let's go
      </button>
    </div>
  );
}
