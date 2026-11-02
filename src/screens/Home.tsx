import React, { useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Icon, Press } from '../components/ui';
import { SnapCard } from '../components/SnapCard';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { FONTS, S, T, useStyles, useTheme, type Theme } from '../theme';
import { dayKey, type Me, type Member, type Snap } from '../api';

function dayLabel(day: string) {
  if (day === dayKey()) return 'Today';
  if (day === dayKey(new Date(Date.now() - 864e5))) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

type Item = { type: 'header'; key: string; day: string } | { type: 'snap'; key: string; snap: Snap };

/** Today at a glance: how many snaps each hour, your own hours filled in. */
function HourRibbon({ snaps, meId }: { snaps: Snap[]; meId: string }) {
  const c = useTheme();
  const today = dayKey();
  const nowH = new Date().getHours();
  const hours: number[] = [];
  for (let h = 7; h <= 22; h++) hours.push(h);
  const count = new Map<number, number>();
  const mine = new Set<number>();
  snaps
    .filter((s) => s.day === today)
    .forEach((s) => {
      count.set(s.hour, (count.get(s.hour) ?? 0) + 1);
      if (s.authorId === meId) mine.add(s.hour);
    });
  const max = Math.max(1, ...count.values());
  return (
    <View style={[ribbon.wrap, { backgroundColor: c.surfaceContainerLow }]}>
      {hours.map((h) => {
        const n = count.get(h) ?? 0;
        const now = h === nowH;
        return (
          <View key={h} style={ribbon.col}>
            <View style={[ribbon.track, { backgroundColor: now ? c.secondaryContainer : 'transparent' }]}>
              <View style={[ribbon.bar, { height: n ? 6 + (n / max) * 34 : 3, backgroundColor: mine.has(h) ? c.primary : n ? c.outline : c.surfaceContainerHigh }]} />
            </View>
            <Text style={[T.labelSmall, T.num, { color: now ? c.primary : c.onSurfaceVariant, fontFamily: now ? FONTS.xb : FONTS.sb }]}>{h % 3 === 1 || now ? h : ' '}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function Home({
  me,
  members,
  snaps,
  streak,
  refreshing,
  onRefresh,
  onSnap,
  onStreaks,
  onReact,
  onKeep,
  onDelete,
  onReport,
  onClearReports,
}: {
  me: Me;
  members: Member[];
  snaps: Snap[];
  streak: number;
  refreshing: boolean;
  onRefresh: () => void;
  onSnap: () => void;
  onStreaks: () => void;
  onReact: (s: Snap, e: string) => void;
  onKeep: (s: Snap) => void;
  onDelete: (s: Snap) => void;
  onReport: (s: Snap) => void;
  onClearReports: (s: Snap) => void;
}) {
  const c = useTheme();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const today = dayKey();
  const nowH = new Date().getHours();
  const [filter, setFilter] = useState<string | null>(null);
  const posted = new Set(snaps.map((x) => x.authorId));
  const people = members.filter((m) => m.id === me.id || posted.has(m.id));

  const items = useMemo(() => {
    const list = filter ? snaps.filter((x) => x.authorId === filter) : snaps;
    const out: Item[] = [];
    let last = '';
    list.forEach((x) => {
      if (x.day !== last) {
        out.push({ type: 'header', key: 'h' + x.day, day: x.day });
        last = x.day;
      }
      out.push({ type: 'snap', key: x.$id, snap: x });
    });
    return out;
  }, [snaps, filter]);

  const snappedThisHour = snaps.some((x) => x.authorId === me.id && x.day === today && x.hour === nowH);

  const header = (
    <View>
      <View style={s.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../../assets/logo-mark.png')} style={{ width: 36, height: 36 }} accessibilityLabel="" />
          <Text style={[s.wordmark, { color: c.onSurface }]}>HourSnap</Text>
        </View>
        <Press onPress={onStreaks} radius={S.full} accessibilityLabel={`Streak ${streak} hours`} style={[s.streak, { backgroundColor: streak > 0 ? c.fireContainer : c.surfaceContainerLow }]}>
          <Icon name="fire" size={20} color={streak > 0 ? c.fire : c.outline} />
          <Text style={[T.titleMedium, T.num, { color: streak > 0 ? c.onFireContainer : c.onSurfaceVariant }]}>{streak}</Text>
        </Press>
      </View>

      <HourRibbon snaps={snaps} meId={me.id} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.people} style={{ marginHorizontal: -20 }}>
        {[{ id: '', name: 'Everyone' }, ...people].map((m) => {
          const on = (filter ?? '') === m.id;
          return (
            <Press
              key={m.id || 'all'}
              onPress={() => setFilter(m.id || null)}
              radius={S.full}
              accessibilityState={{ selected: on }}
              style={[s.person, { backgroundColor: on ? c.onSurface : c.surfaceContainerLow }]}
            >
              {m.id ? <Avatar id={m.id} name={m.name} size={26} /> : <Icon name="account-group" size={20} color={on ? c.surface : c.onSurface} />}
              <Text style={[T.labelLarge, { color: on ? c.surface : c.onSurface }]}>{m.id === me.id ? 'You' : m.name}</Text>
            </Press>
          );
        })}
      </ScrollView>

      {!snappedThisHour && !filter && (
        <Press onPress={onSnap} radius={6} squish={0.97} accessibilityLabel={`Take your ${nowH}u snap`} style={[s.empty, { borderColor: c.outline }]}>
          <View style={[s.emptyIcon, { backgroundColor: c.primary }]}>
            <Icon name="camera" size={28} color={c.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.titleLarge, { color: c.onSurface }]}>Your {nowH}u print is empty</Text>
            <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>Tap to snap. Skipping is fine too.</Text>
          </View>
        </Press>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={[s.wrap, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 40 }]}
      data={items}
      keyExtractor={(it) => it.key}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} tintColor={c.primary} />}
      ListEmptyComponent={
        <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 40 }]}>
          {filter ? 'No snaps from them in the last 24 hours.' : 'No snaps in the last 24 hours. Be the first!'}
        </Text>
      }
      renderItem={({ item }) =>
        item.type === 'header' ? (
          <Text style={[T.headlineSmall, s.day, { color: c.onSurface }]}>{dayLabel(item.day)}</Text>
        ) : (
          <SnapCard snap={item.snap} meId={me.id} admin={me.admin} onReact={(e) => onReact(item.snap, e)} onKeep={() => onKeep(item.snap)} onDelete={() => onDelete(item.snap)} onReport={() => onReport(item.snap)} onClearReports={() => onClearReports(item.snap)} />
        )
      }
    />
  );
}

const ribbon = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: S.lgInc, paddingVertical: 10, paddingHorizontal: 6, marginTop: 14 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  track: { height: 46, width: '80%', borderRadius: 8, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  bar: { width: 8, borderRadius: 4 },
});

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 20, maxWidth: 600, width: '100%', alignSelf: 'center' },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
    wordmark: { fontFamily: FONTS.xb, fontSize: 34, lineHeight: 38, letterSpacing: -1.4 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14 },
    people: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 7, paddingRight: 14 },
    empty: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 2, borderStyle: 'dashed', marginBottom: 8 },
    emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    day: { marginTop: 18, marginBottom: 18 },
  });
