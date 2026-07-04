import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Android clipboard rides a ~1MB binder transaction and OEM clipboard managers
 * truncate silently well below that — so anything big goes out as a file through
 * the share sheet instead. 50KB keeps clipboard pastes comfortably inside what
 * mobile LLM chat inputs handle.
 */
export const CLIPBOARD_LIMIT_CHARS = 50_000;

export type DeliveryRoute = 'clipboard' | 'file';

export async function shareAsFile(
  content: string,
  filename: string,
  mimeType: string
): Promise<DeliveryRoute> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  return 'file';
}

/** Clipboard for small payloads, share-sheet file for anything risky. */
export async function deliverText(
  content: string,
  filename: string,
  mimeType: string
): Promise<DeliveryRoute> {
  if (content.length < CLIPBOARD_LIMIT_CHARS) {
    await Clipboard.setStringAsync(content);
    return 'clipboard';
  }
  return shareAsFile(content, filename, mimeType);
}
