import { useRef } from 'react';
import { View } from 'react-native';
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Brand, Button, Icon, IconButton, Loading, Notice, Screen, type IconName } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { useAction } from '../hooks/useResource';
import { AccessDeniedScreen, ForgotScreen, LoginScreen, RegisterScreen, ResetPasswordScreen, VerifyOTPScreen } from '../screens/AuthScreens';
import { AddMoneyScreen } from '../screens/AddMoneyScreen';
import { AnalyticsScreen, WalletHomeScreen } from '../screens/DashboardScreens';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ChangePasswordScreen, EditProfileScreen, ProfileScreen } from '../screens/ProfileScreens';
import { ScanPayScreen } from '../screens/ScanPayScreen';
import { TransactionDetailScreen, TransactionsScreen } from '../screens/TransactionsScreens';
import { colors, fonts } from '../styles/theme';
import { useRootNavigation, type RootStack, type WalletTabs } from './types';

const Stack = createNativeStackNavigator<RootStack>();
const WalletTab = createBottomTabNavigator<WalletTabs>();
const headerStyle = { backgroundColor: colors.white };
const headerTitleStyle = { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink };

function HeaderActions() {
  const { notifications } = useNotifications();
  const navigation = useRootNavigation();
  return <View style={{ flexDirection: 'row', gap: 2, marginRight: 4 }}><IconButton icon="bell" label="Notifications" badge={notifications.length} onPress={() => navigation.navigate('Notifications')} /><IconButton icon="user" label="Your Profile" onPress={() => navigation.navigate('Wallet', { screen: 'Profile' })} /></View>;
}

function WalletNavigator() {
  const { user } = useAuth();
  const icons: Record<keyof WalletTabs, IconName> = { Home: 'home', Scan: 'maximize', Transactions: 'repeat', AddMoney: 'plus-circle', Profile: 'user' };
  return <WalletTab.Navigator backBehavior="history" screenOptions={({ route }) => ({ headerStyle, headerTitleStyle, headerRight: HeaderActions, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10 }, tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line }, tabBarHideOnKeyboard: true, tabBarIcon: ({ color, size }) => <Icon name={icons[route.name]} color={color} size={size} /> })}>
    <WalletTab.Screen name="Home" component={WalletHomeScreen} options={{ title: `${user?.accountType === 'customer' ? 'Customer' : 'Student'} Dashboard`, tabBarLabel: 'Home' }} />
    <WalletTab.Screen name="Scan" component={ScanPayScreen} options={{ title: 'Scan to Pay', tabBarLabel: 'Scan' }} />
    <WalletTab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transaction History', tabBarLabel: 'History' }} />
    <WalletTab.Screen name="AddMoney" component={AddMoneyScreen} options={{ title: 'Add Money Request', tabBarLabel: 'Add Money' }} />
    <WalletTab.Screen name="Profile" component={ProfileScreen} />
  </WalletTab.Navigator>;
}

function Routes() {
  const { user } = useAuth();
  return <Stack.Navigator key={user?._id || 'guest'} screenOptions={{ headerStyle, headerTitleStyle, headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.background }, headerBackButtonDisplayMode: 'minimal' }}>
    {!user ? <Stack.Group><Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Campus Wallet', headerShown: false }} /><Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} /><Stack.Screen name="Forgot" component={ForgotScreen} options={{ title: 'Forgot Password' }} /><Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} options={{ title: 'Verify Code' }} /><Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} /></Stack.Group> : <Stack.Group>
      <Stack.Screen name="Wallet" component={WalletNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction Receipt' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Group>}
    <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} options={{ title: 'Access Denied' }} />
  </Stack.Navigator>;
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.background, card: colors.white, text: colors.ink, border: colors.line, notification: colors.red }, fonts: { regular: { fontFamily: fonts.regular, fontWeight: '400' as const }, medium: { fontFamily: fonts.medium, fontWeight: '500' as const }, bold: { fontFamily: fonts.bold, fontWeight: '700' as const }, heavy: { fontFamily: fonts.bold, fontWeight: '700' as const } } };

export function AppNavigator() {
  const auth = useAuth();
  const action = useAction();
  const navigation = useNavigationContainerRef<RootStack>();
  const pendingNotification = useRef(false);
  const openNotifications = () => {
    if (!auth.user) return;
    pendingNotification.current = true;
    if (navigation.isReady()) { pendingNotification.current = false; navigation.navigate('Notifications'); }
  };
  if (auth.status === 'loading') return <Screen><Brand /><Loading text="Loading your account..." /></Screen>;
  if (auth.status === 'offline') return <Screen><Brand /><Notice message={auth.error} /><Notice message={action.error} /><Button label="Retry Connection" icon="refresh-cw" onPress={auth.restore} /><Button label="Sign Out" tone="secondary" busy={action.busy} onPress={() => action.run(auth.logout)} /></Screen>;
  return <NavigationContainer ref={navigation} onReady={() => { if (pendingNotification.current) openNotifications(); }} theme={theme} linking={{ prefixes: ['campuswallet://'], config: { screens: auth.user ? {} : { Login: 'login', Register: 'register' } } }}>{auth.user ? <NotificationProvider key={auth.user._id} onOpenNotifications={openNotifications}><Routes /></NotificationProvider> : <Routes />}</NavigationContainer>;
}