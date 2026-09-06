export const EVICTION_MS: number = 60 * 1000;
// Caps how many keys the store holds at once. Writing a new key past this
// cap evicts the oldest non-admin key to make room.
export const MAX_ENTRIES: number = Number(process.env.MAX_ENTRIES) || 10_000;
export const ADMIN_API_KEY: string = process.env.ADMIN_API_KEY || 'change-me-please';
export const PORT: number = Number(process.env.PORT) || 3000;
