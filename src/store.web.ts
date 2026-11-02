export async function getItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export async function setItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}
