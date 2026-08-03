import type { VercelRequest, VercelResponse } from "@vercel/node";

interface RecapAct {
  name: string;
  genre: string;
  stage: string;
  day: string;
  preRating: number;
  preNotes: string;
  duringRating: number;
  duringNotes: string;
}

interface RecapRequestBody {
  userName?: unknown;
  acts?: unknown;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_ACTS = 100;
const MAX_NOTE_CHARS = 400;

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Coerces whatever JSON the client sent into a bounded, well-typed act list — the model
 * only ever needs to trust what it puts in the prompt, not what arrives over the wire. */
function sanitizeActs(raw: unknown): RecapAct[] {
  if (!Array.isArray(raw)) return [];
  const acts: RecapAct[] = [];
  for (const entry of raw.slice(0, MAX_ACTS)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const name = clamp(e.name, 120);
    if (!name) continue;
    acts.push({
      name,
      genre: clamp(e.genre, 60),
      stage: clamp(e.stage, 60),
      day: clamp(e.day, 20),
      preRating: typeof e.preRating === "number" && e.preRating >= 0 && e.preRating <= 5 ? e.preRating : 0,
      preNotes: clamp(e.preNotes, MAX_NOTE_CHARS),
      duringRating: typeof e.duringRating === "number" && e.duringRating >= 0 && e.duringRating <= 5 ? e.duringRating : 0,
      duringNotes: clamp(e.duringNotes, MAX_NOTE_CHARS),
    });
  }
  return acts;
}

/** This function is a public URL with no rate limiting of its own, sitting in front of a
 * paid API — anyone who authenticates as a real app user can call it, but a stranger off
 * the street can't rack up API spend on our key. */
async function isAuthorized(authHeader: string | string[] | undefined): Promise<boolean> {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildPrompt(userName: string, acts: RecapAct[]): string {
  const actLines = acts
    .map((act) => {
      const pre = act.preRating > 0 ? `${act.preRating}/5` : "unrated";
      const context = [act.genre, act.stage, act.day].filter(Boolean).join(", ");
      const preNote = act.preNotes ? ` Pre-fest note: "${act.preNotes}"` : "";
      const duringNote = act.duringNotes ? ` During note: "${act.duringNotes}"` : "";
      return `- ${act.name}${context ? ` (${context})` : ""} — pre-fest hype: ${pre}, actual rating: ${act.duringRating}/5.${preNote}${duringNote}`;
    })
    .join("\n");

  return `Here is ${userName || "this person"}'s festival ratings. "pre-fest hype" is how excited \
they were before the festival (1-5, or unrated if they never rated it beforehand). "actual \
rating" is how the set actually was (1-5), rated during or right after the festival.

${actLines}

Write a short, funny, personalized festival recap (150-250 words) addressed directly to \
them in second person. Call out their biggest surprises (low hype or unrated going in, high \
actual rating) and biggest letdowns (high hype, low actual rating) by name. Based on the \
genres and acts they rated highest, playfully guess what "type" of festival-goer they are. \
Keep the humor warm and affectionate, never mean-spirited, and don't just list every act —\
pick out the interesting stories the ratings and notes tell. Write in plain prose only — no \
markdown, no asterisks or bold/italic formatting, no bullet points or headers, since this is \
displayed as plain text.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!(await isAuthorized(req.headers.authorization))) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AI recap isn't configured for this deployment." });
    return;
  }

  const body = req.body as RecapRequestBody | undefined;
  const acts = sanitizeActs(body?.acts);
  if (acts.length === 0) {
    res.status(400).json({ error: "No rated acts to recap." });
    return;
  }
  const userName = clamp(body?.userName, 60);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        // Explicitly off: this model defaults to extended thinking, which was burning the
        // whole max_tokens budget on a "thinking" block and leaving nothing for the actual
        // recap text (stop_reason: max_tokens, blocks: thinking). A short creative recap
        // doesn't need extended reasoning anyway.
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: buildPrompt(userName, acts) }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      res.status(502).json({ error: `AI recap service error: ${detail.slice(0, 300)}` });
      return;
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    const text = data.content?.find((block) => block.type === "text")?.text?.trim();
    if (!text) {
      const blockTypes = data.content?.map((b) => b.type).join(", ") || "none";
      // stop_reason/blockTypes surfaced in the error itself (rather than only logged) since
      // there's no way to hand the caller Vercel's function logs from inside the app.
      res.status(502).json({
        error: `AI recap service returned no usable text (stop_reason: ${data.stop_reason ?? "unknown"}, blocks: ${blockTypes}).`,
      });
      return;
    }
    res.status(200).json({ text });
  } catch {
    res.status(502).json({ error: "Couldn't reach the AI recap service." });
  }
}
