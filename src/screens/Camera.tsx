import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Icon, Press } from '../components/ui';
import { T, useTheme } from '../theme';
import { niceError, postSnap, type Me } from '../api';
import { OnceMark } from '../components/ViewOnce';

type Step = 'back' | 'front' | 'review' | 'posting';

async function shrink(uri: string, width: number) {
  try {
    const ctx = ImageManipulator.manipulate(uri).resize({ width });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.62, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

export function Camera({
  me,
  onTime,
  photoStyle,
  onClose,
  onPosted,
}: {
  me: Me;
  onTime: boolean;
  photoStyle: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const c = useTheme();
  const styles = React.useMemo(() => mk(c), [c]);
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const ready = useRef<(() => void) | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [step, setStep] = useState<Step>('back');
  const [back, setBack] = useState<string | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [caption, setCaption] = useState('');
  const [once, setOnce] = useState(false);
  const [error, setError] = useState('');
  const [kb, setKb] = useState(0);

  // Keep the caption and send button above the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const waitReady = () =>
    new Promise<void>((res) => {
      ready.current = res;
      setTimeout(res, 1600);
    });

  const shoot = async () => {
    if (!cam.current || step !== 'back') return;
    setError('');
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const b = await cam.current.takePictureAsync({ quality: 0.8 });
      setBack(b.uri);
      setStep('front');
      const waiting = waitReady();
      setFacing('front');
      await waiting;
      await new Promise((r) => setTimeout(r, 350));
      const f = await cam.current!.takePictureAsync({ quality: 0.8 });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const [bs, fs] = await Promise.all([shrink(b.uri, 1080), shrink(f.uri, 720)]);
      setBack(bs);
      setFront(fs);
      setStep('review');
    } catch (e) {
      setError(niceError(e));
      retake();
    }
  };

  const retake = () => {
    setBack(null);
    setFront(null);
    setFacing('back');
    setSwapped(false);
    setStep('back');
  };

  const post = async () => {
    if (!back || !front) return;
    setStep('posting');
    setError('');
    try {
      await postSnap(me, back, front, caption, onTime, photoStyle, once);
      onPosted();
    } catch (e) {
      setError(niceError(e));
      setStep('review');
    }
  };

  if (!perm) return <View style={styles.black} />;

  if (!perm.granted)
    return (
      <View style={[styles.black, styles.center, { padding: 32 }]}>
        <Icon name="camera-outline" size={56} color="rgba(235,235,245,0.6)" />
        <Text style={[T.headlineSmall, { color: '#FFFFFF', textAlign: 'center', marginTop: 16 }]}>Camera access</Text>
        <Text style={[T.bodyLarge, { color: 'rgba(235,235,245,0.6)', textAlign: 'center', marginTop: 8 }]}>
          HourSnap takes one photo with the back camera and one with the front.
        </Text>
        <Button title="Allow camera" big onPress={requestPerm} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        <Button title="Not now" variant="text" onPress={onClose} style={{ marginTop: 6, alignSelf: 'stretch' }} />
      </View>
    );

  const reviewing = step === 'review' || step === 'posting';
  const big = swapped ? front : back;
  const small = swapped ? back : front;
  const label = step === 'back' ? 'Back camera' : step === 'front' ? 'Now smile' : onTime ? 'On time' : 'Extra snap';

  return (
    <View style={[styles.black, { paddingBottom: kb }]}>
        <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
          <Press onPress={onClose} radius={22} accessibilityLabel="Close" style={styles.circle}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </Press>
          <View style={[styles.mode, step === 'front' && { backgroundColor: '#FFD60A' }]}>
            <Text style={[T.labelMedium, { color: step === 'front' ? '#000' : '#FFD60A', letterSpacing: 0.5 }]}>{label}</Text>
          </View>
          {reviewing ? (
            <Press onPress={retake} radius={22} accessibilityLabel="Retake" style={styles.circle}>
              <Icon name="camera-retake-outline" size={22} color="#FFFFFF" />
            </Press>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <View style={styles.frame}>
          {!reviewing ? (
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mirror={facing === 'front'}
              animateShutter={false}
              onCameraReady={() => {
                ready.current?.();
                ready.current = null;
              }}
            />
          ) : (
            big && <Image source={{ uri: big }} style={StyleSheet.absoluteFill} />
          )}

          {(back && step === 'front') || reviewing ? (
            <Pressable style={styles.inset} onPress={() => reviewing && setSwapped((x) => !x)} accessibilityLabel="Swap photos">
              {reviewing ? small && <Image source={{ uri: small }} style={StyleSheet.absoluteFill} /> : back && <Image source={{ uri: back }} style={StyleSheet.absoluteFill} />}
            </Pressable>
          ) : null}

          {step === 'front' && (
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" size="large" />
            </View>
          )}
        </View>

        <View style={[styles.bottom, { paddingBottom: kb ? 10 : insets.bottom + 16 }]}>
          {!!error && <Text style={[T.bodyMedium, { color: '#FF8A80', textAlign: 'center' }]}>{error}</Text>}
          {!reviewing ? (
            <Press onPress={shoot} disabled={step !== 'back'} squish={0.88} morph={24} radius={39} accessibilityLabel="Take snap" style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Press>
          ) : (
            <>
              <View style={styles.sendRow}>
                <Press
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setOnce((o) => !o);
                  }}
                  radius={28}
                  squish={0.85}
                  accessibilityLabel={once ? 'View once is on' : 'View once is off'}
                  accessibilityState={{ selected: once }}
                  style={[styles.once, once && { backgroundColor: 'rgba(255,214,10,0.18)' }]}
                >
                  <OnceMark size={30} color={once ? '#FFD60A' : '#FFFFFF'} filled={once} />
                </Press>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption"
                  placeholderTextColor="rgba(235,235,245,0.45)"
                  maxLength={140}
                  returnKeyType="send"
                  onSubmitEditing={post}
                  style={[styles.caption, T.bodyLarge]}
                />
                <Press
                  onPress={step === 'posting' ? undefined : post}
                  radius={28}
                  squish={0.88}
                  accessibilityLabel="Send snap"
                  style={[styles.send, { backgroundColor: c.primary }]}
                >
                  {step === 'posting' ? <ActivityIndicator color={c.onPrimary} /> : <Icon name="send" size={24} color={c.onPrimary} />}
                </Press>
              </View>
              {once ? (
                <Text style={[T.bodySmall, { color: '#FFD60A', textAlign: 'center' }]}>View once: everyone can open it one time. Not in memories.</Text>
              ) : (
                !kb && <Text style={[T.bodySmall, { color: 'rgba(235,235,245,0.55)' }]}>Tap 1 for view once · tap the small photo to swap</Text>
              )}
            </>
          )}
        </View>
    </View>
  );
}

const mk = (c: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(118,118,128,0.3)', alignItems: 'center', justifyContent: 'center' },
  mode: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(118,118,128,0.3)' },
  frame: { flex: 1, marginHorizontal: 12, borderRadius: 28, overflow: 'hidden', backgroundColor: '#1C1C1E', maxWidth: 540, width: '94%', alignSelf: 'center' },
  inset: { position: 'absolute', top: 14, left: 14, width: 104, height: 138, borderRadius: 14, overflow: 'hidden', borderWidth: 2.5, borderColor: '#FFFFFF', backgroundColor: '#2C2C2E' },
  bottom: { paddingTop: 14, paddingHorizontal: 16, alignItems: 'center', gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: c.primaryContainer },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  caption: { flex: 1, height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: 'rgba(118,118,128,0.28)', color: '#FFFFFF' },
  once: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(118,118,128,0.28)' },
  send: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
