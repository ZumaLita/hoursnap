import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon } from '../components/ui';
import { FONTS, S, T, useStyles, useTheme, type Theme } from '../theme';
import { PIN_LENGTH } from '../config';
import { currentUser, login, niceError, signup, type Me } from '../api';

type Step = 'name' | 'pin' | 'confirm';

/** Big PIN boxes that fill as you type. */
function PinBoxes({ value, onChange, onDone, autoFocus }: { value: string; onChange: (v: string) => void; onDone: () => void; autoFocus?: boolean }) {
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
          if (v.length === PIN_LENGTH) setTimeout(onDone, 120);
        }}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        style={st.hiddenInput}
        accessibilityLabel="PIN"
      />
    </View>
  );
}

export function Login({ onDone }: { onDone: (me: Me) => void }) {
  const c = useTheme();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const goPin = () => {
    if (name.trim().length < 2) return setError('Type your name (at least 2 letters).');
    setError('');
    setPin('');
    setStep('pin');
  };

  const tryLogin = async () => {
    if (pin.length < PIN_LENGTH) return setError(`Your PIN has ${PIN_LENGTH} digits.`);
    setBusy(true);
    setError('');
    try {
      const r = await login(name, pin);
      if (r === 'ok') {
        const me = await currentUser();
        if (me) onDone(me);
      } else {
        setPin2('');
        setStep('confirm');
      }
    } catch (e) {
      setError(niceError(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (pin2 !== pin) {
      setPin2('');
      return setError("The PINs don't match. Try again.");
    }
    setBusy(true);
    setError('');
    try {
      onDone(await signup(name, pin));
    } catch (e) {
      const msg = niceError(e);
      setError(msg);
      if (/already taken/i.test(msg)) {
        setPin('');
        setStep('pin');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/logo-mark.png')} style={s.logo} accessibilityLabel="HourSnap logo" />

        {step === 'name' && (
          <>
            <Text style={[T.displayMedium, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>HourSnap</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 32 }]}>
              Show your day, one hour at a time.{'\n'}Back camera and selfie, together.
            </Text>
            <Text style={[T.titleMedium, { color: c.onSurface, marginBottom: 8 }]}>What's your name?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={c.outline}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goPin}
              style={s.input}
            />
            <Text style={[T.bodySmall, { color: c.onSurfaceVariant, marginTop: 8 }]}>Two people with the same name? Add your last initial, like "Lena V".</Text>
            {!!error && <Text style={[T.bodyMedium, s.error]}>{error}</Text>}
            <Button title="Next" icon="arrow-right" big onPress={goPin} style={{ marginTop: 24 }} />
          </>
        )}

        {step === 'pin' && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>Hi {name.trim()}</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 28 }]}>
              Type your {PIN_LENGTH}-digit PIN.{'\n'}First time here? Pick a new one.
            </Text>
            <PinBoxes value={pin} onChange={setPin} onDone={tryLogin} autoFocus />
            {!!error && <Text style={[T.bodyMedium, s.error, { textAlign: 'center' }]}>{error}</Text>}
            <Button title="Continue" icon="arrow-right" big busy={busy} onPress={tryLogin} style={{ marginTop: 28 }} />
            <Button title="Not you? Change name" variant="text" onPress={() => setStep('name')} style={{ marginTop: 6 }} />
          </>
        )}

        {step === 'confirm' && (
          <>
            <Text style={[T.headlineLarge, { color: c.onSurface, textAlign: 'center', marginTop: 20 }]}>New here?</Text>
            <Text style={[T.bodyLarge, { color: c.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>
              Type the same PIN again to make your account, {name.trim()}.
            </Text>
            <View style={[s.warn, { backgroundColor: c.tertiaryContainer }]}>
              <Icon name="safe-square-outline" size={26} color={c.onTertiaryContainer} />
              <Text style={[T.titleSmall, { color: c.onTertiaryContainer, flex: 1, fontFamily: FONTS.b }]}>
                Save your PIN somewhere safe! You need it to log in on another phone.
              </Text>
            </View>
            <PinBoxes value={pin2} onChange={setPin2} onDone={create} autoFocus />
            {!!error && <Text style={[T.bodyMedium, s.error, { textAlign: 'center' }]}>{error}</Text>}
            <Button title="Make my account" icon="check" big busy={busy} onPress={create} style={{ marginTop: 28 }} />
            <Button
              title="I already have an account"
              variant="text"
              onPress={() => {
                setPin('');
                setError('Wrong PIN for that name. Try again.');
                setStep('pin');
              }}
              style={{ marginTop: 6 }}
            />
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
    warn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: S.lgInc, marginBottom: 24 },
  });
