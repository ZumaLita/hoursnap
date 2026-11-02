import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, ButtonGroup, Icon, Switch, haptic } from '../components/ui';
import { PHOTO_STYLES, Print, type PhotoStyle } from '../components/Print';
import { ACCENTS, ACCENT_ORDER, FONTS, S, T, useTheme, type AccentKey, type Appearance } from '../theme';
import { remindersSupported } from '../notify';
import { type Schedule, type Window } from '../schedule';

const SAMPLE_BACK = require('../../assets/sample-back.jpg');
const SAMPLE_FRONT = require('../../assets/sample-front.jpg');

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable onPress={() => value > min && onChange(value - 1)} accessibilityLabel="Vroeger" style={[st.step, { backgroundColor: c.surfaceContainerHigh }]}>
        <Icon name="minus" size={18} color={c.onSurface} />
      </Pressable>
      <Text style={[T.titleMedium, T.num, { color: c.onSurface, minWidth: 40, textAlign: 'center' }]}>{value}u</Text>
      <Pressable onPress={() => value < max && onChange(value + 1)} accessibilityLabel="Later" style={[st.step, { backgroundColor: c.surfaceContainerHigh }]}>
        <Icon name="plus" size={18} color={c.onSurface} />
      </Pressable>
    </View>
  );
}

export function HoursCard({ icon, title, hint, w, onChange }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; hint: string; w: Window; onChange: (w: Window) => void }) {
  const c = useTheme();
  return (
    <View style={[st.hours, { backgroundColor: c.surfaceContainerLow }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[st.pointIcon, { backgroundColor: c.secondaryContainer, width: 40, height: 40 }]}>
          <Icon name={icon} size={22} color={c.onSecondaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.titleMedium, { color: c.onSurface }]}>{title}</Text>
          <Text style={[T.bodySmall, { color: c.onSurfaceVariant }]}>{hint}</Text>
        </View>
        <Switch value={w.on} onChange={(on) => onChange({ ...w, on })} label={`${title} snappen`} />
      </View>
      {w.on ? (
        <View style={st.hoursRow}>
          <Text style={[T.labelLarge, { color: c.onSurfaceVariant }]}>Van</Text>
          <Stepper value={w.start} min={5} max={w.end} onChange={(v) => onChange({ ...w, start: v })} />
          <Text style={[T.labelLarge, { color: c.onSurfaceVariant }]}>tot</Text>
          <Stepper value={w.end} min={w.start} max={23} onChange={(v) => onChange({ ...w, end: v })} />
        </View>
      ) : (
        <Text style={[T.bodyMedium, { color: c.onSurfaceVariant, marginTop: 10 }]}>Geen snaps en geen meldingen op deze dagen.</Text>
      )}
    </View>
  );
}

