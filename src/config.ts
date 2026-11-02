// HourSnap settings (Appwrite project "HourSnap", Frankfurt). PROJECT_ID is filled in during setup.
export const APP_NAME = 'HourSnap';
export const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const PROJECT_ID = '6ae879e20021a3003ccc';
export const PLATFORM_ID = 'be.ictstorm.hoursnap';

export const DB_ID = 'hoursnap';
export const SNAPS_TABLE = 'snaps';
export const PROFILES_TABLE = 'profiles';
export const BUCKET_ID = 'photos';

// Snaps vanish after 24 hours unless someone keeps them.
export const KEEP_HOURS = 24;
export const PIN_LENGTH = 6;

export const REACTIONS = ['❤️', '😂', '😍', '😮', '🔥', '👏'];

/** Turns a name into a safe slug: "Lena V." -> "lena-v". */
export const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Hidden login: people only ever type their name and PIN. */
export const loginEmail = (name: string) => `${slug(name)}@hoursnap.app`;
export const loginPassword = (name: string, pin: string) => `hoursnap-${slug(name)}-${pin.trim()}`;
