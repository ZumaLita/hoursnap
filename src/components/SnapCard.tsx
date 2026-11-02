import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Avatar, Icon, IconButton, Press, SnapImage } from './ui';
import { Print, isPhotoStyle } from './Print';
import { ViewOnceTile } from './ViewOnce';
import { FONTS, S, T, useTheme } from '../theme';
import { REACTIONS } from '../config';
import type { Snap } from '../api';

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString(undefined, { weekday: 'long' });
};
export function SnapCard({
  snap,
  meId,
  onReact,
  onKeep,
  onDelete,
  admin,
  onReport,
  onClearReports,
  onOpenOnce,
}: {
  snap: Snap;
  meId: string;
  onReact: (emoji: string) => void;
  onKeep: () => void;
  onDelete: () => void;
  admin?: boolean;
  onReport?: () => void;
  onClearReports?: () => void;
  onOpenOnce?: () => void;
}) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [swapped, setSwapped] = useState(false);
  const [picker, setPicker] = useState(false);
  const printW = Math.min(width, 560) - 40;
  const kept = snap.keptBy.includes(meId);
  const mine = snap.reactions.find((r) => r.startsWith(meId + ':'))?.split(':')[1];
  const liked = mine === '❤️';
  const counts = new Map<string, number>();
  snap.reactions.forEach((r) => {
    const e = r.split(':')[1];
    counts.set(e, (counts.get(e) ?? 0) + 1);
  });
  const others = snap.reactions.length - (counts.get('❤️') ?? 0);

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this snap for everyone?')) onDelete();
    } else
      Alert.alert('Delete snap?', 'It disappears for everyone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
  };

  const confirmReport = () => {
    const go = () => onReport?.();
    if (Platform.OS === 'web') {
      if (window.confirm('Report this snap? It gets hidden until Storm checks it.')) go();
    } else
      Alert.alert('Report this snap?', 'It gets hidden for everyone until Storm checks it.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: go },
      ]);
  };
  const reports = snap.reportedBy?.length ?? 0;

  return (
    <View style={styles.wrap}>
      {admin && reports > 0 && (
        <View style={[styles.reported, { backgroundColor: c.errorContainer }]}>
          <Icon name="flag" size={20} color={c.onErrorContainer} />
          <Text style={[T.labelLarge, { color: c.onErrorContainer, flex: 1 }]}>
            Reported by {reports} {reports === 1 ? 'person' : 'people'}. Hidden for everyone else.
          </Text>
          <Press onPress={onClearReports} radius={S.full} style={[styles.reportBtn, { backgroundColor: c.surfaceContainerLow }]}>
            <Text style={[T.labelLarge, { color: c.onSurface }]}>It's fine</Text>
          </Press>
        </View>
      )}
      <View style={styles.byline}>
        <Avatar id={snap.authorId} name={snap.authorName} size={36} />
        <Text style={[T.titleMedium, { color: c.onSurface }]}>{snap.authorId === meId ? 'You' : snap.authorName}</Text>
        <Text style={[T.bodySmall, { color: c.onSurfaceVariant, flex: 1 }]}>{ago(snap.$createdAt)}</Text>
        {snap.authorId !== meId && <IconButton icon="flag-outline" label="Report snap" onPress={confirmReport} size={40} />}
        {(snap.authorId === meId || admin) && <IconButton icon="trash-can-outline" label="Delete snap" onPress={confirmDelete} size={40} />}
      </View>

      {snap.viewOnce ? (
        <ViewOnceTile snap={snap} meId={meId} width={printW + 8} onOpen={() => onOpenOnce?.()} />
      ) : (
      <Print
        style={isPhotoStyle(snap.style) ? snap.style : 'tape'}
        width={printW}
        id={snap.$id}
        date={new Date(snap.$createdAt)}
        caption={snap.caption}
        hour={snap.hour}
        extra={!snap.onTime}
        onPress={() => setSwapped((x) => !x)}
        image={(which, size) => <SnapImage fileId={(which === 'big') !== swapped ? snap.backId : snap.frontId} style={size} />}
      />
      )}

      <View style={styles.actions}>
        <Press
          onPress={() => onReact('❤️')}
          radius={S.full}
          squish={0.85}
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          style={[styles.pill, { backgroundColor: c.surfaceContainerLow, borderColor: liked ? '#FF3B5C' : c.outlineVariant }]}
        >
          <Icon name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? '#FF3B5C' : c.onSurface} />
          <Text style={[T.labelLarge, T.num, { color: c.onSurface }]}>{counts.get('❤️') ?? 0}</Text>
        </Press>
        <Press
          onPress={() => setPicker((p) => !p)}
          radius={S.full}
          squish={0.85}
          accessibilityLabel="React with an emoji"
          style={[styles.pill, { backgroundColor: c.surfaceContainerLow, borderColor: mine && mine !== '❤️' ? c.primary : c.outlineVariant }]}
        >
          {mine && mine !== '❤️' ? <Text style={styles.emojiSm}>{mine}</Text> : <Icon name="emoticon-happy-outline" size={21} color={c.onSurface} />}
          <Text style={[T.labelLarge, T.num, { color: c.onSurface }]}>{others}</Text>
        </Press>
        <View style={{ flex: 1 }} />
        {!snap.viewOnce && (
        <Press
          onPress={onKeep}
          radius={S.full}
          squish={0.85}
          accessibilityLabel={kept ? 'Remove from kept' : 'Keep forever'}
          style={[styles.pill, { backgroundColor: c.surfaceContainerLow, borderColor: kept ? c.fire : c.outlineVariant }]}
        >
          <Icon name={kept ? 'bookmark' : 'bookmark-outline'} size={21} color={kept ? c.fire : c.onSurface} />
          <Text style={[T.labelLarge, T.num, { color: c.onSurface }]}>{snap.keptBy.length}</Text>
        </Press>
        )}
      </View>

      {picker && (
        <View style={[styles.picker, { backgroundColor: c.surfaceContainerLow }]}>
          {REACTIONS.filter((e) => e !== '❤️').map((e) => (
            <Press
              key={e}
              onPress={() => {
                setPicker(false);
                onReact(e);
              }}
              radius={24}
              squish={0.8}
              accessibilityLabel={`React ${e}`}
              style={[styles.emoji, mine === e && { backgroundColor: c.secondaryContainer }]}
            >
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Press>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 36 },
  reported: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', padding: 12, borderRadius: S.lg, marginBottom: 12 },
  reportBtn: { height: 36, paddingHorizontal: 14, justifyContent: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', paddingHorizontal: 4, marginBottom: 12, minHeight: 40 },
  print: {
    padding: 10,
    paddingBottom: 0,
    borderRadius: 4,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  stamp: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    fontFamily: FONTS.stamp,
    fontSize: 22,
    letterSpacing: 1,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
    opacity: 0.92,
  },
  extra: { position: 'absolute', right: 10, top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: S.full },
  selfie: {
    position: 'absolute',
    top: -14,
    left: -12,
    padding: 5,
    borderRadius: 3,
    transform: [{ rotate: '-4deg' }],
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tape: { position: 'absolute', top: -9, alignSelf: 'center', width: 54, height: 18, borderRadius: 2, transform: [{ rotate: '3deg' }], zIndex: 2 },
  caption: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 14, minHeight: 50 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 16, paddingHorizontal: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44, paddingHorizontal: 16, borderWidth: 1.5 },
  emojiSm: { fontSize: 17 },
  picker: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 10, borderRadius: S.full, padding: 4 },
  emoji: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
