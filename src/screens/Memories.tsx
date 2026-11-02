import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ButtonGroup, Icon, Shape, SnapTile, TopBar } from '../components/ui';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { S, T, useTheme } from '../theme';
import type { Me, Snap } from '../api';

const dateLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
};

export function Memories({
  me,
  kept,
  snaps,
  refreshing,
  onRefresh,
  onOpen,
}: {
  me: Me;
  kept: Snap[];
  snaps: Snap[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (list: Snap[], id: string) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<'kept' | 'mine'>('kept');
  const list = (view === 'kept' ? kept : snaps.filter((s) => s.authorId === me.id)).filter((s) => !s.viewOnce);
  const contentW = Math.min(width, 640) - 32;
  const tileW = Math.floor((contentW - 8) / 2);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 104 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} tintColor={c.primary} />}
    >
      <TopBar title="Bewaard" />
      <View style={{ marginTop: 8, marginBottom: 16 }}>
        <ButtonGroup
          items={[
            { key: 'kept', label: 'Voor altijd', icon: 'pin-outline' },
            { key: 'mine', label: 'Van mij', icon: 'calendar-week' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Shape kind="clover" size={96} color={c.secondaryContainer}>
            <Icon name={view === 'kept' ? 'pin-outline' : 'image-multiple-outline'} size={40} color={c.onSecondaryContainer} />
          </Shape>
          <Text style={[T.titleLarge, { color: c.onSurface, marginTop: 16 }]}>{view === 'kept' ? 'Nog niets bewaard' : 'Vandaag geen snaps'}</Text>
          <Text style={[T.bodyMedium, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 6, maxWidth: 300 }]}>
            {view === 'kept' ? 'Tik op het bladwijzertje bij een snap om hem voor altijd te bewaren. De rest verdwijnt na 24 uur.' : 'Je eigen snaps staan hier 24 uur lang.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {list.map((s, i) => (
            <SnapTile
              key={s.$id}
              back={s.backId}
              front={s.frontId}
              width={tileW}
              radius={i % 3 === 0 ? S.xl : S.lgInc}
              label={view === 'kept' ? `${s.authorId === me.id ? 'Jij' : s.authorName} · ${dateLabel(s.day)}` : `${dateLabel(s.day)} · ${s.hour}u`}
              onPress={() => onOpen(list, s.$id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { alignItems: 'center', paddingTop: 48 },
});
