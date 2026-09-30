import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DemoBanner() {
  const { isDemoMode, setIsDemoMode } = useProfile();
  const { isDark } = useTheme();

  if (!isDemoMode) return null;

  const handleEndDemo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // ProfileContext.setIsDemoMode(false) executes clearAllData(db) 
      // to purge all tables and reset to a clean Personal profile.
      await setIsDemoMode(false);
      router.replace('/welcome');
    } catch (err) {
      console.error('Failed to end demo mode:', err);
      router.replace('/welcome');
    }
  };

  return (
    <View 
      style={[
        styles.banner, 
        { 
          // Vibrant amber/orange tint for clear mode emphasis while staying modern
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.12)',
          borderBottomColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)',
        }
      ]}
    >
      <View style={styles.leftContent}>
        <Ionicons name="sparkles" size={15} color="#F59E0B" />
        <Text style={[styles.bannerText, { color: isDark ? '#FBBF24' : '#B45309' }]}>
          Demo Workspace Active
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.exitButton, { backgroundColor: '#F59E0B' }]} 
        onPress={handleEndDemo}
        activeOpacity={0.8}
      >
        <Text style={styles.exitButtonText}>Exit Demo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    width: '100%',
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  exitButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});