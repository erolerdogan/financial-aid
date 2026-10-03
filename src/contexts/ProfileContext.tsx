import {
  clearAllData, convertDebtAmounts, createProfile,
  getProfiles,
  Profile,
  syncCategoryColors, updateProfileCurrency
} from '@/db/database';
import { seedExpandedDemoData } from '@/db/demoSeeder';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF ',
};

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  EUR: 1.0,
  USD: 1.08,
  GBP: 0.85,
  JPY: 160.0,
  CAD: 1.48,
  AUD: 1.62,
  CHF: 0.95,
};

interface ProfileContextType {
  activeProfile: Profile | null;
  profiles: Profile[];
  isDemoMode: boolean;
  hasData: boolean;
  loadingProfiles: boolean;
  dataVersion: number;
  currencySymbol: string;
  setIsDemoMode: (isDemo: boolean) => Promise<void>;
  switchProfile: (profile: Profile) => Promise<void>;
  addNewProfile: (name: string, color?: string) => Promise<Profile | null>;
  editProfile: (id: number, name: string, color: string) => Promise<void>;
  updateCurrency: (currencyCode: string, convertAmounts?: boolean) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  checkDataState: (profileId?: number) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType>({
  activeProfile: null,
  profiles: [],
  isDemoMode: false,
  hasData: false,
  loadingProfiles: true,
  dataVersion: 0,
  currencySymbol: '€',
  setIsDemoMode: async () => {},
  switchProfile: async () => {},
  addNewProfile: async () => null,
  editProfile: async () => {},
  updateCurrency: async () => {},
  refreshProfiles: async () => {},
  checkDataState: async () => false,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const hasInitializedRef = useRef(false);

  const currencySymbol = CURRENCY_SYMBOLS[activeProfile?.currency || 'EUR'] || '€';

  const checkDataState = async (targetProfileId?: number): Promise<boolean> => {
    if (!db) return false;
    const profileIdToQuery = targetProfileId ?? activeProfile?.id;
    if (!profileIdToQuery) return false;

    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM transactions WHERE profileId = ?;',
        [profileIdToQuery]
      );
      const exists = (result?.count ?? 0) > 0;
      setHasData(exists);
      return exists;
    } catch (error) {
      console.error('Error checking transaction count:', error);
      return false;
    }
  };

  const refreshProfiles = async () => {
    if (!db) return;
    try {
      let list = await getProfiles(db);

      if (list.length === 0) {
        await db.runAsync(
          `INSERT INTO profiles (name, avatarColor, isDefault, currency) VALUES ('Personal', '#007AFF', 1, 'EUR');`
        );
        list = await getProfiles(db);
      }

      setProfiles(list);

      let currentActive = activeProfile;
      if (list.length > 0 && (!currentActive || !list.some((p) => p.id === currentActive?.id))) {
        currentActive = list[0];
        setActiveProfile(currentActive);
      } else if (currentActive) {
        const updated = list.find((p) => p.id === currentActive?.id);
        if (updated) setActiveProfile(updated);
      }

      if (currentActive) {
        await checkDataState(currentActive.id);
        await syncCategoryColors(db, currentActive.id);
      }

      setDataVersion((prev) => prev + 1);
    } catch (error: any) {
      if (!error?.message?.includes('Access closed resource')) {
        console.error('Error loading profiles:', error);
      }
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initContext = async () => {
      if (db && !hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setLoadingProfiles(true);
        
        // Load profile and verify data BEFORE unblocking loading state
        await refreshProfiles();
        
        if (isMounted) {
          setLoadingProfiles(false);
        }
      }
    };

    initContext();

    return () => {
      isMounted = false;
    };
  }, [db]);

  const setDemoModeWithCleanup = async (isDemo: boolean): Promise<void> => {
    setIsDemoMode(isDemo);
    if (!db) return;

    try {
      setLoadingProfiles(true);

      if (!isDemo) {
        await clearAllData(db);
        hasInitializedRef.current = false;
        await refreshProfiles();
      } else {
        let list = await getProfiles(db);
        let demoProfile: Profile | null | undefined = list.find((p) => p.name.toLowerCase().includes('demo'));

        if (!demoProfile) {
          demoProfile = await createProfile(db, 'Demo Workspace', '#5856D6');
          if (demoProfile) {
            list = await getProfiles(db);
            setProfiles(list);
          }
        }

        if (demoProfile) {
          setActiveProfile(demoProfile);
          await seedExpandedDemoData(db, demoProfile.id);
          await checkDataState(demoProfile.id);
        }
      }

      setDataVersion((prev) => prev + 1);
    } catch (error) {
      console.error('Error setting demo mode:', error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const switchProfile = async (profile: Profile) => {
    setActiveProfile(profile);
    if (db) await syncCategoryColors(db, profile.id);
    await checkDataState(profile.id);
    setDataVersion((prev) => prev + 1);
  };

  const addNewProfile = async (name: string, color?: string): Promise<Profile | null> => {
    if (!db || !name.trim()) return null;
    const newProf = await createProfile(db, name.trim(), color || '#007AFF');
    if (newProf) {
      setProfiles((prev) => [...prev, newProf]);
      setActiveProfile(newProf);
      await checkDataState(newProf.id);
      setDataVersion((prev) => prev + 1);
    }
    return newProf;
  };

  const editProfile = async (id: number, name: string, color: string): Promise<void> => {
    if (!db || !name.trim()) return;
    try {
      await db.runAsync(
        'UPDATE profiles SET name = ?, avatarColor = ? WHERE id = ?;',
        [name.trim(), color, id]
      );
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name.trim(), avatarColor: color } : p))
      );
      if (activeProfile?.id === id) {
        setActiveProfile((prev) => (prev ? { ...prev, name: name.trim(), avatarColor: color } : null));
      }
      setDataVersion((prev) => prev + 1);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const updateCurrency = async (newCurrencyCode: string, convertAmounts: boolean = true): Promise<void> => {
    if (!db || !activeProfile) return;

    const currentCurrencyCode = activeProfile.currency || 'EUR';
    if (currentCurrencyCode === newCurrencyCode) return;

    try {
      if (convertAmounts) {
        const currentRate = DEFAULT_EXCHANGE_RATES[currentCurrencyCode] || 1.0;
        const newRate = DEFAULT_EXCHANGE_RATES[newCurrencyCode] || 1.0;
        const conversionFactor = newRate / currentRate;

        await db.runAsync(
          `UPDATE transactions 
           SET amount = ROUND(amount * ?, 2) 
           WHERE profileId = ?;`,
          [conversionFactor, activeProfile.id]
        );
        await convertDebtAmounts(db, activeProfile.id, conversionFactor);
        
      }

      await updateProfileCurrency(db, activeProfile.id, newCurrencyCode);

      setActiveProfile((prev) => (prev ? { ...prev, currency: newCurrencyCode } : null));
      setProfiles((prev) =>
        prev.map((p) => (p.id === activeProfile.id ? { ...p, currency: newCurrencyCode } : p))
      );

      setDataVersion((prev) => prev + 1);
    } catch (error) {
      console.error('Error updating currency:', error);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        isDemoMode,
        hasData,
        loadingProfiles,
        dataVersion,
        currencySymbol,
        setIsDemoMode: setDemoModeWithCleanup,
        switchProfile,
        addNewProfile,
        editProfile,
        updateCurrency,
        refreshProfiles,
        checkDataState,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}