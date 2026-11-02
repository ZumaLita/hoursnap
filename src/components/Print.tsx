// How a snap looks. Each person picks a style for their own photos.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, T, useTheme } from '../theme';

export type PhotoStyle = 'tape' | 'film' | 'sticker' | 'clean';
export const PHOTO_STYLES: { key: PhotoStyle; name: string; hint: string }[] = [
  { key: 'tape', name: 'Photo print', hint: 'White print, selfie taped on, date stamp' },
  { key: 'film', name: 'Film strip', hint: 'Dark film frame with sprocket holes' },
  { key: 'sticker', name: 'Sticker', hint: 'Thick white edge, round selfie sticker' },
  { key: 'clean', name: 'Clean', hint: 'Full photo, rounded corners, no frame' },
];
export const isPhotoStyle = (v: unknown): v is PhotoStyle => PHOTO_STYLES.some((s) => s.key === v);

const pad = (n: number) => String(n).padStart(2, '0');
export const stampText = (d: Date) => `${pad(d.getDate())} ${pad(d.getMonth() + 1)} '${String(d.getFullYear()).slice(2)}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const tiltFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return ((h % 5) - 2) * 0.55;
};

type Img = (which: 'big' | 'small', size: { width: number; height: number; borderRadius?: number }) => React.ReactNode;

export function Print({
  style,
  width,
  id,
  date,
  caption,
  hour,
  extra,
  image,
  onPress,
}: {
  style: PhotoStyle;
  width: number;
  id: string;
  date: Date;
  caption?: string | null;
  hour: number;
  extra?: boolean;
  image: Img;
  onPress?: () => void;
}) {
  const c = useTheme();
  const tilt = style === 'tape' || style === 'sticker' ? tiltFor(id) : 0;
  const small = width < 240;
  const stamp = (
    <Text numberOfLines={1} style={[s.stamp, small && { fontSize: 12, right: 6, bottom: 4, letterSpacing: 0 }, { color: c.stamp, textShadowColor: c.stamp }]}>
      {stampText(date)}
    </Text>
  );
  const badge = extra ? (
    <View style={[s.extra, { backgroundColor: c.tertiaryContainer }]}>
      <Text style={[T.labelSmall, { color: c.onTertiaryContainer }]}>Extra snap</Text>
    </View>
  ) : null;

  if (style === 'film') {
    // A real strip: the back photo and the selfie are two frames, one after the other.
    const w = width - 36;
    const h1 = Math.round((w * 5) / 4);
    const h2 = Math.round((w * 3) / 4);
    const gap = 10;
    const total = h1 + gap + h2 + 28;
    const holes = Array.from({ length: Math.floor(total / 22) });
    const frameNo = (n: number) => (
      <Text style={[s.frameNo, small && { fontSize: 11 }]}>
        {pad(hour)}u{'  '}▸ {n}A
      </Text>
    );
    return (
      <View style={[s.film, { width }]}>
        <View style={s.holes}>{holes.map((_, i) => <View key={i} style={s.hole} />)}</View>
        <Pressable onPress={onPress} accessibilityLabel="Swap photos" style={{ width: w }}>
          <View style={{ width: w, height: h1, overflow: 'hidden', borderRadius: 2 }}>
            {image('big', { width: w, height: h1 })}
            {stamp}
            {badge}
          </View>
          {frameNo(1)}
          <View style={{ width: w, height: h2, overflow: 'hidden', borderRadius: 2 }}>{image('small', { width: w, height: h2 })}</View>
          {caption ? (
            <Text style={[s.filmCaption, { width: w }, small && { fontSize: 12 }]} numberOfLines={2}>
              {caption}
            </Text>
          ) : (
            frameNo(2)
          )}
        </Pressable>
        <View style={s.holes}>{holes.map((_, i) => <View key={i} style={s.hole} />)}</View>
      </View>
    );
  }

  if (style === 'sticker') {
    const w = width - 24;
    const h = Math.round((w * 5) / 4);
    const sw = Math.round(w * 0.36);
    return (
      <View style={[s.sticker, { width, backgroundColor: c.print, shadowColor: c.printShadow, transform: [{ rotate: `${tilt}deg` }] }]}>
        <Pressable onPress={onPress} accessibilityLabel="Swap photos" style={{ width: w, height: h, overflow: 'hidden', borderRadius: 22 }}>
          {image('big', { width: w, height: h })}
          {badge}
        </Pressable>
        <View style={[s.dot, { width: sw + 12, height: sw + 12, borderRadius: (sw + 12) / 2, backgroundColor: c.print, shadowColor: c.printShadow }]} pointerEvents="none">
          {image('small', { width: sw, height: sw, borderRadius: sw / 2 })}
        </View>
        {!!caption && (
          <Text style={[T.titleMedium, { color: '#2B3045', paddingHorizontal: 6, paddingTop: 12, paddingBottom: 2 }]} numberOfLines={2}>
            {caption}
          </Text>
        )}
      </View>
    );
  }

  if (style === 'clean') {
    const w = width;
    const h = Math.round((w * 5) / 4);
    const sw = Math.round(w * 0.3);
    return (
      <View style={{ width }}>
        <Pressable onPress={onPress} accessibilityLabel="Swap photos" style={{ width: w, height: h, overflow: 'hidden', borderRadius: 28 }}>
          {image('big', { width: w, height: h })}
          <View style={[s.cleanSelfie, { width: sw, height: Math.round((sw * 4) / 3) }]}>{image('small', { width: sw, height: Math.round((sw * 4) / 3) })}</View>
          <View style={s.cleanHour}>
            <Text style={[T.labelLarge, { color: '#FFFFFF' }]}>{pad(hour)}u</Text>
          </View>
          {badge}
        </Pressable>
        {!!caption && (
          <Text style={[T.bodyLarge, { color: c.onSurface, paddingHorizontal: 4, paddingTop: 10 }]} numberOfLines={3}>
            {caption}
          </Text>
        )}
      </View>
    );
  }

  // 'tape': white photo print with the selfie taped on.
  const w = width - 20;
  const h = Math.round((w * 5) / 4);
  const sw = Math.round(w * 0.34);
  return (
    <View style={[s.print, { width, backgroundColor: c.print, shadowColor: c.printShadow, transform: [{ rotate: `${tilt}deg` }] }]}>
      <Pressable onPress={onPress} accessibilityLabel="Swap photos" style={{ width: w, height: h, overflow: 'hidden', borderRadius: 3 }}>
        {image('big', { width: w, height: h })}
        {stamp}
        {badge}
      </Pressable>
      <View style={[s.selfie, { width: sw + 10, backgroundColor: c.print, shadowColor: c.printShadow }]} pointerEvents="none">
        <View style={[s.tape, { backgroundColor: c.tape }]} />
        {image('small', { width: sw, height: Math.round((sw * 4) / 3), borderRadius: 2 })}
      </View>
      <Text style={[T.hand, s.caption, small && { fontSize: 16, minHeight: 34, paddingTop: 6, paddingBottom: 8 }, { color: caption ? '#2B3045' : '#A4A9B8' }]} numberOfLines={2}>
        {caption || `${pad(hour)}u`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  extra: { position: 'absolute', right: 10, top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  print: { padding: 10, paddingBottom: 0, borderRadius: 4, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
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
  film: { flexDirection: 'row', backgroundColor: '#17140F', paddingVertical: 10, borderRadius: 6, justifyContent: 'space-between' },
  holes: { width: 18, alignItems: 'center', gap: 10, paddingTop: 2, overflow: 'hidden' },
  hole: { width: 9, height: 12, borderRadius: 2.5, backgroundColor: '#E8E2D4' },
  frameNo: { fontFamily: FONTS.stamp, fontSize: 15, color: '#E9B44C', paddingVertical: 3, letterSpacing: 1 },
  filmCaption: { fontFamily: FONTS.stamp, fontSize: 18, lineHeight: 20, color: '#E9B44C', paddingTop: 6, letterSpacing: 1 },
  sticker: { padding: 12, borderRadius: 30, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  dot: {
    position: 'absolute',
    top: -16,
    right: -10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    transform: [{ rotate: '6deg' }],
  },
  cleanSelfie: { position: 'absolute', top: 14, left: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: '#FFFFFF' },
  cleanHour: { position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
});
