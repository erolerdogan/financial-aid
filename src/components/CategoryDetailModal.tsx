import { useProfile } from '@/contexts/ProfileContext';
import { getTransactionsByMonthAndCategory, Transaction } from '@/db/database';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';

interface CategoryDetailModalProps {
  visible: boolean;
  category: string | null;
  monthName: string;
  badgeColor: string;
  onClose: () => void;
}

export function CategoryDetailModal({
  visible,
  category,
  monthName,
  badgeColor,
  onClose,
}: CategoryDetailModalProps) {
  const db = useSQLiteContext();
  const { activeProfile, currencySymbol } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (category && monthName && db) {
      // Pass all 4 required parameters: db, monthName, category, profileId
      getTransactionsByMonthAndCategory(db, monthName, category, activeProfileId)
        .then(setTransactions)
        .catch((err) => console.error('Failed to load category transactions:', err));
    } else {
      setTransactions([]);
    }
    setSearchQuery('');
  }, [category, monthName, db, activeProfileId]);

  if (!category) return null;

  const totalAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.rawDescription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.badge, { backgroundColor: badgeColor }]} />
              <Text style={styles.title}>{category}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Category Summary Header */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryAmount}>{currencySymbol}{totalAmount.toFixed(2)}</Text>
            <Text style={styles.summaryCount}>
              {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
            </Text>
          </View>

          {/* Local Filter Input */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search within this category..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />

          {/* Transactions List */}
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.merchant}>{item.merchant !== 'Unknown' ? item.merchant : item.rawDescription}</Text>
                  <Text style={styles.rawDesc} numberOfLines={1}>
                    {item.rawDescription}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.amount}>
                    {item.amount < 0 ? '-' : '+'}{currencySymbol}{Math.abs(item.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.date}>{item.date}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No transactions found for this filter.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    flex: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  closeButton: { padding: 4 },
  closeText: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
  summaryCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase' },
  summaryAmount: { fontSize: 28, fontWeight: 'bold', color: '#000', marginTop: 2 },
  summaryCount: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  searchInput: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  listContent: { paddingBottom: 24 },
  txCard: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: { flex: 1, marginRight: 12 },
  merchant: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  rawDesc: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  date: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 14 },
});