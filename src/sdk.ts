// Native (Android) Appwrite client.
import { Account, Client, ID, Permission, Query, Role, Storage, TablesDB, Teams } from 'react-native-appwrite';
import { File } from 'expo-file-system';
import { Buffer } from 'buffer';
import { BUCKET_ID, ENDPOINT, PLATFORM_ID, PROJECT_ID } from './config';

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setPlatform(PLATFORM_ID);
export const account = new Account(client);
export const tables = new TablesDB(client);
export const storage = new Storage(client);
export const teams = new Teams(client);
export { ID, Permission, Query, Role };

export async function uploadImage(uri: string, name: string, permissions: string[]) {
  const size = new File(uri).size ?? 0;
  const file = await storage.createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: { name, type: 'image/jpeg', size, uri },
    permissions,
  });
  return file.$id;
}

export async function imageDataUri(fileId: string) {
  const buf = await storage.getFileView({ bucketId: BUCKET_ID, fileId });
  return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
}
