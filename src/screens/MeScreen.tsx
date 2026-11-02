import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, ButtonGroup, Card, Icon, IconButton, ListItem, SectionLabel, Switch, TopBar, haptic } from '../components/ui';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { ACCENTS, ACCENT_ORDER, S, T, useStyles, useTheme, type AccentKey, type Appearance, type Theme } from '../theme';
import { changePin, niceError, type Me, type Member, type Snap } from '../api';
import { HoursCard } from './Onboarding';
import { PIN_LENGTH } from '../config';
import { type Schedule } from '../schedule';
import { remindersSupported } from '../notify';
import { PHOTO_STYLES, type PhotoStyle } from '../components/Print';
import { canInstall, showInstallHelp } from '../components/InstallPrompt';

export function MeScreen({
  me,
  snaps,
  kept,
  reminders,
  schedule,
  onSchedule,
  members,
  onBan,
  appearance,
  accentKey,
  onAppearance,
  onAccent,
  onReminders,
  onLogout,
  photoStyle,
  onPhotoStyle,
  avatarId,
  onPickAvatar,
}: {
  avatarId: string | null;
  onPickAvatar: () => Promise<void>;
  me: Me;
  snaps: Snap[];
  kept: Snap[];
  reminders: boolean;
  schedule: Schedule;
  onSchedule: (s: Schedule) => void;
  members: Member[];
  onBan: (id: string, banned: boolean) => void;
  appearance: Appearance;
  accentKey: AccentKey;
  onAppearance: (a: Appearance) => void;
  onAccent: (k: AccentKey) => void;
  onReminders: (on: boolean) => void;
  onLogout: () => void;
  photoStyle: PhotoStyle;
  onPhotoStyle: (p: PhotoStyle) => void;
}) {
  const c = useTheme();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const mine = snaps.filter((x) => x.authorId === me.id);
  const reactionsGot = mine.reduce((n, x) => n + x.reactions.filter((r) => !r.startsWith(me.id + ':')).length, 0);
  const [pinOpen, setPinOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const savePin = async () => {
    if (newPin.length !== PIN_LENGTH) return setPinMsg(`Your new PIN needs ${PIN_LENGTH} digits.`);
    setBusy(true);
    setPinMsg('');
    try {
      await changePin(oldPin, newPin);
      setPinMsg('PIN changed. Save it somewhere safe!');
      setOldPin('');
      setNewPin('');
    } catch (e) {
      setPinMsg(/invalid|password/i.test(String((e as Error).message)) ? 'Your current PIN is wrong.' : niceError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={[s.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 104 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TopBar title="Me" />

      <Card style={[s.profile, { backgroundColor: c.secondaryContainer }]}>
        <Pressable onPress={() => onPickAvatar().catch(() => {})} accessibilityLabel="Change profile photo">
          <Avatar id={me.id} name={me.name} size={72} photo={avatarId} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.secondaryContainer }}>
            <Icon name="camera" size={14} color={c.onPrimary} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[T.headlineSmall, { color: c.onSecondaryContainer }]}>@{me.name}</Text>
          <Text style={[T.bodyMedium, { color: c.onSecondaryContainer, opacity: 0.8 }]}>{me.admin ? 'HourSnap admin' : `${members.filter((m) => !m.banned).length} people on HourSnap`}</Text>
        </View>
      </Card>

      <View style={s.stats}>
        {[
          [mine.length, 'Last 24h', 'camera-outline'],
          [kept.length, 'Kept', 'star-outline'],
          [reactionsGot, 'Reactions', 'emoticon-outline'],
        ].map(([n, l, icon]) => (
          <Card key={String(l)} tone="base" style={s.stat}>
            <Icon name={icon as never} size={20} color={c.primary} />
            <Text style={[T.headlineSmall, T.num, { color: c.onSurface, marginTop: 6 }]}>{n}</Text>
            <Text style={[T.labelMedium, { color: c.onSurfaceVariant }]}>{l}</Text>
          </Card>
        ))}
      </View>

      <SectionLabel>Look</SectionLabel>
      <Card tone="low" style={{ padding: 16 }}>
        <ButtonGroup<Appearance>
          items={[
            { key: 'auto', label: 'System' },
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
          ]}
          value={appearance}
          onChange={onAppearance}
        />
        <Text style={[T.labelLarge, { color: c.onSurfaceVariant, marginTop: 20, marginBottom: 12 }]}>Colour</Text>
        <View style={s.swatches}>
          {ACCENT_ORDER.map((k) => {
            const on = k === accentKey;
            const col = ACCENTS[k][c.dark ? 'dark' : 'light'];
            return (
              <Pressable
                key={k}
                onPress={() => {
                  haptic();
                  onAccent(k);
                }}
                accessibilityLabel={`${ACCENTS[k].name} colour`}
                accessibilityState={{ selected: on }}
                style={[s.swatch, { backgroundColor: col, borderRadius: on ? S.lg : 28, borderWidth: 3, borderColor: on ? c.onSurface : 'transparent' }]}
              >
                {on && <Icon name="check" size={22} color={c.dark ? '#0E1322' : '#FFFFFF'} />}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionLabel>My photo style</SectionLabel>
      <Card tone="low">
        {PHOTO_STYLES.map((p) => (
          <ListItem
            key={p.key}
            icon={({ tape: 'paperclip', film: 'filmstrip', sticker: 'sticker-circle-outline', clean: 'image-outline' } as const)[p.key]}
            title={p.name}
            supporting={p.hint}
            onPress={() => onPhotoStyle(p.key)}
            trailing={<Icon name={p.key === photoStyle ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={p.key === photoStyle ? c.primary : c.outline} />}
          />
        ))}
      </Card>

      <SectionLabel>When I can snap</SectionLabel>
      <Card tone="low" style={{ marginBottom: 12 }}>
        <ListItem
          icon="beach"
          title="I'm on holiday"
          supporting={schedule.onHoliday ? 'Using your holiday hours every day' : 'Turn on during school holidays'}
          trailing={<Switch value={schedule.onHoliday} onChange={(v) => onSchedule({ ...schedule, onHoliday: v })} label="On holiday" />}
        />
        <ListItem
          icon="bell-outline"
          title="Hourly reminders"
          supporting={remindersSupported ? 'A nudge at the start of every hour you picked' : 'Only in the Android app'}
          trailing={<Switch value={reminders && remindersSupported} disabled={!remindersSupported} onChange={onReminders} label="Hourly reminders" />}
        />
      </Card>
      <HoursCard icon="school-outline" title="School days" hint="Monday to Friday" w={schedule.weekday} onChange={(w) => onSchedule({ ...schedule, weekday: w })} />
      <HoursCard icon="sofa-outline" title="Weekends" hint="Saturday and Sunday" w={schedule.weekend} onChange={(w) => onSchedule({ ...schedule, weekend: w })} />
      <HoursCard icon="beach" title="Holidays" hint="Used when 'I'm on holiday' is on" w={schedule.holiday} onChange={(w) => onSchedule({ ...schedule, holiday: w })} />

      {me.admin && (
        <>
          <SectionLabel>Admin: people</SectionLabel>
          <Card tone="low">
            {members
              .filter((m) => m.id !== me.id)
              .map((m) => (
                <ListItem
                  key={m.id}
                  icon={m.banned ? 'account-cancel-outline' : 'account-outline'}
                  title={`@${m.username}`}
                  supporting={m.banned ? 'Removed: their snaps are hidden' : 'Active'}
                  trailing={
                    <Button
                      title={m.banned ? 'Let back in' : 'Remove'}
                      variant={m.banned ? 'tonal' : 'outlined'}
                      onPress={() => {
                        const go = () => onBan(m.id, !m.banned);
                        if (m.banned || Platform.OS !== 'web') go();
                        else if (window.confirm(`Remove ${m.name}? Their snaps get hidden.`)) go();
                      }}
                    />
                  }
                />
              ))}
            {members.length <= 1 && <ListItem icon="account-multiple-outline" title="Nobody else yet" supporting="People show up here when they join." />}
          </Card>
        </>
      )}

      <SectionLabel>Account</SectionLabel>
      <Card tone="low">
        {canInstall() && <ListItem icon="cellphone-arrow-down" title="Add to home screen" supporting="Open HourSnap like a real app" onPress={showInstallHelp} />}
        <ListItem icon="key-outline" title="Change PIN" supporting={`${PIN_LENGTH} digits`} onPress={() => setPinOpen((o) => !o)} trailing={<Icon name={pinOpen ? 'chevron-up' : 'chevron-down'} size={24} color={c.onSurfaceVariant} />} />
        {pinOpen && (
          <View style={{ padding: 16, paddingTop: 4, gap: 12 }}>
            <TextInput style={s.input} placeholder="Current PIN" placeholderTextColor={c.onSurfaceVariant} secureTextEntry keyboardType="number-pad" value={oldPin} onChangeText={(t) => setOldPin(t.replace(/\D/g, ''))} maxLength={8} />
            <TextInput style={s.input} placeholder="New PIN" placeholderTextColor={c.onSurfaceVariant} secureTextEntry keyboardType="number-pad" value={newPin} onChangeText={(t) => setNewPin(t.replace(/\D/g, ''))} maxLength={8} />
            {!!pinMsg && <Text style={[T.bodySmall, { color: c.onSurfaceVariant }]}>{pinMsg}</Text>}
            <Button title="Save PIN" busy={busy} onPress={savePin} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
        <ListItem
          icon="logout"
          title="Log out"
          danger
          onPress={() => {
            if (Platform.OS === 'web' ? window.confirm('Log out of HourSnap?') : true) onLogout();
          }}
        />
      </Card>

      <Text style={[T.bodySmall, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 24 }]}>HourSnap · by Storm Gees</Text>
    </ScrollView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
    profile: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, marginTop: 8 },
    stats: { flexDirection: 'row', gap: 8, marginTop: 8 },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: S.lgInc },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatch: { width: 52, height: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    swatchTop: { height: 28 },
    swatchBottom: { flexDirection: 'row', height: 28 },
    swatchCheck: { position: 'absolute', top: 14, left: 14, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    input: { height: 56, borderRadius: S.xs, borderWidth: 1, borderColor: c.outline, paddingHorizontal: 16, color: c.onSurface, ...T.bodyLarge },
  });
