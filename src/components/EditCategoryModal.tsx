import { useProfile } from '@/contexts/ProfileContext';
import { addCustomRule, Transaction, updateTransactionCategory } from '@/db/database';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View
} from 'react-native';

const CATEGORIES = [
  'Housing',
  'Childcare',
  'Credit Card Payments',
  'Groceries',
  'Dining Out',
  'Health & Care',
  'Financial Transfers',
  'Utilities & Telecom',
  'Loan Repayment',
  'Transportation',
  'Taxes & Municipal Fees',
  'Shopping & Retail',
];

interface EditCategoryModalProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCategoryModal({
  visible,
  transaction,
  onClose,
  onSuccess,
}: EditCategoryModalProps) {
  const db = useSQLiteContext();
  const { activeProfile, currencySymbol } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [createRule, setCreateRule] = useState<boolean>(false);

  React.useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category);
      setCreateRule(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSave = async () => {
    try {
      // 1. Update the individual transaction in SQLite
      await updateTransactionCategory(db, transaction.id, selectedCategory);

      // 2. Optional: Add global rule for future imports
      if (createRule) {
        const keyword = transaction.merchant.toUpperCase();
        await addCustomRule(db, keyword, selectedCategory, activeProfileId);
      }

      Alert.alert('Saved', 'Transaction category updated successfully.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update transaction category.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Category</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.merchantCard}>
            <Text style={styles.merchantName}>{transaction.merchant}</Text>
            <Text style={styles.rawText}>{transaction.rawDescription}</Text>
            <Text style={styles.amountText}>
              {transaction.amount < 0 ? '-' : '+'}{currencySymbol}{Math.abs(transaction.amount).toFixed(2)}
            </Text>
          </View>

          <Text style={styles.sectionHeader}>Select New Category</Text>

          <ScrollView style={styles.categoryList}>
            {CATEGORIES.map((cat) => {
              const isSelected = cat === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, isSelected && styles.categoryOptionSelected]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, isSelected && styles.categoryOptionTextSelected]}>
                    {cat}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Rule Toggle */}
          <View style={styles.ruleContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleTitle}>Create Auto-Category Rule</Text>
              <Text style={styles.ruleSubtitle}>
                Automatically assign "{selectedCategory}" to future transactions matching "{transaction.merchant.toUpperCase()}"
              </Text>
            </View>
            <Switch value={createRule} onValueChange={setCreateRule} trackColor={{ true: '#007AFF' }} />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#F2F2F7', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  closeText: { fontSize: 16, color: '#007AFF', fontWeight: '500' },
  merchantCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16 },
  merchantName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  rawText: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  amountText: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', marginTop: 8 },
  sectionHeader: { fontSize: 14, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 8 },
  categoryList: { maxHeight: 220, marginBottom: 16 },
  categoryOption: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryOptionSelected: { backgroundColor: '#E5F1FF', borderColor: '#007AFF', borderWidth: 1 },
  categoryOptionText: { fontSize: 16, color: '#000' },
  categoryOptionTextSelected: { color: '#007AFF', fontWeight: 'bold' },
  checkmark: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  ruleContainer: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ruleTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  ruleSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2, paddingRight: 8 },
  saveButton: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});