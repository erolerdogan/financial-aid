import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearAllData } from '@/db/database';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import {
  cancelCurrentMonthReminders,
  requestAndScheduleImportReminders
} from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { activeProfile, setIsDemoMode, refreshProfiles } = useProfile();
  const { isDark, toggleTheme, colors } = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { importStatement, importing } = useStatementImporter({
    showAlert: true,
  });

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset All Data & Profiles',
      'Are you sure you want to delete all profiles, transactions, and settings? This will completely reset the app to a clean state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllData(db);
              if (setIsDemoMode) {
                setIsDemoMode(false);
              }
              await refreshProfiles();
              router.dismissAll();
              router.replace('/welcome');
            } catch (error) {
              console.error('Reset error:', error);
              Alert.alert('Error', 'Failed to clear database.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (value) {
      await requestAndScheduleImportReminders();
      Alert.alert('Notifications Enabled', 'Scheduled reminders for the 1st, 15th, and 28th are active.');
    } else {
      await cancelCurrentMonthReminders();
      Alert.alert('Notifications Disabled', 'All upcoming statement import reminders have been canceled.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>PROFILES</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setProfileModalVisible(true)}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.avatarDot,
                  { backgroundColor: activeProfile?.avatarColor || '#007AFF' },
                ]}
              >
                <Text style={styles.avatarText}>
                  {activeProfile?.name?.substring(0, 1) || 'P'}
                </Text>
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {activeProfile?.name || 'Personal'}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  Active Account Profile
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.actionBadgeText, { color: colors.accent }]}>Switch</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>DATA & STORAGE</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={importStatement}
            disabled={importing || loading}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Import Bank Statement</Text>
            </View>
            {importing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={handleResetDatabase}
            disabled={importing || loading}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>
                Reset Profile Database
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/goals'), 200);
            }}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#EAF8E6' }]}>
                <Ionicons name="disc-outline" size={18} color="#34C759" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Category Budget Goals</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>NOTIFICATIONS</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Import Reminders</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  Monthly alerts on 1st, 15th, 28th
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#78788029', true: colors.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#78788029"
            />
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>APPEARANCE</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#78788029', true: colors.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#78788029"
            />
          </View>
        </View>
      </ScrollView>

      <ProfileSwitcherModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 1 },
  actionBadgeText: { fontSize: 12, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
});