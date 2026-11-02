import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, Icon, Press, SectionLabel, Shape, TopBar, type IconName } from '../components/ui';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { S, T, useStyles, useTheme, type Theme } from '../theme';
import { BADGES, MAX_BONUS, computeStreak, type Hours, type SlotState, type StreakRow, type StreakStats } from '../streak';
import { windowFor } from '../schedule';
import type { Me, Member } from '../api';

const MILESTONES = [3, 7, 14, 30, 60, 100];
const BADGE_ICONS: Record<string, IconName> = {
  spark: 'fire',
  flame: 'fire',
  blaze: 'fire-circle',
  inferno: 'campfire',
  wildfire: 'campfire',
  legend: 'trophy',
  fullday: 'calendar-check',
  early: 'weather-sunset-up',
  owl: 'weather-night',
  saved: 'shield-check',
  collector: 'shield-star',
  hundred: 'camera-burst',
};
const BADGE_SHAPES: ('cookie' | 'burst' | 'clover' | 'circle')[] = ['cookie', 'burst', 'clover'];

function Shields({ n, size = 16 }: { n: number; size?: number }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: MAX_BONUS }, (_, i) => (
        <Icon key={i} name={i < n ? 'shield' : 'shield-outline'} size={size} color={i < n ? c.shield : c.outline} />
      ))}
    </View>
  );
}