export function Onboarding({
  name,
  appearance,
  accentKey,
  photoStyle,
  schedule,
  onSchedule,
  onAppearance,
  onAccent,
  onPhotoStyle,
  onDone,
  meId,
  avatarId,
  onPickAvatar,
  joinedLab,
  onJoinLab,
}: {
  meId: string;
  avatarId: string | null;
  onPickAvatar: () => Promise<void>;
  joinedLab: boolean;
  onJoinLab: () => Promise<void>;
  name: string;
  appearance: Appearance;
  accentKey: AccentKey;
  photoStyle: PhotoStyle;
  schedule: Schedule;
  onSchedule: (s: Schedule) => void;
  onAppearance: (a: Appearance) => void;
  onAccent: (k: AccentKey) => void;
  onPhotoStyle: (p: PhotoStyle) => void;
  onDone: (reminders: boolean) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const steps = remindersSupported ? 7 : 6;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await f();
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const sample = (w: number) => (which: 'big' | 'small', size: { width: number; height: number; borderRadius?: number }) => (
    <Image source={which === 'big' ? SAMPLE_BACK : SAMPLE_FRONT} style={[size, { width: size.width, height: size.height }]} resizeMode="cover" />
  );
  const last = step === steps - 1;
  const next = () => (last ? onDone(false) : setStep(step + 1));
  const blocked = step === 1 && !joinedLab;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      <View style={st.dots}>
        {Array.from({ length: steps }, (_, i) => (
          <View key={i} style={[st.dot, { backgroundColor: i <= step ? c.primary : c.surfaceContainerHigh, width: i === step ? 28 : 8 }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <>
            <Text style={[T.displayMedium, { color: c.onSurface }]}>Hoi @{name}</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 10 }]}>Zo werkt HourSnap.</Text>
            {(
              [
                ['clock-outline', 'Elk uur', 'In de uren die jij kiest, krijg je een seintje om te tonen wat je aan het doen bent.'],
                ['camera-flip-outline', 'Twee camera\'s', 'Eén foto van wat je ziet, dan snel een selfie. Samen zijn ze één snap.'],
                ['hand-okay', 'Nooit verplicht', 'Sla gerust een uur over. Snap extra als er iets leuks gebeurt.'],
                ['timer-sand', 'Weg na 24 uur', 'Snaps verdwijnen na een dag, tenzij iemand ze bewaart. Gemene dingen kun je melden.'],
              ] as const
            ).map(([icon, title, text]) => (
              <View key={title} style={[st.point, { backgroundColor: c.surfaceContainerLow }]}>
                <View style={[st.pointIcon, { backgroundColor: c.secondaryContainer }]}>
                  <Icon name={icon} size={24} color={c.onSecondaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.titleMedium, { color: c.onSurface }]}>{title}</Text>
                  <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>{text}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Word lid van je school</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 24 }]}>
              Iedereen op HourSnap zit in LAB. Later kun je ook privé-rooms maken met max 5 vrienden.
            </Text>
            <View style={[st.lab, { backgroundColor: joinedLab ? c.secondaryContainer : c.surfaceContainerLow, borderColor: joinedLab ? c.primary : c.outlineVariant }]}>
              <View style={[st.labIcon, { backgroundColor: c.primary }]}>
                <Icon name="school" size={34} color={c.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.headlineSmall, { color: c.onSurface }]}>LAB</Text>
                <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>De schoolgroep. Iedereen kan erbij.</Text>
              </View>
              {joinedLab && <Icon name="check-circle" size={30} color={c.primary} />}
            </View>
            {!joinedLab && <Button title="Word lid van LAB" icon="account-plus" big busy={busy} onPress={() => run(onJoinLab)} style={{ marginTop: 16 }} />}
            {joinedLab && <Text style={[T.titleMedium, { color: c.primary, marginTop: 14, textAlign: 'center' }]}>Je zit in LAB 🎉</Text>}
            {!!err && <Text style={[T.bodyMedium, { color: c.error, marginTop: 12 }]}>{err}</Text>}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Profielfoto</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 28 }]}>Zodat vrienden weten dat jij het bent. Je kunt dit overslaan en later toevoegen bij Ik.</Text>
            <Pressable onPress={() => run(onPickAvatar)} accessibilityLabel="Kies een profielfoto" style={{ alignSelf: 'center' }}>
              <Avatar id={meId} name={name} size={148} photo={avatarId} />
              <View style={[st.camBadge, { backgroundColor: c.primary, borderColor: c.surface }]}>
                <Icon name={avatarId ? 'pencil' : 'camera-plus'} size={22} color={c.onPrimary} />
              </View>
            </Pressable>
            <Text style={[T.titleLarge, { color: c.onSurface, textAlign: 'center', marginTop: 16 }]}>@{name}</Text>
            <Button title={avatarId ? 'Andere foto kiezen' : 'Kies een foto'} icon="image-outline" variant="tonal" busy={busy} onPress={() => run(onPickAvatar)} style={{ marginTop: 20, alignSelf: 'center' }} />
            {!!err && <Text style={[T.bodyMedium, { color: c.error, marginTop: 12, textAlign: 'center' }]}>{err}</Text>}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Maak het van jou</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 24 }]}>Licht of donker, en jouw kleur. Je kunt dit later veranderen bij Ik.</Text>
            <ButtonGroup<Appearance>
              items={[
                { key: 'auto', label: 'Gsm' },
                { key: 'light', label: 'Licht' },
                { key: 'dark', label: 'Donker' },
              ]}
              value={appearance}
              onChange={onAppearance}
            />
            <View style={st.colours}>
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
                    accessibilityLabel={`Kleur ${ACCENTS[k].name}`}
                    accessibilityState={{ selected: on }}
                    style={st.colourItem}
                  >
                    <View style={[st.swatch, { backgroundColor: col, borderColor: on ? c.onSurface : 'transparent', borderRadius: on ? S.lg : 32 }]}>
                      {on && <Icon name="check" size={24} color={c.dark ? '#0E1322' : '#FFFFFF'} />}
                    </View>
                    <Text style={[T.labelMedium, { color: on ? c.onSurface : c.onSurfaceVariant, fontFamily: on ? FONTS.xb : FONTS.sb }]}>{ACCENTS[k].name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[st.previewBar, { backgroundColor: c.surfaceContainerLow }]}>
              <View style={[st.previewBtn, { backgroundColor: c.primary }]}>
                <Icon name="camera-iris" size={22} color={c.onPrimary} />
              </View>
              <Text style={[T.titleMedium, { color: c.onSurface, flex: 1 }]}>Dit is je snapknop</Text>
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Je fotostijl</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 20 }]}>Zo zien je snaps eruit voor iedereen.</Text>
            <View style={st.styles}>
              {PHOTO_STYLES.map((p) => {
                const on = p.key === photoStyle;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      haptic();
                      onPhotoStyle(p.key);
                    }}
                    accessibilityLabel={p.name}
                    accessibilityState={{ selected: on }}
                    style={[st.styleCard, { backgroundColor: on ? c.secondaryContainer : c.surfaceContainerHigh, borderColor: on ? c.primary : 'transparent' }]}
                  >
                    <View style={st.styleArt} pointerEvents="none">
                      <Print style={p.key} width={118} id={p.key} date={new Date()} hour={new Date().getHours()} caption={p.key === 'tape' ? 'Hoi!' : null} image={sample(118)} />
                    </View>
                    <View style={st.styleText}>
                      <Text style={[T.titleSmall, { color: c.onSurface, flex: 1 }]}>{p.name}</Text>
                      {on && <Icon name="check-circle" size={20} color={c.primary} />}
                    </View>
                    <Text style={[T.bodySmall, { color: c.onSurfaceVariant }]} numberOfLines={2}>
                      {p.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Wanneer kun je snappen?</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 20 }]}>
              Kies de uren die voor jou werken. Geen gsm in de klas? Begin dan na school. Je streak telt alleen deze uren.
            </Text>
            <HoursCard icon="school-outline" title="Schooldagen" hint="Maandag tot vrijdag" w={schedule.weekday} onChange={(w) => onSchedule({ ...schedule, weekday: w })} />
            <HoursCard icon="sofa-outline" title="Weekend" hint="Zaterdag en zondag" w={schedule.weekend} onChange={(w) => onSchedule({ ...schedule, weekend: w })} />
            <HoursCard icon="beach" title="Vakantie" hint="Zet 'Ik heb vakantie' aan bij Ik" w={schedule.holiday} onChange={(w) => onSchedule({ ...schedule, holiday: w })} />
          </>
        )}

        {step === 6 && remindersSupported && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface }]}>Elk uur een seintje?</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, marginTop: 8, marginBottom: 24 }]}>
              HourSnap kan je aan het begin van elk gekozen uur een seintje geven. Snappen blijft vrijblijvend, en je kunt het veranderen bij Ik.
            </Text>
            <View style={[st.notif, { backgroundColor: c.surfaceContainerLow }]}>
              <View style={[st.notifIcon, { backgroundColor: c.primary }]}>
                <Icon name="camera-iris" size={18} color={c.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.titleSmall, { color: c.onSurface }]}>📸 HourSnap-tijd</Text>
                <Text style={[T.bodyMedium, { color: c.onSurfaceVariant }]}>Wat ben je nu aan het doen?</Text>
              </View>
              <Text style={[T.bodySmall, { color: c.onSurfaceVariant }]}>nu</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={st.footer}>
        {step > 0 ? <Button title="Terug" variant="text" onPress={() => setStep(step - 1)} /> : <View />}
        {last && remindersSupported ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Niet nu" variant="text" onPress={() => onDone(false)} />
            <Button title="Aanzetten" icon="bell-ring-outline" big onPress={() => onDone(true)} />
          </View>
        ) : (
          <Button title={last ? 'Begin met snappen' : step === 2 && !avatarId ? 'Overslaan' : 'Verder'} icon={last ? 'camera-iris' : 'arrow-right'} big onPress={blocked ? undefined : next} style={blocked ? { opacity: 0.35 } : undefined} />
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  lab: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: S.xl, borderWidth: 2 },
  labIcon: { width: 64, height: 64, borderRadius: S.lg, alignItems: 'center', justifyContent: 'center' },
  camBadge: { position: 'absolute', right: 2, bottom: 2, width: 46, height: 46, borderRadius: 23, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 8 },
  dot: { height: 8, borderRadius: 4 },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: S.lgInc, marginTop: 12 },
  pointIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  colours: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  colourItem: { alignItems: 'center', gap: 8 },
  swatch: { width: 56, height: 56, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: S.full, marginTop: 32 },
  previewBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  styleCard: { width: '47.5%', borderRadius: S.lgInc, borderWidth: 2.5, padding: 12, paddingBottom: 14 },
  styleArt: { height: 250, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  styleText: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  hours: { padding: 14, borderRadius: S.lgInc, marginBottom: 12 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 6 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: S.lgInc },
  notifIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
