import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Lets you pick a square profile photo and makes it small. Returns null when cancelled. */
export async function pickProfilePhoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  try {
    const ctx = ImageManipulator.manipulate(a.uri);
    // Web has no crop screen, so cut the middle square ourselves.
    if (a.width && a.height && a.width !== a.height) {
      const side = Math.min(a.width, a.height);
      ctx.crop({ originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side });
    }
    ctx.resize({ width: 400 });
    const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return img.uri;
  } catch {
    return a.uri;
  }
}
