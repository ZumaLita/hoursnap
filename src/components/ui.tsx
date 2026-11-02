import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  ImageStyle,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONTS, S, T, colorFor, useTheme } from '../theme';
import { photo } from '../api';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export const Icon = ({ name, size = 24, color }: { name: IconName; size?: number; color: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => (reduceMotion = v)).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduceMotion = v));
const native = Platform.OS !== 'web';

export const haptic = (kind: 'tap' | 'confirm' = 'tap') => {
  if (!native) return;
  if (kind === 'confirm') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.performAndroidHapticsAsync?.(Haptics.AndroidHaptics.Virtual_Key).catch(() => Haptics.selectionAsync().catch(() => {}));
};

/** M3 pressable: ripple (state layer) plus an expressive spring squish. */
export function Press({
  children,
  style,
  radius = S.full,
  rippleColor,
  squish = 0.95,
  morph,
  onPress,
  ...rest
}: PressableProps & {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  rippleColor?: string;
  squish?: number;
  /** Corner radius to morph to while pressed (expressive shape morph). */
  morph?: number;
  children?: React.ReactNode;
}) {
  const c = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const corner = useRef(new Animated.Value(radius)).current;
  const go = (down: boolean) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: down ? squish : 1, useNativeDriver: false, speed: down ? 50 : 14, bounciness: down ? 0 : 10 }).start();
    if (morph !== undefined)
      Animated.spring(corner, { toValue: down ? morph : radius, useNativeDriver: false, speed: 30, bounciness: 6 }).start();
  };
  return (
    <Pressable
      {...rest}
      onPressIn={() => go(true)}
      onPressOut={() => go(false)}
      onPress={(e) => {
        haptic();
        onPress?.(e);
      }}
      android_ripple={{ color: rippleColor ?? (c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'), borderless: false, foreground: true }}
      style={{ borderRadius: radius, overflow: 'hidden' }}
    >
      {({ pressed }) => (
        <Animated.View style={[style, { borderRadius: morph !== undefined ? corner : radius, overflow: 'hidden', transform: [{ scale }] }]}>
          {children}
          {!native && pressed && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Expressive shapes from the M3 shape library, drawn as SVG. */
export function shapePath(kind: 'cookie' | 'burst' | 'clover' | 'circle', size: number) {
  const cfg = { cookie: [9, 0.06], burst: [12, 0.09], clover: [4, 0.16], circle: [1, 0] }[kind];
  const [lobes, amp] = cfg as [number, number];
  const r0 = size / 2;
  const R = r0 / (1 + amp);
  const pts: string[] = [];
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = R * (1 + amp * Math.cos(lobes * a));
    pts.push(`${(r0 + r * Math.cos(a - Math.PI / 2)).toFixed(2)},${(r0 + r * Math.sin(a - Math.PI / 2)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function Shape({
  kind,
  size,
  color,
  children,
  style,
}: {
  kind: 'cookie' | 'burst' | 'clover' | 'circle';
  size: number;
  color: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={shapePath(kind, size)} fill={color} />
      </Svg>
      {children}
    </View>
  );
}

/** Round avatar with a thin print-white ring. */
export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFor(id),
        borderWidth: Math.max(2, size / 18),
        borderColor: c.print,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.44, lineHeight: size * 0.56, fontFamily: FONTS.xb }}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function TopBar({ title, overline, actions }: { title: string; overline?: string; actions?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.topBar}>
      <View style={{ flex: 1 }}>
        {!!overline && <Text style={[T.labelLarge, { color: c.onSurfaceVariant }]}>{overline}</Text>}
        <Text style={[T.headlineMediumEmph, { color: c.onSurface }]}>{title}</Text>
      </View>
      {actions}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  variant = 'standard',
  size = 48,
  color,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  variant?: 'standard' | 'tonal' | 'filled';
  size?: number;
  color?: string;
}) {
  const c = useTheme();
  const bg = variant === 'filled' ? c.primary : variant === 'tonal' ? c.secondaryContainer : 'transparent';
  const fg = color ?? (variant === 'filled' ? c.onPrimary : variant === 'tonal' ? c.onSecondaryContainer : c.onSurfaceVariant);
  return (
    <Press onPress={onPress} accessibilityLabel={label} accessibilityRole="button" morph={variant === 'standard' ? undefined : S.md} style={{ width: size, height: size, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={24} color={fg} />
    </Press>
  );
}

export function Button({
  title,
  onPress,
  variant = 'filled',
  icon,
  busy,
  style,
  big,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  icon?: IconName;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const c = useTheme();
  const bg = variant === 'filled' ? c.primary : variant === 'tonal' ? c.secondaryContainer : 'transparent';
  const fg = variant === 'filled' ? c.onPrimary : variant === 'tonal' ? c.onSecondaryContainer : c.primary;
  const h = big ? 56 : 40;
  return (
    <Press
      onPress={busy ? undefined : onPress}
      morph={S.md}
      style={[
        {
          height: h,
          paddingHorizontal: big ? 28 : 24,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: busy ? 0.7 : 1,
        },
        variant === 'outlined' && { borderWidth: 1, borderColor: c.outlineVariant },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={big ? 22 : 18} color={fg} />}
          <Text style={[big ? T.titleMedium : T.labelLarge, { color: fg }]}>{title}</Text>
        </>
      )}
    </Press>
  );
}

export function Card({ children, style, tone = 'high' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'low' | 'base' | 'high' | 'highest' }) {
  const c = useTheme();
  const bg = { low: c.surfaceContainerLow, base: c.surfaceContainer, high: c.surfaceContainerHigh, highest: c.surfaceContainerHighest }[tone];
  return <View style={[{ backgroundColor: bg, borderRadius: S.xl, overflow: 'hidden' }, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  const c = useTheme();
  return <Text style={[T.titleSmall, { color: c.primary, marginTop: 28, marginBottom: 10, marginLeft: 4 }]}>{children}</Text>;
}

export function ListItem({
  icon,
  title,
  supporting,
  trailing,
  onPress,
  danger,
}: {
  icon?: IconName;
  title: string;
  supporting?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const c = useTheme();
  const body = (
    <View style={styles.listItem}>
      {icon && <Icon name={icon} size={24} color={danger ? c.error : c.onSurfaceVariant} />}
      <View style={{ flex: 1 }}>
        <Text style={[T.bodyLarge, { color: danger ? c.error : c.onSurface }]}>{title}</Text>
        {!!supporting && <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>{supporting}</Text>}
      </View>
      {trailing}
    </View>
  );
  return onPress ? (
    <Press onPress={onPress} radius={0} squish={1}>
      {body}
    </Press>
  ) : (
    body
  );
}

/** M3 switch. */
export function Switch({ value, onChange, disabled, label }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  const c = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 8 }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      onPress={() => {
        if (disabled) return;
        haptic();
        onChange(!value);
      }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.38 : 1 }}
    >
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: 16,
          backgroundColor: value ? c.primary : c.surfaceContainerHighest,
          borderWidth: 2,
          borderColor: value ? c.primary : c.outline,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: x.interpolate({ inputRange: [0, 1], outputRange: [6, 22] }),
            width: x.interpolate({ inputRange: [0, 1], outputRange: [16, 24] }),
            height: x.interpolate({ inputRange: [0, 1], outputRange: [16, 24] }),
            borderRadius: 12,
            backgroundColor: value ? c.onPrimary : c.outline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value && <Icon name="check" size={14} color={c.primary} />}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** M3 connected button group (single select). */
export function ButtonGroup<K extends string>({ items, value, onChange }: { items: { key: K; label: string; icon?: IconName }[]; value: K; onChange: (k: K) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {items.map((it, i) => {
        const on = it.key === value;
        const first = i === 0;
        const last = i === items.length - 1;
        return (
          <View key={it.key} style={{ flex: 1 }}>
            <Press
              onPress={() => onChange(it.key)}
              radius={on ? S.full : 0}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                height: 44,
                backgroundColor: on ? c.secondaryContainer : c.surfaceContainerHighest,
                borderTopLeftRadius: on || first ? 22 : 6,
                borderBottomLeftRadius: on || first ? 22 : 6,
                borderTopRightRadius: on || last ? 22 : 6,
                borderBottomRightRadius: on || last ? 22 : 6,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {on && <Icon name="check" size={18} color={c.onSecondaryContainer} />}
              {!on && it.icon && <Icon name={it.icon} size={18} color={c.onSurfaceVariant} />}
              <Text style={[T.labelLarge, { color: on ? c.onSecondaryContainer : c.onSurfaceVariant }]}>{it.label}</Text>
            </Press>
          </View>
        );
      })}
    </View>
  );
}

/** Loads a private photo from Appwrite and shows it. */
export function SnapImage({ fileId, style }: { fileId: string; style?: StyleProp<ImageStyle> }) {
  const c = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    setFailed(false);
    photo(fileId)
      .then((u) => {
        if (!alive) return;
        setUri(u);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: native }).start();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [fileId, fade]);
  return (
    <View style={[style as StyleProp<ViewStyle>, { backgroundColor: c.surfaceContainerHighest, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      {failed && <Icon name="image-off-outline" size={22} color={c.onSurfaceVariant} />}
      {uri && <Animated.Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" />}
    </View>
  );
}

/** A snap: back photo with the selfie in the corner. */
export function SnapTile({
  back,
  front,
  width,
  radius = S.lg,
  label,
  badge,
  onPress,
}: {
  back: string;
  front: string;
  width: number;
  radius?: number;
  label?: string;
  badge?: React.ReactNode;
  onPress?: () => void;
}) {
  const h = Math.round((width * 4) / 3);
  const inset = Math.round(width * 0.32);
  return (
    <Press onPress={onPress} radius={radius} morph={radius + 12} squish={0.96} style={{ width, height: h }}>
      <SnapImage fileId={back} style={{ width, height: h }} />
      <View style={[styles.tileInset, { width: inset, height: Math.round((inset * 4) / 3), borderRadius: Math.max(8, radius - 6) }]}>
        <SnapImage fileId={front} style={StyleSheet.absoluteFill as ImageStyle} />
      </View>
      {!!label && (
        <View style={styles.tileLabel}>
          <Text style={[T.labelMedium, { color: '#FFFFFF' }]}>{label}</Text>
        </View>
      )}
      {badge && <View style={styles.tileBadge}>{badge}</View>}
    </Press>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 64, paddingTop: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  tileInset: { position: 'absolute', top: 8, left: 8, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF' },
  tileLabel: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: S.sm, backgroundColor: 'rgba(0,0,0,0.5)' },
  tileBadge: { position: 'absolute', right: 8, bottom: 8 },
});
