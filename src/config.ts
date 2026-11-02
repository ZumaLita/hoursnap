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

/**
 * Phone numbers become one plain form: "0470 12 34 56", "+32 470 12 34 56" and "0032470123456"
 * all turn into "32470123456". Numbers starting with a single 0 are taken as Belgian.
 */
export function phoneKey(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return d;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return '32' + d.slice(1);
  return d;
}
export const validPhone = (raw: string) => {
  const k = phoneKey(raw);
  return k.length >= 10 && k.length <= 15;
};

/** Hidden login: people only ever type their phone number and PIN. The number is never shown to others. */
export const loginEmail = (phone: string) => `p${phoneKey(phone)}@hoursnap.app`;
export const loginPassword = (phone: string, pin: string) => `hoursnap-${phoneKey(phone)}-${pin.trim()}`;
/** Gets the phone key back from the hidden login email. */
export const phoneFromEmail = (email: string) => email.replace(/^p/, '').replace(/@.*/, '');
