import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export function createFixtureCapabilities() {
  return {
    clipboard: {
      writeText: async (text) => {
        try {
          return { status: await Clipboard.setStringAsync(text) ? 'success' : 'failed' };
        } catch (error) {
          return { status: 'failed', error };
        }
      },
    },
    files: {
      save: async ({ basename, extension, mimeType, content }) => {
        try {
          if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
          const file = new File(Paths.cache, `${basename}-${Date.now()}.${extension}`);
          file.write(content);
          await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${basename}.${extension}`, mimeType });
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', error };
        }
      },
    },
    share: {
      shareText: async (text, title) => {
        try {
          if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
          const file = new File(Paths.cache, `streamdown-share-${Date.now()}.txt`);
          file.write(text);
          await Sharing.shareAsync(file.uri, { dialogTitle: title, mimeType: 'text/plain' });
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', error };
        }
      },
    },
  };
}
