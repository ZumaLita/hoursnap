import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon } from '../components/ui';
import { FONTS, S, T, useStyles, useTheme, type Theme } from '../theme';
import { PIN_LENGTH, validPhone } from '../config';
import { NumberTaken, currentUser, login, niceError, setUsername, cleanUsername, signup, type Me } from '../api';

type Step = 'phone' | 'pin' | 'confirm' | 'name';

/** Big PIN boxes that fill as you type. */
function PinBoxes({ value, onChange, onDone, autoFocus }: { value: string; onChange: (v: string) => void; onDone: (v: string) => void; autoFocus?: boolean }) {
  const c = useTheme();
  const ref = useRef<React.ElementRef<typeof TextInput>>(null);
  return (
    <View>
      <View style={st.pinRow} onTouchEnd={() => ref.current?.focus()}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < value.length;
          const active = i === value.length;
          return (
            <View key={i} style={[st.pinBox, { backgroundColor: c.surfaceContainerLow, borderColor: active ? c.primary : filled ? c.outline : c.outlineVariant }]}>
              {filled && <View style={[st.pinDot, { backgroundColor: c.onSurface }]} />}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, PIN_LENGTH);
          onChange(v);
          if (v.length === PIN_LENGTH) setTimeout(() => onDone(v), 120);
        }}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        style={st.hiddenInput}
        accessibilityLabel="Pincode"
      />
    </View>
  );
}

