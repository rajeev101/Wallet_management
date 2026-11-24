import { useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Detail, Notice, Status } from './ui';
import { useAction } from '../hooks/useResource';
import { shareQr } from '../services/exports';
import type { User } from '../types';
import { colors } from '../styles/theme';

export function VendorQr({ vendor, compact = false }: { vendor: User; compact?: boolean }) {
  const svg = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null);
  const { width } = useWindowDimensions();
  const action = useAction();
  const share = () => action.run(async () => {
    if (!svg.current) throw new Error('QR code is not ready.');
    const data = await new Promise<string>(resolve => svg.current!.toDataURL(resolve));
    await shareQr(data, vendor._id);
  });
  return <View style={{ gap: 16 }}><View style={{ alignSelf: 'center', padding: 20, backgroundColor: colors.white, borderRadius: 8 }} accessibilityLabel={`Payment QR for ${vendor.name}`}><QRCode value={vendor._id} size={Math.min(compact ? 160 : 240, width - 96)} color={colors.ink} backgroundColor={colors.white} quietZone={12} getRef={reference => { svg.current = reference; }} /></View>
    {!compact && <><Detail label="Vendor ID" value={vendor._id} /><Detail label="Shop Name" value={vendor.name} /><Detail label="QR Status" value={<Status value={vendor.vendorStatus === 'approved' ? 'active' : 'inactive'} />} /><Button label="Download QR Code" icon="download" tone="secondary" busy={action.busy} onPress={share} /><Notice message={action.error} /></>}
  </View>;
}