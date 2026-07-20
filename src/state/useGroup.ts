import { createLocalStore } from "./localStore";

const store = createLocalStore<string>("lolla-group-code", "", {
  serialize: (code: string) => code.trim().toUpperCase(),
});

/** Short, human-shareable code — unambiguous alphabet (no 0/O/1/I) since people read these aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGroupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const setGroupCode = store.set;
export const useGroupCode = store.useValue;

/** Non-hook read for use outside components. */
export const getGroupCode = store.get;
