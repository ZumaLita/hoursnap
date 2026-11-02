// Web Appwrite client.
import { Account, Client, ID, Permission, Query, Role, Storage, TablesDB, Teams } from 'appwrite';
import { BUCKET_ID, ENDPOINT, PROJECT_ID } from './config';

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
export const account = new Account(client);
export const tables = new TablesDB(client);
export const storage = new Storage(client);
export const teams = new Teams(client);
export { ID, Permission, Query, Role };

export async function uploadImage(uri: string, name: string, permissions: string[]) {
  const blob = await (await fetch(uri)).blob();
  const file = await storage.createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: new File([blob], name, { type: 'image/jpeg' }),
    permissions,
  });
  return file.$id;
}

// Browsers often block Appwrite's cookie on other domains, so images are
// fetched with a short-lived JWT instead.
let jwt: { token: string; at: number } | null = null;
async function getJwt() {
  if (!jwt || Date.now() - jwt.at > 10 * 60 * 1000) {
    const r = await account.createJWT();
    jwt = { token: r.jwt, at: Date.now() };
  }
  return jwt.token;
}

export async function imageDataUri(fileId: string) {
  const url = storage.getFileView({ bucketId: BUCKET_ID, fileId });
  const res = await fetch(url, {
    headers: { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-JWT': await getJwt() },
  });
  if (!res.ok) throw new Error(`Photo failed to load (${res.status})`);
  return URL.createObjectURL(await res.blob());
}
