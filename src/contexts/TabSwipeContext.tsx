import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Keyboard,
  PanResponder,
  PanResponderGestureState,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

export type TabSwipeDirection = 'next' | 'prev';

/** Returns true when the screen handled the swipe itself (the Plan tab steps through its segments). */
export type TabSwipeInterceptor = (direction: TabSwipeDirection) => boolean;

const TAB_ORDER = ['/', '/trends', '/debts'] as const;

const CLAIM_DX = 24;
const SWITCH_DX = 60;
const SWITCH_VELOCITY = 0.5;

interface TabSwipeContextValue {
  block: () => void;
  setInterceptor: (interceptor: TabSwipeInterceptor | null) => void;
}

const TabSwipeContext = createContext<TabSwipeContextValue>({
  block: () => {},
  setInterceptor: () => {},
});

export function TabSwipeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const blockedRef = useRef(false);
  const interceptorRef = useRef<TabSwipeInterceptor | null>(null);

  const go = useCallback(
    (direction: TabSwipeDirection) => {
      if (interceptorRef.current?.(direction)) return;

      const index = TAB_ORDER.findIndex((path) => path === pathname);
      if (index < 0) return;
      const target = TAB_ORDER[index + (direction === 'next' ? 1 : -1)];
      if (!target) return;

      Keyboard.dismiss();
      Haptics.selectionAsync().catch(() => {});
      // Coming from Trends the Plan tab opens on Debts, so the order stays Trends → Debts → Health → Future Growth.
      if (target === '/debts') router.navigate({ pathname: '/debts', params: { segment: 'debts' } });
      else router.navigate(target);
    },
    [pathname, router]
  );

  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  // Each touch starts unblocked: the capture phase runs before a blocker's own onTouchStart.
  const unblock = useCallback(() => {
    blockedRef.current = false;
    return false;
  }, []);

  // Only clearly horizontal drags are claimed, and never one that started in a blocked area,
  // so vertical scrolling, the chart scrub and row swipes keep their touches.
  const shouldClaim = useCallback(
    (_: GestureResponderEvent, g: PanResponderGestureState) =>
      !blockedRef.current &&
      g.numberActiveTouches === 1 &&
      Math.abs(g.dx) > CLAIM_DX &&
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    []
  );

  const handleRelease = useCallback((_: GestureResponderEvent, g: PanResponderGestureState) => {
    if (Math.abs(g.dx) < Math.abs(g.dy)) return;
    const far = Math.abs(g.dx) > SWITCH_DX;
    const fast = Math.abs(g.vx) > SWITCH_VELOCITY;
    if (far || fast) goRef.current(g.dx < 0 ? 'next' : 'prev');
  }, []);

  // The handlers read the refs when a touch arrives, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponderCapture: unblock,
      onMoveShouldSetPanResponder: shouldClaim,
      onPanResponderRelease: handleRelease,
    })
  );

  const value = useMemo<TabSwipeContextValue>(
    () => ({
      block: () => {
        blockedRef.current = true;
      },
      setInterceptor: (interceptor) => {
        interceptorRef.current = interceptor;
      },
    }),
    []
  );

  return (
    <TabSwipeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
        {children}
      </View>
    </TabSwipeContext.Provider>
  );
}

/** `onTouchStart` handler for an area with its own horizontal gesture; a touch that starts there never switches tab. */
export function useBlockTabSwipe() {
  return useContext(TabSwipeContext).block;
}

export function TabSwipeBlocker({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const blockTabSwipe = useBlockTabSwipe();
  return (
    <View style={style} onTouchStart={blockTabSwipe}>
      {children}
    </View>
  );
}

/** Lets the focused screen take a swipe before the tab changes. */
export function useTabSwipeInterceptor(handler: TabSwipeInterceptor) {
  const { setInterceptor } = useContext(TabSwipeContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useFocusEffect(
    useCallback(() => {
      setInterceptor((direction) => handlerRef.current(direction));
      return () => setInterceptor(null);
    }, [setInterceptor])
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
