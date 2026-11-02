import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon } from './ui';
import { S, T, useTheme } from '../theme';
import { getItem, setItem } from '../store';

/** Only the web app needs this; the Android app is already on the home screen. */
const web = Platform.OS === 'web' && typeof window !== 'undefined';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
if (web) {
  // Chrome on Android fires this before React is ready, so catch it early.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
  });
}

const ua = web ? navigator.userAgent : '';
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (web && /Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const installed = () =>
  web && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

/** Opens the "add to home screen" help from anywhere (for example the Me screen). */
export const showInstallHelp = () => web && window.dispatchEvent(new Event('hoursnap-install-help'));
export const canInstall = () => web && (isIOS || isAndroid) && !installed();

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.num, { backgroundColor: c.primaryContainer }]}>
        <Text style={[T.titleSmall, { color: c.onPrimaryContainer }]}>{n}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}

export function InstallPrompt() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(!!deferred);

  useEffect(() => {
    if (!web || !(isIOS || isAndroid) || installed()) return;
    const help = () => {
      setCanPrompt(!!deferred);
      setOpen(true);
    };
    window.addEventListener('hoursnap-install-help', help);
    let t: ReturnType<typeof setTimeout> | undefined;
    getItem('install-help-seen').then((seen) => {
      if (!seen) t = setTimeout(help, 1800);
    });
    return () => {
      window.removeEventListener('hoursnap-install-help', help);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!web) return null;

  const close = () => {
    setOpen(false);
    setItem('install-help-seen', '1');
  };

  const txt = [T.bodyLarge, { color: c.onSurface }];
  const chip = (icon: React.ComponentProps<typeof Icon>['name'], label: string) => (
    <View style={[styles.chip, { backgroundColor: c.surfaceContainerHighest }]}>
      <Icon name={icon} size={18} color={c.primary} />
      <Text style={[T.labelLarge, { color: c.onSurface }]}>{label}</Text>
    </View>
  );

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surfaceContainerLow, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.handle, { backgroundColor: c.outlineVariant }]} />
        <View style={[styles.badge, { backgroundColor: c.primaryContainer }]}>
          <Icon name="cellphone-arrow-down" size={30} color={c.onPrimaryContainer} />
        </View>
        <Text style={[T.headlineSmall, { color: c.onSurface, textAlign: 'center', marginTop: 14 }]}>Put HourSnap on your home screen</Text>
        <Text style={[T.bodyMedium, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 6, marginBottom: 18 }]}>
          It opens full screen like a real app, and you find it in one tap.
        </Text>

        {isIOS ? (
          <View style={{ gap: 14 }}>
            <Step n={1}>
              <Text style={txt}>Tap</Text>
              {chip('export-variant', 'Share')}
              <Text style={txt}>at the bottom of Safari</Text>
            </Step>
            <Step n={2}>
              <Text style={txt}>Scroll down and tap</Text>
              {chip('plus-box-outline', 'Add to Home Screen')}
            </Step>
            <Step n={3}>
              <Text style={txt}>Tap</Text>
              {chip('check', 'Add')}
              <Text style={txt}>in the top corner</Text>
            </Step>
            <Text style={[T.bodySmall, { color: c.onSurfaceVariant, textAlign: 'center' }]}>No Share button? Open this page in Safari first.</Text>
          </View>
        ) : canPrompt ? (
          <Button
            title="Install HourSnap"
            icon="download"
            big
            onPress={async () => {
              try {
                await deferred?.prompt();
                await deferred?.userChoice;
              } catch {}
              deferred = null;
              close();
            }}
          />
        ) : (
          <View style={{ gap: 14 }}>
            <Step n={1}>
              <Text style={txt}>Tap the menu</Text>
              {chip('dots-vertical', 'Menu')}
              <Text style={txt}>top right in Chrome</Text>
            </Step>
            <Step n={2}>
              <Text style={txt}>Tap</Text>
              {chip('cellphone-arrow-down', 'Add to home screen')}
              <Text style={txt}>or</Text>
              {chip('download', 'Install app')}
            </Step>
            <Step n={3}>
              <Text style={txt}>Tap</Text>
              {chip('check', 'Install')}
            </Step>
          </View>
        )}

        <Button title="Maybe later" variant="text" onPress={close} style={{ marginTop: 14 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  badge: { width: 64, height: 64, borderRadius: S.xl, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: S.md },
});