function Timeline({ today, hours: hours_, compact }: { today: Record<number, SlotState>; hours: Hours; compact?: boolean }) {
  const c = useTheme();
  const hours: number[] = [];
  if (!hours_) return compact ? <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceContainerHigh }} /> : <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>Vandaag geen snap-uren. Geniet van je vrije dag.</Text>;
  for (let h = hours_.start; h <= hours_.end; h++) hours.push(h);
  const bg = (st: SlotState) => (st === 'snap' ? c.fire : st === 'saved' ? c.shield : st === 'missed' ? c.surfaceContainerHighest : 'transparent');
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {hours.map((h) => {
          const st = today[h];
          return (
            <View
              key={h}
              style={{
                flex: 1,
                height: compact ? 8 : 32,
                borderRadius: compact ? 4 : st === 'snap' || st === 'saved' ? 16 : 8,
                backgroundColor: bg(st),
                borderWidth: st === 'future' || st === 'now' ? (st === 'now' ? 2 : 1) : 0,
                borderColor: st === 'now' ? c.primary : c.outlineVariant,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!compact && st === 'snap' && <Icon name="fire" size={14} color="#FFFFFF" />}
              {!compact && st === 'saved' && <Icon name="shield" size={13} color={c.dark ? '#00174B' : '#FFFFFF'} />}
            </View>
          );
        })}
      </View>
      {!compact && (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {hours.map((h) => (
            <Text key={h} style={[T.labelSmall, { flex: 1, textAlign: 'center', color: c.onSurfaceVariant }]}>
              {(h - hours_.start) % 3 === 0 ? h : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function Streaks({ me, members, rows, refreshing, onRefresh }: { me: Me; members: Member[]; rows: StreakRow[]; refreshing: boolean; onRefresh: () => void }) {
  const c = useTheme();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [howOpen, setHowOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const stats = useMemo(() => {
    const m = new Map<string, StreakStats>();
    const people = members;
    people.forEach((p) => m.set(p.id, computeStreak(rows.filter((r) => r.authorId === p.id), (d) => windowFor(p.schedule, d))));
    return m;
  }, [rows, members, me]);

  const mine = stats.get(me.id) ?? computeStreak([], () => null);
  const nextIdx = MILESTONES.findIndex((m) => m > mine.best);
  const next = nextIdx >= 0 ? MILESTONES[nextIdx] : null;
  const unlocked = BADGES.filter((b) => b.unlocked(mine)).length;
  const ranked = [...members].sort((a, b) => (stats.get(b.id)?.current ?? 0) - (stats.get(a.id)?.current ?? 0));
  const people = ranked.slice(0, 10).concat(ranked.slice(10).filter((m) => m.id === me.id));
  const lit = mine.current > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={[s.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 104 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} tintColor={c.primary} />}
    >
      <TopBar title="Streaks" overline={mine.todayHours ? `Vandaag: ${mine.todayHours.start}u – ${mine.todayHours.end}u` : 'Vandaag geen snap-uren'} />

      <Card style={[s.hero, { backgroundColor: lit ? c.fireContainer : c.surfaceContainerHigh }]}>
        <View style={s.heroTop}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Shape kind="burst" size={112} color={lit ? c.fire : c.surfaceContainerHighest} />
          </Animated.View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="fire" size={56} color={lit ? '#FFFFFF' : c.outline} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.hero, { color: lit ? c.onFireContainer : c.onSurface }]}>{mine.current}</Text>
            <Text style={[T.titleMedium, { color: lit ? c.onFireContainer : c.onSurfaceVariant, marginTop: -4 }]}>
              uur op rij
            </Text>
          </View>
        </View>

        <View style={s.statRow}>
          <View style={[s.stat, { backgroundColor: c.surfaceContainerLowest }]}>
            <Shields n={mine.bonus} size={18} />
            <Text style={[T.labelMedium, { color: c.onSurfaceVariant, marginTop: 6 }]}>Bonus</Text>
          </View>
          <View style={[s.stat, { backgroundColor: c.surfaceContainerLowest }]}>
            <Text style={[T.titleLargeEmph, T.num, { color: c.onSurface }]}>{mine.best}</Text>
            <Text style={[T.labelMedium, { color: c.onSurfaceVariant }]}>Beste</Text>
          </View>
          <View style={[s.stat, { backgroundColor: c.surfaceContainerLowest }]}>
            <Text style={[T.titleLargeEmph, T.num, { color: c.onSurface }]}>{mine.todaySnaps}</Text>
            <Text style={[T.labelMedium, { color: c.onSurfaceVariant }]}>Vandaag</Text>
          </View>
        </View>

        {next && (
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[T.labelLarge, { color: lit ? c.onFireContainer : c.onSurfaceVariant }]}>Next award: {BADGES[nextIdx].title}</Text>
              <Text style={[T.labelLarge, T.num, { color: lit ? c.onFireContainer : c.onSurfaceVariant }]}>
                {mine.current}/{next}
              </Text>
            </View>
            <View style={[s.track, { backgroundColor: c.surfaceContainerLowest }]}>
              <View style={[s.trackFill, { width: `${Math.max(4, Math.min(1, mine.current / next) * 100)}%`, backgroundColor: c.fire }]} />
            </View>
          </View>
        )}
      </Card>

      <Card tone="low" style={s.today}>
        <Text style={[T.titleMedium, { color: c.onSurface, marginBottom: 14 }]}>Vandaag</Text>
        <Timeline today={mine.today} hours={mine.todayHours} />
      </Card>

      <Press onPress={() => setHowOpen((o) => !o)} radius={S.full} style={s.how}>
        <Icon name="help-circle-outline" size={20} color={c.primary} />
        <Text style={[T.labelLarge, { color: c.primary, flex: 1 }]}>Zo werken streaks</Text>
        <Icon name={howOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.primary} />
      </Press>
      {howOpen && (
        <Card tone="base" style={{ padding: 16, gap: 14 }}>
          {(
            [
              ['fire', c.fire, 'Snap minstens één keer in elk uur dat je koos (schooldagen, weekend, vakantie) en je streak groeit.'],
              ['shield', c.shield, `Een extra snap geeft een bonus: een tweede in hetzelfde uur (10u en 10u30), of een buiten je uren. Je kunt er ${MAX_BONUS} sparen.`],
              ['shield-check', c.shield, 'Een uur vergeten? Een bonus springt in en redt je streak. Geen meer over? Dan terug naar 0.'],
            ] as [IconName, string, string][]
          ).map(([icon, color, text]) => (
            <View key={icon} style={{ flexDirection: 'row', gap: 12 }}>
              <Icon name={icon} size={20} color={color} />
              <Text style={[T.bodyMedium, { color: c.onSurface, flex: 1 }]}>{text}</Text>
            </View>
          ))}
        </Card>
      )}

      <SectionLabel>{`Prijzen · ${unlocked} van ${BADGES.length}`}</SectionLabel>
      <Card tone="low" style={s.awards}>
        {BADGES.map((b, i) => {
          const on = b.unlocked(mine);
          return (
            <View key={b.key} style={s.award} accessibilityLabel={`${b.title}, ${on ? 'gehaald' : 'nog op slot'}: ${b.hint}`}>
              <Shape kind={BADGE_SHAPES[i % BADGE_SHAPES.length]} size={64} color={on ? b.color : c.surfaceContainerHighest}>
                <Icon name={on ? BADGE_ICONS[b.key] ?? 'star' : 'lock'} size={on ? 28 : 20} color={on ? '#FFFFFF' : c.outline} />
              </Shape>
              <Text style={[T.labelLarge, { color: on ? c.onSurface : c.onSurfaceVariant, marginTop: 8 }]} numberOfLines={1}>
                {b.title}
              </Text>
              <Text style={[T.bodySmall, { color: c.onSurfaceVariant, textAlign: 'center' }]} numberOfLines={2}>
                {b.hint}
              </Text>
            </View>
          );
        })}
      </Card>

      <SectionLabel>Ranglijst</SectionLabel>
      <Card tone="low">
        {people.map((m, i) => {
          const st = stats.get(m.id) ?? computeStreak([], () => null);
          return (
            <View key={m.id} style={[s.member, i > 0 && { borderTopWidth: 1, borderTopColor: c.outlineVariant }]}>
              <View style={s.memberHead}>
                <Text style={[T.titleSmall, { color: c.onSurfaceVariant, width: 22 }]}>{ranked.indexOf(m) + 1}</Text>
                <Avatar id={m.id} name={m.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.titleMedium, { color: c.onSurface }]}>{m.id === me.id ? 'Jij' : m.name}</Text>
                  <Shields n={st.bonus} size={13} />
                </View>
                <View style={[s.memberChip, { backgroundColor: st.current > 0 ? c.fireContainer : c.surfaceContainerHighest }]}>
                  <Icon name="fire" size={18} color={st.current > 0 ? c.onFireContainer : c.outline} />
                  <Text style={[T.titleMedium, T.num, { color: st.current > 0 ? c.onFireContainer : c.onSurfaceVariant }]}>{st.current}</Text>
                </View>
              </View>
              <Timeline today={st.today} hours={st.todayHours} compact />
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
    hero: { padding: 20, marginTop: 8 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    statRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
    stat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: S.lg, minHeight: 68 },
    track: { height: 12, borderRadius: 6, overflow: 'hidden' },
    trackFill: { height: 12, borderRadius: 6 },
    today: { padding: 16, marginTop: 12 },
    how: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 48, marginTop: 8 },
    awards: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 16, rowGap: 18 },
    award: { width: '33.33%', alignItems: 'center', paddingHorizontal: 6 },
    member: { padding: 16, gap: 12 },
    memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    memberChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: S.sm },
  });
