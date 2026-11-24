import { Component, useEffect, useRef, type ErrorInfo, type PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Alert, AppState, Linking, Pressable, Text, View } from 'react-native';
import { Camera } from 'expo-camera';
import { getForegroundPermissionsAsync, requestForegroundPermissionsAsync } from 'expo-location';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/styles/theme';
import { requestInitialPermissions } from './src/services/permissions';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function StartupPermissions() {
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    const request = async () => {
      if (started.current || AppState.currentState !== 'active') return;
      started.current = true;
      const unavailable = await requestInitialPermissions([
        { name: 'Camera', get: Camera.getCameraPermissionsAsync, request: Camera.requestCameraPermissionsAsync },
        { name: 'Location', get: getForegroundPermissionsAsync, request: requestForegroundPermissionsAsync },
      ]);
      if (active && unavailable.length) Alert.alert('Permissions Not Enabled', `${unavailable.join(' and ')} access is not enabled. You can update permissions in device settings.`, [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => Alert.alert('Settings Unavailable', 'Open device settings and select Campus Wallet to manage permissions.')); } },
      ]);
    };
    void request();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void request(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  return null;
}

class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { if (__DEV__) console.error(error, info.componentStack); }
  render() {
    if (this.state.failed) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.background }}><Text style={{ fontSize: 22, color: colors.ink }}>Campus Wallet could not continue.</Text><Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={{ minHeight: 48, padding: 16, backgroundColor: colors.primary, borderRadius: 8 }}><Text style={{ color: colors.white }}>Try Again</Text></Pressable></View>;
    return this.props.children;
  }
}

export default function App() {
  const [loaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded && !fontError) return null;
  return <GestureHandlerRootView style={{ flex: 1 }} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}><SafeAreaProvider><StatusBar style="dark" /><ErrorBoundary><StartupPermissions /><AuthProvider><AppNavigator /></AuthProvider></ErrorBoundary></SafeAreaProvider></GestureHandlerRootView>;
}