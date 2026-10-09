import { currencyInfo, DEFAULT_CURRENCY } from '@/constants/currencies';
import {
  clearAllData, createProfile, deleteProfile,
  getProfiles,
  Profile,
  switchProfileCurrency,
  syncCategoryColors
} from '@/db/database';
import { seedExpandedDemoData } from '@/db/demoSeeder';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface ProfileContextType {
  activeProfile: Profile | null;
  profiles: Profile[];
  isDemoMode: boolean;
  hasData: boolean;
  loadingProfiles: boolean;
  dataVersion: number;
  currencySymbol: string;
  /** Digits after the decimal separator in the profile currency: what a screen that shows cents asks `format.money` for. */
  currencyDecimals: number;
  setIsDemoMode: (isDemo: boolean) => Promise<void>;
  switchProfile: (profile: Profile) => Promise<void>;
  addNewProfile: (name: string, color?: string, currency?: string) => Promise<Profile | null>;
  editProfile: (id: number, name: string, color: string) => Promise<void>;
  /**
   * Gives the active profile another currency. `factor` (from `conversionFactor`) converts the stored
   * amounts; `null` leaves them as they are. Throws when the conversion fails; nothing has changed then.
   */
  updateCurrency: (currencyCode: string, factor: number | null) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  reloadAfterRestore: () => Promise<void>;
  checkDataState: (profileId?: number) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType>({
  activeProfile: null,
  profiles: [],
  isDemoMode: false,
  hasData: false,
  loadingProfiles: true,
  dataVersion: 0,
  currencySymbol: currencyInfo(DEFAULT_CURRENCY).symbol,
  currencyDecimals: currencyInfo(DEFAULT_CURRENCY).decimals,
  setIsDemoMode: async () => {},
  switchProfile: async () => {},
  addNewProfile: async () => null,
  editProfile: async () => {},
  updateCurrency: async () => {},
  refreshProfiles: async () => {},
  reloadAfterRestore: async () => {},
  checkDataState: async () => false,
});

const DEMO_PROFILE_NAME = 'Demo Workspace';
const isDemoProfile = (p: Profile): boolean => p.name === DEMO_PROFILE_NAME;

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const hasInitializedRef = useRef(false);

  const { symbol: currencySymbol, decimals: currencyDecimals } = currencyInfo(activeProfile?.currency);

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

      const demoProfile = list.find(isDemoProfile);
      if (demoProfile) setIsDemoMode(true);

      let currentActive = activeProfile;
      if (list.length > 0 && (!currentActive || !list.some((p) => p.id === currentActive?.id))) {
        currentActive = demoProfile ?? list[0];
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

  // Every row was replaced: profile ids may now point at different people, so pick the active profile again.
  const reloadAfterRestore = async () => {
    if (!db) return;
    try {
      const list = await getProfiles(db);
      const next = list.find((p) => !isDemoProfile(p)) ?? list[0] ?? null;

      setProfiles(list);
      setIsDemoMode(!!next && isDemoProfile(next));
      setActiveProfile(next);

      if (next) {
        await checkDataState(next.id);
        await syncCategoryColors(db, next.id);
      }

      setDataVersion((prev) => prev + 1);
    } catch (error) {
      console.error('Error reloading after restore:', error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per database; refreshProfiles is new on every render
  }, [db]);

  const setDemoModeWithCleanup = async (isDemo: boolean): Promise<void> => {
    setIsDemoMode(isDemo);
    if (!db) return;

    try {
      setLoadingProfiles(true);

      if (!isDemo) {
        // Only the demo profile goes: the user's own profile keeps its name, currency and household answers.
        const demoProfile = (await getProfiles(db)).find(isDemoProfile);
        if (demoProfile) {
          await clearAllData(db, demoProfile.id);
          await deleteProfile(db, demoProfile.id);
        }
        hasInitializedRef.current = false;
        await refreshProfiles();
      } else {
        let list = await getProfiles(db);
        let demoProfile: Profile | null | undefined = list.find(isDemoProfile);

        if (!demoProfile) {
          demoProfile = await createProfile(db, DEMO_PROFILE_NAME, '#5856D6');
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

  const addNewProfile = async (name: string, color?: string, currency?: string): Promise<Profile | null> => {
    if (!db || !name.trim()) return null;
    const newProf = await createProfile(db, name.trim(), color || '#007AFF', currency || 'EUR');
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

  const updateCurrency = async (newCurrencyCode: string, factor: number | null): Promise<void> => {
    if (!db || !activeProfile) return;

    const currentCurrencyCode = activeProfile.currency || DEFAULT_CURRENCY;
    if (currentCurrencyCode === newCurrencyCode) return;

    await switchProfileCurrency(
      db,
      activeProfile.id,
      newCurrencyCode,
      factor === null ? null : { factor, decimals: currencyInfo(newCurrencyCode).decimals }
    );

    setActiveProfile((prev) => (prev ? { ...prev, currency: newCurrencyCode } : null));
    setProfiles((prev) =>
      prev.map((p) => (p.id === activeProfile.id ? { ...p, currency: newCurrencyCode } : p))
    );

    setDataVersion((prev) => prev + 1);
  };

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles: isDemoMode ? profiles.filter(isDemoProfile) : profiles,
        isDemoMode,
        hasData,
        loadingProfiles,
        dataVersion,
        currencySymbol,
        currencyDecimals,
        setIsDemoMode: setDemoModeWithCleanup,
        switchProfile,
        addNewProfile,
        editProfile,
        updateCurrency,
        refreshProfiles,
        reloadAfterRestore,
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