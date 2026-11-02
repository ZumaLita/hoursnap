import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon, Press, type IconName } from './ui';

export type Tab = 'home' | 'streaks' | 'memories' | 'me';

const ITEMS: { key: Tab | 'snap'; icon: IconName; on: IconName; label: string }[] = [
  { key: 'home', icon: 'home-outline', on: 'home', label: 'Feed' },
  { key: 'streaks', icon: 'fire', on: 'fire', label: 'Streaks' },
  { key: 'snap', icon: 'camera-iris', on: 'camera-iris', label: 'Take a snap' },
  { key: 'memories', icon: 'pin-outline', on: 'pin', label: 'Kept' },
  { key: 'me', icon: 'account-outline', on: 'account', label: 'Me' },
];

export const TAB_BAR_HEIGHT = 72;

/** Floating round menu bar: a dark pill with round buttons, the active one turns white. */
export function TabBar({ tab, onTab, onSnap }: { tab: Tab; onTab: (t: Tab) => void; onSnap: () => void; extended?: boolean }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 6 }]} pointerEvents="box-none">
      <View style={[styles.pill, { borderColor: c.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
        {ITEMS.map((it) => {
          const snap = it.key === 'snap';
          const on = it.key === tab;
          const bg = snap ? c.primary : on ? '#FFFFFF' : '#26262B';
          const fg = snap ? c.onPrimary : on ? '#111114' : '#FFFFFF';
          return (
            <Press
              key={it.key}
              onPress={() => (snap ? onSnap() : onTab(it.key as Tab))}
              radius={28}
              squish={0.88}
              accessibilityRole={snap ? 'button' : 'tab'}
              accessibilityLabel={it.label}
              accessibilityState={snap ? undefined : { selected: on }}
              style={[styles.btn, { backgroundColor: bg }, on && styles.btnOn]}
            >
              <Icon name={on ? it.on : it.icon} size={24} color={fg} />
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 40,
    backgroundColor: '#111114',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  btn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnOn: { borderWidth: 3, borderColor: '#111114' },
});