export function Login({ onDone, nameFor }: { onDone: (me: Me) => void; nameFor?: Me }) {
  const c = useTheme();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(nameFor ? 'name' : 'phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [name, setName] = useState('');
  const [newMe, setNewMe] = useState<Me | null>(nameFor ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState<'pin' | 'taken' | null>(null);

  const goPin = () => {
    if (!validPhone(phone)) return setError('Typ je volledige gsm-nummer, zoals 0470 12 34 56.');
    setError('');
    setPin('');
    setStep('pin');
  };

  // All 6 digits typed: try to log in. A new number goes straight to "type it again".
  const tryLogin = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      const r = await login(phone, value);
      if (r === 'ok') {
        const me = await currentUser();
        if (me) onDone(me);
      } else {
        setPin2('');
        setMismatch(null);
        setStep('confirm');
      }
    } catch (e) {
      setPin('');
      setError(niceError(e));
    } finally {
      setBusy(false);
    }
  };

  // Second time typed: same PIN makes the account, then asks for a name.
  const confirm = async (value: string) => {
    if (value !== pin) {
      setMismatch('pin');
      setPin2('');
      return;
    }
    setBusy(true);
    setError('');
    setMismatch(null);
    try {
      const me = await signup(phone, pin);
      setNewMe(me);
      setStep('name');
    } catch (e) {
      if (e instanceof NumberTaken) setMismatch('taken');
      else setError(niceError(e));
      setPin2('');
    } finally {
      setBusy(false);
    }
  };

  const changePin = () => {
    setPin('');
    setPin2('');
    setMismatch(null);
    setError('');
    setStep('pin');
  };

  const saveName = async () => {
    if (name.length < 3) return setError('Minstens 3 letters of cijfers.');
    if (!newMe) return;
    setBusy(true);
    setError('');
    try {
      onDone(await setUsername(newMe, name));
    } catch (e) {
      setError(niceError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/logo-mark.png')} style={s.logo} accessibilityLabel="HourSnap logo" />

        {step === 'phone' && (
          <>
            <Text style={[T.displayMedium, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>HourSnap</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 32 }]}>
              Toon je dag, uur per uur.{'\n'}Achtercamera en selfie, samen.
            </Text>
            <Text style={[T.titleMedium, { color: c.onSurface, marginBottom: 8 }]}>Je gsm-nummer</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^\d+ ]/g, ''))}
              placeholder="0470 12 34 56"
              placeholderTextColor={c.outline}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goPin}
              style={s.input}
            />
            <Text style={[T.bodySmall, { color: c.onSurfaceVariant, marginTop: 8 }]}>Alleen om in te loggen. Niemand anders ziet het.</Text>
            {!!error && <Text style={[T.bodyMedium, s.error]}>{error}</Text>}
            <Button title="Verder" icon="arrow-right" big onPress={goPin} style={{ marginTop: 24 }} />
          </>
        )}

        {step === 'pin' && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>Je pincode</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 28 }]}>
              Typ je pincode van {PIN_LENGTH} cijfers.{'\n'}Nieuw? Verzin er nu een.
            </Text>
            <PinBoxes key="pin" value={pin} onChange={setPin} onDone={tryLogin} autoFocus />
            {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} />}
            {!!error && <Text style={[T.bodyMedium, s.error, { textAlign: 'center' }]}>{error}</Text>}
            <Button title="Ander gsm-nummer" variant="text" onPress={() => setStep('phone')} style={{ marginTop: 24 }} />
          </>
        )}

        {step === 'confirm' && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>Nog een keer</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>
              Eerste keer op HourSnap? Typ dezelfde pincode nog eens om je account te maken.
            </Text>
            <View style={[s.warn, { backgroundColor: c.tertiaryContainer }]}>
              <Icon name="safe-square-outline" size={26} color={c.onTertiaryContainer} />
              <Text style={[T.titleSmall, { color: c.onTertiaryContainer, flex: 1, fontFamily: FONTS.b }]}>
                Bewaar je pincode op een veilige plek! Je hebt hem nodig om op een andere gsm in te loggen.
              </Text>
            </View>
            <PinBoxes key="confirm" value={pin2} onChange={(v) => { setPin2(v); if (v) setMismatch(null); }} onDone={confirm} autoFocus />
            {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} />}
            {!!error && <Text style={[T.bodyMedium, s.error, { textAlign: 'center' }]}>{error}</Text>}
            {!mismatch && !busy && (
              <Button
                title="Ik heb al een account"
                variant="text"
                onPress={() => {
                  changePin();
                  setError('Foute pincode voor dit nummer. Probeer opnieuw.');
                }}
                style={{ marginTop: 20 }}
              />
            )}
            {mismatch && (
              <View style={[s.mismatch, { backgroundColor: c.errorContainer }]}>
                <Text style={[T.bodyLarge, { color: c.onErrorContainer, textAlign: 'center' }]}>
                  {mismatch === 'pin' ? 'Dat is niet dezelfde pincode. Probeer opnieuw of kies een nieuwe.' : 'Dit nummer heeft al een account, dus die pincode was fout.'}
                </Text>
                <Button title={mismatch === 'pin' ? 'Pincode wijzigen' : 'Mijn pincode opnieuw proberen'} icon="key-outline" big onPress={changePin} style={{ marginTop: 12, alignSelf: 'stretch' }} />
              </View>
            )}
          </>
        )}

        {step === 'name' && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>Je bent binnen!</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 28 }]}>
              Kies een gebruikersnaam. Vrienden vinden je ermee om je aan hun rooms toe te voegen.
            </Text>
            <View style={[s.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
              <Text style={[T.titleLarge, { color: c.onSurfaceVariant, paddingLeft: 18 }]}>@</Text>
            <TextInput
              value={name}
              onChangeText={(t) => setName(cleanUsername(t))}
              placeholder="gebruikersnaam"
              placeholderTextColor={c.outline}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
              maxLength={20}
              style={[T.titleLarge, { flex: 1, height: '100%', color: c.onSurface, paddingLeft: 2, paddingRight: 18, outlineStyle: 'none' } as never]}
            />
            </View>
            <Text style={[T.bodySmall, { color: c.onSurfaceVariant, marginTop: 8 }]}>Letters, cijfers, puntjes en _. Zoals @lena.v</Text>
            {!!error && <Text style={[T.bodyMedium, s.error]}>{error}</Text>}
            <Button title="Let's go!" icon="arrow-right" big busy={busy} onPress={saveName} style={{ marginTop: 24 }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  pinRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pinBox: { width: 46, height: 58, borderRadius: S.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 14, height: 14, borderRadius: 7 },
  hiddenInput: { position: 'absolute', opacity: 0.01, width: 1, height: 1 },
});

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
    logo: { width: 96, height: 96, alignSelf: 'center', transform: [{ rotate: '-4deg' }] },
    input: { height: 60, borderRadius: S.lg, borderWidth: 2, borderColor: c.outlineVariant, backgroundColor: c.surfaceContainerLow, paddingHorizontal: 18, color: c.onSurface, ...T.titleLarge },
    error: { color: c.error, marginTop: 12 },
    mismatch: { padding: 16, borderRadius: S.xl, marginTop: 20 },
    warn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: S.lgInc, marginBottom: 24 },
  });
