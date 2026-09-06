export const EVICTION_MS: number = 60 * 1000;
// Caps how many keys the store holds at once. Writing a new key past this
// cap evicts the oldest non-admin key to make room.
export const MAX_ENTRIES: number = Number(process.env.MAX_ENTRIES) || 10_000;
// Combined length of a key + its value, in characters.
export const MAX_ENTRY_LENGTH: number = Number(process.env.MAX_ENTRY_LENGTH) || 64 * 1024;
// No default: an unset ADMIN_API_KEY means admin auth is simply
// unavailable, rather than everyone sharing a known, guessable key.
export const ADMIN_API_KEY: string | undefined = process.env.ADMIN_API_KEY || undefined;
export const PORT: number = Number(process.env.PORT) || 3000;
