import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Brand, Button, Choice, Field, Heading, Icon, Notice, Screen, Toggle, Txt } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useResource';
import type { StackProps } from '../navigation/types';
import { api } from '../services/api';
import { colors, fonts, styles } from '../styles/theme';
import type { PayerRole, Role } from '../types';
import { emailValid, passwordError, roles, signupPayload, titleCase } from '../utils/wallet';

export function LoginScreen({ navigation, route }: StackProps<'Login'>) {
  const [role, setRole] = useState<Role>(route.params?.role && roles.includes(route.params.role) ? route.params.role : 'student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const auth = useAuth();
  const action = useAction();
  useFocusEffect(useCallback(() => { auth.setRecovery({ email: '', role, token: '' }); }, [role]));
  useEffect(() => { if (route.params?.role && roles.includes(route.params.role)) setRole(route.params.role); }, [route.params?.role]);
  const submit = () => action.run(async () => {
    if (!emailValid(email) || !password) throw new Error('Enter your email address and password.');
    await auth.login(email, password, role, remember);
  });
  return <Screen><View style={{ paddingTop: 16, gap: 22 }}><Brand />
    <View style={styles.section}><Txt style={styles.title}>Sign In</Txt>
      <Choice label="Account type" value={role} onChange={setRole} options={roles.map(value => ({ label: titleCase(value), value }))} />
    </View>
    <Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="username" editable={!action.busy} />
    <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" editable={!action.busy} onSubmitEditing={submit} />
    <Toggle label="Remember me" value={remember} onChange={setRemember} />
    <Notice message={action.error} />
    <Button label="Sign In" icon="log-in" busy={action.busy} onPress={submit} />
    <Button label="Forgot Password?" tone="secondary" onPress={() => navigation.navigate('Forgot', { role })} />
    {['student', 'customer'].includes(role) && <Button label="Create Account" tone="secondary" icon="user-plus" onPress={() => navigation.navigate('Register', { role: role as PayerRole })} />}
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, gap: 8 }}><Icon name="shield" color={colors.cyan} size={28} /><Heading>Secure Campus Payments</Heading><Txt style={styles.muted}>Campus Wallet</Txt></View>
  </View></Screen>;
}

export function RegisterScreen({ navigation, route }: StackProps<'Register'>) {
  const [role, setRole] = useState<PayerRole>(route.params?.role || 'student');
  const [form, setForm] = useState({ name: '', email: '', identity: '', password: '', confirmPassword: '' });
  const action = useAction();
  const change = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));
  const submit = () => action.run(async () => {
    await api.signup(signupPayload(form, role));
    if (route.params?.adminHandoff) {
      setForm({ name: '', email: '', identity: '', password: '', confirmPassword: '' });
      action.setMessage('Account created successfully.');
    } else navigation.popTo('Login', { role });
  });
  return <Screen><Brand /><Heading>Create Account</Heading>
    <Field label="Full Name" value={form.name} onChangeText={value => change('name', value)} autoCapitalize="words" autoComplete="name" editable={!action.busy} />
    <Field label="Email Address" value={form.email} onChangeText={value => change('email', value)} keyboardType="email-address" autoComplete="email" editable={!action.busy} />
    <Choice label="Account Type" value={role} onChange={value => { setRole(value); change('identity', ''); }} options={[{ label: 'Student', value: 'student' }, { label: 'Customer', value: 'customer' }]} />
    <Field label={role === 'student' ? 'Student ID' : 'Samagra ID'} value={form.identity} onChangeText={value => change('identity', value)} editable={!action.busy} />
    <Field label="Password" value={form.password} onChangeText={value => change('password', value)} secureTextEntry autoComplete="new-password" editable={!action.busy} />
    <Field label="Confirm Password" value={form.confirmPassword} onChangeText={value => change('confirmPassword', value)} secureTextEntry autoComplete="new-password" editable={!action.busy} />
    <Notice message={action.error} /><Notice message={action.message} success />
    <Button label="Create Account" busy={action.busy} icon="user-plus" onPress={submit} />
    <Button label={route.params?.adminHandoff ? 'Back' : 'Sign In'} tone="secondary" onPress={() => route.params?.adminHandoff ? navigation.goBack() : navigation.popTo('Login', { role })} />
  </Screen>;
}

