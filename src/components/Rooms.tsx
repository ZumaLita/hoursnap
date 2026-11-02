import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Icon, Press } from './ui';
import { S, T, useTheme } from '../theme';
import { MAX_ROOM, createRoom, leaveRoom, niceError, searchPeople, updateRoom, type Group, type Me, type Member } from '../api';

/** The row of groups at the top of the feed: LAB, your rooms, and + Room. */
export function GroupBar({
  groups,
  value,
  onChange,
  onNew,
  onEdit,
}: {
  groups: Group[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
  onEdit: (g: Group) => void;
}) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.bar} style={{ marginHorizontal: -20 }}>
      {groups.map((g) => {
        const on = g.$id === value;
        return (
          <Press
            key={g.$id}
            onPress={() => (on && g.kind === 'room' ? onEdit(g) : onChange(g.$id))}
            radius={S.lg}
            squish={0.94}
            accessibilityState={{ selected: on }}
            accessibilityLabel={g.kind === 'lab' ? 'LAB schoolgroep' : `Room ${g.name}`}
            style={[st.tab, { backgroundColor: on ? c.primary : c.surfaceContainerLow, borderColor: on ? c.primary : c.outlineVariant }]}
          >
            <Icon name={g.kind === 'lab' ? 'school' : 'lock'} size={18} color={on ? c.onPrimary : c.onSurfaceVariant} />
            <Text style={[T.titleSmall, { color: on ? c.onPrimary : c.onSurface }]} numberOfLines={1}>
              {g.name}
            </Text>
            {g.kind === 'room' && <Text style={[T.labelMedium, { color: on ? c.onPrimary : c.onSurfaceVariant, opacity: 0.8 }]}>{g.members.length}</Text>}
            {on && g.kind === 'room' && <Icon name="cog-outline" size={16} color={c.onPrimary} />}
          </Press>
        );
      })}
      <Press onPress={onNew} radius={S.lg} squish={0.94} accessibilityLabel="Maak een privé-room" style={[st.tab, st.add, { borderColor: c.outline }]}>
        <Icon name="plus" size={18} color={c.onSurface} />
        <Text style={[T.titleSmall, { color: c.onSurface }]}>Room</Text>
      </Press>
    </ScrollView>
  );
}

