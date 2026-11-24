import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused, usePreventRemove } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Detail, Field, Heading, Icon, Loading, Notice, Screen, Txt } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useResource';
import { api } from '../services/api';
import { colors, styles } from '../styles/theme';
import type { User } from '../types';
import { money, paymentPayload, validVendorId } from '../utils/wallet';

export function ScanPayScreen() {
  const auth = useAuth();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(true);
  const [foreground, setForeground] = useState(true);
  const [vendor, setVendor] = useState<User | null>(null);
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const scanned = useRef(false);
  const focused = useIsFocused();
  const action = useAction();
  usePreventRemove(action.busy, () => {});
  useFocusEffect(useCallback(() => {
    setForeground(AppState.currentState === 'active');
    const refreshPermission = () => { void getPermission().catch(() => action.setError('Could not check camera access. Please try again.')); };
    refreshPermission();
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') refreshPermission();
    });
    void auth.refreshProfile().catch(() => {});
    return () => subscription.remove();
  }, [getPermission]));
  const reset = () => { setVendor(null); setAmount(''); setSuccess(false); setUncertain(false); scanned.current = false; setCameraActive(true); action.setError(''); };
  const scan = (value: string) => {
    if (scanned.current || action.busy) return;
    scanned.current = true; setCameraActive(false);
    void action.run(async () => {
      if (!validVendorId(value)) throw new Error('Invalid vendor QR code.');
      const data = await api.vendor(value.trim());
      if (!data.vendor) throw new Error('Vendor not found.');
      setVendor(data.vendor);
    });
  };
  const pay = () => action.run(async () => {
    if (!vendor) return;
    const profile = await auth.refreshProfile();
    const payload = paymentPayload(vendor, amount, profile.walletBalance || 0);
    try { await api.pay(payload); }
    catch (failure) {
      setUncertain(true);
      throw new Error(`${failure instanceof Error ? failure.message : 'Payment could not be confirmed.'} Check your transaction history before making another payment.`);
    }
    setSuccess(true); setAmount('');
    await auth.refreshProfile().catch(() => {});
  });
  const openCamera = () => action.run(async () => {
    const current = await getPermission();
    if (!current.granted && !current.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    const result = current.granted ? current : await requestPermission();
    if (result.granted) { scanned.current = false; setCameraActive(true); }
    else throw new Error('Camera permission is required to scan a vendor QR code.');
  });
  return <Screen>
    {success ? <View style={styles.empty}><Icon name="check-circle" color={colors.green} size={64} /><Heading>Payment completed successfully!</Heading><Button label="Done" icon="check" onPress={reset} /></View> : vendor ? <>
      <Heading>Enter Amount</Heading><Detail label="Paying to" value={vendor.name} /><Detail label="Email / Contact" value={vendor.email} /><Detail label="Vendor ID" value={vendor._id} />
      <Field label="Payment Amount (INR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!action.busy && !uncertain} /><Detail label="Your Balance" value={money(auth.user?.walletBalance)} />
      <Notice message={action.error} />{action.busy && <Loading text="Processing Payment..." />}
      {!uncertain && <Button label="Confirm & Pay" icon="check-circle" busy={action.busy} onPress={pay} />}
      <Button label={uncertain ? 'Return to Scanner' : 'Cancel'} tone="secondary" disabled={action.busy} onPress={reset} />
    </> : <>
      <Heading>Scan to Pay</Heading>
      {permission?.granted && cameraActive && focused && foreground ? <View style={{ aspectRatio: 1, overflow: 'hidden', borderRadius: 8, backgroundColor: colors.ink }}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={result => scan(result.data)} onMountError={error => { setCameraActive(false); action.setError(error.message); }} /><View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: '18%', width: '64%', height: '64%', borderWidth: 2, borderRadius: 8, borderColor: colors.white }} /></View> : <View style={[styles.empty, { aspectRatio: 1, backgroundColor: colors.white }]}><Icon name="maximize" size={72} /><Txt style={styles.muted}>Scan Static Vendor QR</Txt></View>}
      <Notice message={action.error} />{action.busy && <Loading text="Verifying vendor..." />}
      <Button label={cameraActive && permission?.granted ? 'Close Camera' : 'Open Camera'} icon={cameraActive && permission?.granted ? 'camera-off' : 'camera'} tone="secondary" disabled={action.busy} onPress={() => cameraActive && permission?.granted ? setCameraActive(false) : openCamera()} />
      {permission && !permission.granted && !permission.canAskAgain && <Button label="Camera Settings" icon="settings" tone="secondary" onPress={() => { void Linking.openSettings().catch(() => action.setError('Open device settings and allow camera access.')); }} />}
    </>}
  </Screen>;
}