export function ForgotScreen({ navigation, route }: StackProps<'Forgot'>) {
  const [email, setEmail] = useState('');
  const auth = useAuth();
  const action = useAction();
  const submit = () => action.run(async () => {
    if (!emailValid(email)) throw new Error('Enter a valid email address.');
    const normalizedEmail = email.trim().toLowerCase();
    await api.forgotPassword(normalizedEmail);
    auth.setRecovery({ email: normalizedEmail, role: route.params.role, token: '' });
    navigation.navigate('VerifyOTP');
  });
  return <Screen><Brand /><Heading>Forgot Password?</Heading><Field label="Email Address" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!action.busy} /><Notice message={action.error} /><Button label="Send Reset Code" icon="mail" busy={action.busy} onPress={submit} /></Screen>;
}

export function VerifyOTPScreen({ navigation }: StackProps<'VerifyOTP'>) {
  const { recovery, setRecovery } = useAuth();
  const [otp, setOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(Date.now() + 300000);
  const [remaining, setRemaining] = useState(300);
  const inputRef = useRef<TextInput>(null);
  const action = useAction();
  useEffect(() => { const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 1000); return () => clearInterval(timer); }, [expiresAt]);
  const submit = () => action.run(async () => {
    if (!/^\d{6}$/.test(otp)) throw new Error('Enter all six digits.');
    const data = await api.verifyOtp(recovery.email, otp);
    if (!data.resetToken) throw new Error('Verification did not return authorization. Request a new code.');
    setRecovery({ ...recovery, token: data.resetToken });
    navigation.replace('ResetPassword');
  });
  const resend = () => action.run(async () => {
    if (remaining > 0) return;
    await api.forgotPassword(recovery.email);
    setOtp(''); setExpiresAt(Date.now() + 300000); setRemaining(300);
    action.setMessage('New OTP sent to your email.'); inputRef.current?.focus();
  });
  if (!recovery.email) return <Screen><Notice message="Please request a reset code first." /><Button label="Send Reset Code" onPress={() => navigation.replace('Forgot', { role: recovery.role })} /></Screen>;
  return <Screen><Brand /><Heading>Verify Code</Heading><Txt>We sent a 6-digit code to {recovery.email}</Txt>
    <Field label="Verification Code" value={otp} onChangeText={value => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp" style={{ fontFamily: fonts.semibold, fontSize: 28, textAlign: 'center' }} editable={!action.busy} />
    <Notice message={action.error} /><Notice message={action.message} success />
    <Button label="Verify Code" icon="check-circle" busy={action.busy} disabled={remaining === 0} onPress={submit} />
    <Txt style={styles.muted}>{remaining ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Code expired.'}</Txt>
    <Button label="Resend OTP" tone="secondary" disabled={remaining > 0} busy={action.busy} onPress={resend} />
    <Button label="Back to Login" tone="secondary" onPress={() => navigation.popTo('Login', { role: recovery.role })} />
  </Screen>;
}

export function ResetPasswordScreen({ navigation }: StackProps<'ResetPassword'>) {
  const { recovery, setRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const action = useAction();
  const submit = () => action.run(async () => {
    const error = passwordError(password, confirmation);
    if (error) throw new Error(error);
    await api.resetPassword(recovery.email, password, recovery.token);
    const role = recovery.role;
    setRecovery({ email: '', role, token: '' });
    navigation.popTo('Login', { role });
  });
  if (!recovery.token) return <Screen><Notice message="Password reset authorization is missing or expired." /><Button label="Request New Code" onPress={() => navigation.replace('Forgot', { role: recovery.role })} /></Screen>;
  return <Screen><Brand /><Heading>Reset Password</Heading><Field label="New Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!action.busy} /><Field label="Confirm Password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!action.busy} /><Notice message={action.error} /><Button label="Reset Password" busy={action.busy} icon="lock" onPress={submit} /></Screen>;
}

export function AccessDeniedScreen({ navigation }: StackProps<'AccessDenied'>) {
  return <Screen><Icon name="shield" size={48} /><Heading>Access Denied</Heading><Notice message="This account does not have access to this section." /><Button label="Go Back" onPress={() => navigation.goBack()} /></Screen>;
}