/** Make a private room (max 5 people) or change one: search people by @username. */
export function RoomSheet({
  me,
  room,
  members,
  open,
  onClose,
  onSaved,
}: {
  me: Me;
  room: Group | null;
  members: Member[];
  open: boolean;
  onClose: () => void;
  onSaved: (g: Group | null) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const owner = !room || room.ownerId === me.id;
  const [name, setName] = useState(room?.name ?? '');
  const [picked, setPicked] = useState<string[]>(room ? room.members.filter((m) => m !== me.id) : []);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const known = useRef(new Map<string, Member>());
  members.forEach((m) => known.current.set(m.id, m));
  found.forEach((m) => known.current.set(m.id, m));

  useEffect(() => {
    if (!q.trim()) return setFound([]);
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchPeople(q, me.id)
        .then((r) => alive && setFound(r))
        .catch(() => alive && setFound([]))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, me.id]);

  const full = picked.length + 1 >= MAX_ROOM;
  const toggle = (id: string) => {
    setError('');
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length + 1 >= MAX_ROOM ? p : [...p, id]));
  };

  const save = async () => {
    if (name.trim().length < 2) return setError('Geef je room een naam.');
    setBusy(true);
    setError('');
    try {
      const ids = [me.id, ...picked];
      const g = room ? await updateRoom(room.$id, { name: name.trim(), memberIds: ids }) : await createRoom(name.trim(), ids);
      onSaved(g);
    } catch (e) {
      setError(niceError(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!room) return;
    if (Platform.OS === 'web' && !window.confirm(`${room.name} verlaten?`)) return;
    setBusy(true);
    try {
      await leaveRoom(room.$id);
      onSaved(null);
    } catch (e) {
      setError(niceError(e));
    } finally {
      setBusy(false);
    }
  };

  const person = (id: string) => known.current.get(id);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Sluiten" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.sheetWrap} pointerEvents="box-none">
        <View style={[st.sheet, { backgroundColor: c.surfaceContainerLow, paddingBottom: insets.bottom + 16 }]}>
          <View style={[st.handle, { backgroundColor: c.outlineVariant }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="lock" size={22} color={c.primary} />
              <Text style={[T.headlineSmall, { color: c.onSurface, flex: 1 }]}>{room ? (owner ? 'Jouw room' : room.name) : 'Nieuwe privé-room'}</Text>
            </View>
            <Text style={[T.bodyMedium, { color: c.onSurfaceVariant, marginTop: 4 }]}>
              Alleen wie erin zit, ziet wat je hier post. Max {MAX_ROOM} mensen.
            </Text>

            {owner && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Naam van de room, zoals Beste vrienden"
                placeholderTextColor={c.outline}
                maxLength={40}
                style={[st.input, T.titleMedium, { color: c.onSurface, borderColor: c.outlineVariant, backgroundColor: c.surface }]}
              />
            )}

            <Text style={[T.labelLarge, { color: c.onSurfaceVariant, marginTop: 18, marginBottom: 8 }]}>
              Mensen · {picked.length + 1}/{MAX_ROOM}
            </Text>
            <View style={st.chips}>
              <View style={[st.chip, { backgroundColor: c.secondaryContainer }]}>
                <Avatar id={me.id} name={me.name} size={26} />
                <Text style={[T.labelLarge, { color: c.onSecondaryContainer }]}>Jij</Text>
              </View>
              {picked.map((id) => (
                <Press key={id} onPress={owner ? () => toggle(id) : undefined} radius={S.full} accessibilityLabel={`${person(id)?.username ?? ''} verwijderen`} style={[st.chip, { backgroundColor: c.secondaryContainer }]}>
                  <Avatar id={id} name={person(id)?.username ?? '?'} size={26} />
                  <Text style={[T.labelLarge, { color: c.onSecondaryContainer }]}>@{person(id)?.username ?? '…'}</Text>
                  {owner && <Icon name="close" size={16} color={c.onSecondaryContainer} />}
                </Press>
              ))}
            </View>

            {owner && (
              <>
                <View style={[st.search, { borderColor: c.outlineVariant, backgroundColor: c.surface }]}>
                  <Icon name="magnify" size={22} color={c.onSurfaceVariant} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder={full ? 'Room is vol' : 'Zoek @gebruikersnaam'}
                    placeholderTextColor={c.outline}
                    editable={!full}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[T.bodyLarge, { flex: 1, color: c.onSurface, height: 48, outlineStyle: 'none' } as never]}
                  />
                  {searching && <ActivityIndicator color={c.primary} />}
                </View>
                {found.map((m) => {
                  const on = picked.includes(m.id);
                  return (
                    <Press key={m.id} onPress={() => toggle(m.id)} disabled={!on && full} radius={S.lg} squish={0.97} style={[st.result, { opacity: !on && full ? 0.4 : 1 }]}>
                      <Avatar id={m.id} name={m.username} size={36} photo={m.avatarId} />
                      <Text style={[T.titleMedium, { color: c.onSurface, flex: 1 }]}>@{m.username}</Text>
                      <Icon name={on ? 'check-circle' : 'plus-circle-outline'} size={26} color={on ? c.primary : c.onSurfaceVariant} />
                    </Press>
                  );
                })}
                {!!q.trim() && !searching && !found.length && <Text style={[T.bodyMedium, { color: c.onSurfaceVariant, marginTop: 10 }]}>Nog niemand met die gebruikersnaam.</Text>}
              </>
            )}

            {!!error && <Text style={[T.bodyMedium, { color: c.error, marginTop: 12 }]}>{error}</Text>}
          </ScrollView>

          <View style={{ gap: 6, marginTop: 8 }}>
            {owner && <Button title={room ? 'Room opslaan' : 'Room maken'} icon="check" big busy={busy} onPress={save} />}
            {room && <Button title="Room verlaten" variant="text" onPress={leave} />}
            {!room && <Button title="Annuleren" variant="text" onPress={onClose} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  bar: { paddingHorizontal: 20, gap: 8, paddingTop: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44, paddingHorizontal: 14, borderWidth: 1.5, maxWidth: 220 },
  add: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', maxWidth: 560, width: '100%', alignSelf: 'center', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  input: { height: 54, borderRadius: S.lg, borderWidth: 1.5, paddingHorizontal: 16, marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 5, paddingRight: 12, borderRadius: 18 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: S.lg, paddingHorizontal: 12, marginTop: 16 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, marginTop: 4 },
});
