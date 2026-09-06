export const EVICTION_MS: number = 60 * 1000;
export const RATE_LIMIT: number = 10;
export const RATE_WINDOW_MS: number = 10 * 1000;
export const ADMIN_API_KEY: string = process.env.ADMIN_API_KEY || 'change-me-please';
export const PORT: number = Number(process.env.PORT) || 3000;
