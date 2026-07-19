import { useState } from "react";
import { setUserName } from "../state/useUser";

export function UserPicker() {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) setUserName(trimmed);
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
      <button className="primary-btn" onClick={submit} disabled={!name.trim()}>
        Let's go
      </button>
    </div>
  );
}
