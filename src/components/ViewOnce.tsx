import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { Avatar, Icon, Press, SnapImage } from './ui';
import { FONTS, S, T, useTheme } from '../theme';
import { forgetPhoto, type Snap } from '../api';

/** The WhatsApp-style "1 in a circle" mark. */
export function OnceMark({ size = 24, color, filled }: { size?: number; color: string; filled?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1.5, size / 12),
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        borderStyle: filled ? 'solid' : 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: FONTS.xb, fontSize: size * 0.52, lineHeight: size * 0.66, color: filled ? '#000000' : color }}>1</Text>
    </View>
  );
}

/** Feed card for a view-once snap: no photo, just "Photo" or "Opened". */
export function ViewOnceTile({ snap, meId, onOpen, width }: { snap: Snap; meId: string; onOpen: () => void; width: number }) {
  const c = useTheme();
  const mine = snap.authorId === meId;
  const viewers = (snap.viewedBy ?? []).filter((id) => id !== snap.authorId).length;
  const opened = (snap.viewedBy ?? []).includes(meId);
  const canOpen = !mine && !opened;
  const title = mine ? 'Foto voor één keer' : opened ? 'Geopend' : 'Foto';
  const hint = mine
    ? viewers
      ? `Geopend door ${viewers} ${viewers === 1 ? 'persoon' : 'mensen'}`
      : 'Nog door niemand geopend'
    : opened
      ? 'Je kunt hem maar één keer zien'
      : 'Tik om te openen. Je kunt hem één keer zien.';
  return (
    <Press
      onPress={canOpen ? onOpen : undefined}
      disabled={!canOpen}
      radius={S.xl}
      squish={canOpen ? 0.96 : 1}
      accessibilityLabel={canOpen ? 'Foto voor één keer openen' : title}
      style={[styles.tile, { width, backgroundColor: c.surfaceContainerLow, borderColor: canOpen ? c.primary : c.outlineVariant }]}
    >
      <OnceMark size={40} color={canOpen ? c.primary : c.outline} filled={canOpen} />
      <View style={{ flex: 1 }}>
        <Text style={[T.titleMedium, { color: canOpen ? c.onSurface : c.onSurfaceVariant }]}>{title}</Text>
        <Text style={[T.bodySmall, { color: c.onSurfaceVariant, marginTop: 2 }]}>{hint}</Text>
      </View>
      {canOpen && <Icon name="chevron-right" size={24} color={c.primary} />}
    </Press>
  );
}

/** Full screen, one-time view. Blocks screenshots on Android; on the web it blocks saving the photo. */
export function ViewOnceViewer({ snap, onClose }: { snap: Snap | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [swapped, setSwapped] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!snap) return;
    const key = `once-${snap.$id}`;
    if (Platform.OS !== 'web') {
      ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
      return () => {
        ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
        forgetPhoto(snap.backId);
        forgetPhoto(snap.frontId);
      };
    }
    // Web: no right-click/long-press save, and blank the photo when you leave the tab.
    const noMenu = (e: Event) => e.preventDefault();
    const vis = () => setHidden(document.visibilityState !== 'visible');
    const blur = () => setHidden(true);
    const focus = () => setHidden(false);
    document.addEventListener('contextmenu', noMenu);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      forgetPhoto(snap.backId);
      forgetPhoto(snap.frontId);
    };
  }, [snap]);

  if (!snap) return null;
  const photoW = Math.min(width - 24, 520);
  const photoH = (photoW * 4) / 3;
  const insetW = Math.round(photoW * 0.28);
  const noSave = Platform.OS === 'web' ? ({ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as never) : null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 16 }, noSave]}>
        <View style={styles.top}>
          <Avatar id={snap.authorId} name={snap.authorName} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={[T.titleMedium, { color: '#FFFFFF' }]}>{snap.authorName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <OnceMark size={16} color="rgba(235,235,245,0.7)" />
              <Text style={[T.bodySmall, { color: 'rgba(235,235,245,0.7)' }]}>Eén keer bekijken</Text>
            </View>
          </View>
          <Press radius={22} onPress={onClose} accessibilityLabel="Sluiten" style={styles.round}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </Press>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable onPress={() => setSwapped((s) => !s)} style={{ width: photoW, height: photoH, borderRadius: S.xl, overflow: 'hidden' }}>
            {!hidden && (
              <>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <SnapImage fileId={swapped ? snap.frontId : snap.backId} style={{ width: photoW, height: photoH }} />
                </View>
                <View pointerEvents="none" style={[styles.inset, { width: insetW, height: (insetW * 4) / 3 }]}>
                  <SnapImage fileId={swapped ? snap.backId : snap.frontId} style={StyleSheet.absoluteFill as never} />
                </View>
              </>
            )}
          </Pressable>
          {!!snap.caption && <Text style={[T.bodyLarge, { color: '#FFFFFF', width: photoW, marginTop: 14 }]}>{snap.caption}</Text>}
        </View>

        <View style={styles.note}>
          <Icon name={Platform.OS === 'web' ? 'eye-off-outline' : 'cellphone-screenshot'} size={18} color="rgba(235,235,245,0.6)" />
          <Text style={[T.bodySmall, { color: 'rgba(235,235,245,0.6)', textAlign: 'center' }]}>
            {Platform.OS === 'web' ? 'Weg als je hem sluit. Maak geen screenshot aub.' : 'Screenshots zijn geblokkeerd. Weg als je hem sluit.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84, paddingHorizontal: 18, borderWidth: 1.5 },
  screen: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(118,118,128,0.24)', alignItems: 'center', justifyContent: 'center' },
  inset: { position: 'absolute', top: 12, left: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 2.5, borderColor: '#FFFFFF' },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
});
