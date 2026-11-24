import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Detail, Field, Heading, Notice, ResourceState, Screen, Status, Txt } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useAction, useResource } from '../hooks/useResource';
import { useRootNavigation, type StackProps } from '../navigation/types';
import { api } from '../services/api';
import { styles } from '../styles/theme';
import { dateTime, emailValid, money, passwordError, titleCase, userCode } from '../utils/wallet';

export function ProfileScreen() {
  const auth = useAuth();
  const { pushEnabled, pushBusy, pushError, togglePush } = useNotifications();
  const navigation = useRootNavigation();
  const profile = useResource(auth.refreshProfile);
  const action = useAction();
  const user = auth.user!;
  const logout = () => Alert.alert('Sign Out', 'Sign out of Campus Wallet?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => { void action.run(auth.logout); } }]);
  return <Screen onRefresh={profile.reload} refreshing={profile.loading}><View style={styles.row}><Avatar name={user.name} uri={user.profilePicture} /><View style={styles.fill}><Heading>{user.name}</Heading><Txt style={styles.muted}>{titleCase(user.accountType)}</Txt></View></View>
    <ResourceState loading={false} error={profile.error} onRetry={profile.reload} />
    <Detail label="Full Name" value={user.name} /><Detail label={`${titleCase(user.accountType)} ID`} value={userCode(user)} /><Detail label="Account Type" value={titleCase(user.accountType)} />
    <Detail label="Email" value={user.email} /><Detail label="Phone Number" value={user.phone || 'Not available'} />
    {user.accountType === 'admin' ? <><Detail label="Account Status" value={<Status value={user.accountStatus || 'active'} />} /><Detail label="Join Date" value={dateTime(user.createdAt)} /></> : <Detail label="Wallet Balance" value={money(user.walletBalance)} />}
    {user.accountType === 'vendor' && <Detail label="Account Status" value={<Status value={user.vendorStatus === 'approved' ? 'active' : 'inactive'} />} />}
    <Detail label="Transaction Notifications" value={<Switch accessibilityLabel="Transaction notifications" value={pushEnabled} disabled={pushBusy} onValueChange={enabled => { void togglePush(enabled); }} />} />
    <Notice message={pushError} />
    <Button label="Edit Profile" icon="edit-2" onPress={() => navigation.navigate('EditProfile')} />
    {user.accountType !== 'admin' && <Button label="Change Password" icon="lock" tone="secondary" onPress={() => navigation.navigate('ChangePassword')} />}
    <Notice message={action.error} /><Button label="Sign Out" icon="log-out" tone="danger" busy={action.busy} onPress={logout} />
  </Screen>;
}

export function EditProfileScreen({ navigation }: StackProps<'EditProfile'>) {
  const auth = useAuth();
  const user = auth.user!;
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone || '', photo: user.profilePicture || '' });
  const action = useAction();
  const change = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const choosePhoto = () => action.run(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo access was denied. Allow photo access in your device settings to choose a profile picture.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.55, base64: true });
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image?.base64) throw new Error('Unable to read this photo. Try a different image.');
    if (image.base64.length > 4_000_000) throw new Error('Photo is too large. Choose a smaller image (under 3 MB).');
    change('photo', `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`);
  });
  const submit = () => action.run(async () => {
    if (!form.name.trim()) throw new Error('Name is required.');
    if (user.accountType === 'admin' && !emailValid(form.email)) throw new Error('Enter a valid email address.');
    const data = await api.updateProfile({ name: form.name.trim(), profilePicture: form.photo, ...(user.accountType === 'admin' ? { email: form.email.trim().toLowerCase(), phone: form.phone.trim() } : {}) });
    auth.setUser(data.user);
    navigation.goBack();
  });
  return <Screen><Heading>Edit Profile</Heading><View style={styles.row}><Avatar name={form.name} uri={form.photo} /><View style={{ gap: 10, flex: 1 }}><Button label="Change Photo" icon="image" tone="secondary" busy={action.busy} onPress={choosePhoto} />{Boolean(form.photo) && <Button label="Remove Photo" tone="danger" icon="trash-2" disabled={action.busy} onPress={() => change('photo', '')} />}</View></View>
    <Field label="Full Name" value={form.name} onChangeText={value => change('name', value)} autoCapitalize="words" editable={!action.busy} />
    <Field label="Email Address" value={form.email} onChangeText={value => change('email', value)} keyboardType="email-address" editable={user.accountType === 'admin' && !action.busy} />
    <Field label="Phone Number" value={form.phone} onChangeText={value => change('phone', value)} keyboardType="phone-pad" editable={user.accountType === 'admin' && !action.busy} />
    <Notice message={action.error} /><Button label="Save Changes" icon="save" busy={action.busy} onPress={submit} /><Button label="Cancel" tone="secondary" disabled={action.busy} onPress={() => navigation.goBack()} />
  </Screen>;
}

export function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const action = useAction();
  const submit = () => action.run(async () => {
    if (!current) throw new Error('Current password is required.');
    const error = passwordError(password, confirmation);
    if (error) throw new Error(error);
    const data = await api.changePassword(current, password);
    setCurrent(''); setPassword(''); setConfirmation(''); action.setMessage(data.message || 'Password changed successfully.');
  });
  return <Screen><Heading>Change Password</Heading><Field label="Current Password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" editable={!action.busy} /><Field label="New Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!action.busy} /><Field label="Confirm New Password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!action.busy} /><Notice message={action.error} /><Notice message={action.message} success /><Button label="Change Password" icon="lock" busy={action.busy} onPress={submit} /></Screen>;
}