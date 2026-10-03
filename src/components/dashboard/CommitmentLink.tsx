import { FixedCostSummary } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CommitmentLinkProps {
  fixedSummary: FixedCostSummary;
}

export function CommitmentLink({ fixedSummary }: CommitmentLinkProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.miniCommitmentCard}
      activeOpacity={0.8}
      onPress={() => router.push('/(tabs)/trends')}
    >
      <View style={styles.miniCommitmentLeft}>
        <Ionicons name="repeat-outline" size={16} color="#007AFF" style={{ marginRight: 8 }} />
        <Text style={styles.miniCommitmentText}>
          <Text style={styles.miniCommitmentHighlight}>
            {fixedSummary.fixedPercentage}% Fixed Commitments
          </Text>
          {' '}(€{fixedSummary.fixedTotal.toFixed(0)})
        </Text>
      </View>
      <View style={styles.miniCommitmentRight}>
        <Text style={styles.miniCommitmentLinkText}>Analytics</Text>
        <Ionicons name="chevron-forward" size={14} color="#007AFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  miniCommitmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  miniCommitmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  miniCommitmentText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  miniCommitmentHighlight: {
    fontWeight: '700',
    color: '#1C1C1E',
  },
  miniCommitmentRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniCommitmentLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },
});