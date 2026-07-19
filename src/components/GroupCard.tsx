import { useState } from "react";
import { useGroupCode, generateGroupCode } from "../state/useGroup";
import { syncNow } from "../lib/autoSync";
import { updateAccountGroupCode } from "../state/useAuth";
import { reassignGroupCode } from "../db/db";

export function GroupCard() {
  const [groupCode, setGroupCode] = useGroupCode();
  const [joining, setJoining] = useState(false);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(groupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. no HTTPS); the code is already on screen to copy by hand.
    }
  };

  const joinGroup = async () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    if (!groupCode) {
      // No real group yet (e.g. signed up before this was auto-generated) — nothing to leave behind.
      if (!confirm(`Join group "${code}"?`)) return;
    } else if (
      !confirm(`Switch to group "${code}"? Your ratings/schedule for your current group stay saved, you just won't see them until you switch back.`)
    ) {
      return;
    }
    if (!groupCode) await reassignGroupCode("", code);
    setGroupCode(code);
    setInput("");
    setJoining(false);
    syncNow();
    updateAccountGroupCode(code);
  };

  const startNewGroup = async () => {
    if (!confirm("Start a brand new group? You'll get a fresh code to share.")) return;
    const code = generateGroupCode();
    if (!groupCode) await reassignGroupCode("", code);
    setGroupCode(code);
    syncNow();
    updateAccountGroupCode(code);
  };

  return (
    <div className="sync-card">
      <h2 style={{ fontSize: 16 }}>Your group</h2>
      <p className="status-text" style={{ marginTop: 6 }}>
        {groupCode
          ? "Share this code with friends so their ratings and schedule sync with yours."
          : "You don't have a group yet — sync stays off until you do. Start one below, or join a friend's with their code."}
      </p>
      <div className="sync-row">
        <span className="group-code">{groupCode || "—"}</span>
        <button className="secondary-btn" onClick={copyCode} disabled={!groupCode}>
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>

      {joining ? (
        <div className="sync-row">
          <input
            className="field-input"
            placeholder="Enter a group code"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinGroup()}
            style={{ textTransform: "uppercase" }}
            autoFocus
          />
          <button className="primary-btn" onClick={joinGroup}>
            Join
          </button>
          <button className="secondary-btn" onClick={() => setJoining(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="sync-row">
          <button className="secondary-btn" onClick={() => setJoining(true)}>
            {groupCode ? "Join a different group" : "Join a group"}
          </button>
          <button className="secondary-btn" onClick={startNewGroup}>
            Start a new group
          </button>
        </div>
      )}
    </div>
  );
}
