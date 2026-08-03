export interface RecapAct {
  name: string;
  genre: string;
  stage: string;
  day: string;
  preRating: number;
  preNotes: string;
  duringRating: number;
  duringNotes: string;
}

/** Posts the user's pre/during ratings + notes to the /api/recap serverless function, which
 * holds the actual LLM API key server-side — the client never sees or could leak it. */
export async function generateAiRecap(accessToken: string, userName: string, acts: RecapAct[]): Promise<string> {
  const response = await fetch("/api/recap", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ userName, acts }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.text !== "string") {
    throw new Error(data?.error || "Couldn't generate a recap — try again.");
  }
  return data.text;
}
