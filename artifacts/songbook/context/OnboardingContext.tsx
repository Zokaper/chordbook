import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { OnboardingCarousel } from "@/components/OnboardingCarousel";

const KEY = "songbook_onboarding_v1";

interface OnboardingContextValue {
  showOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((val) => {
        if (val !== "1") setVisible(true);
      })
      .catch(() => {
        // On storage failure default to showing onboarding
        setVisible(true);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  const markSeen = useCallback(async () => {
    await AsyncStorage.setItem(KEY, "1");
    setVisible(false);
  }, []);

  const showOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setVisible(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ showOnboarding }}>
      {children}
      {loaded && visible && <OnboardingCarousel onDone={markSeen} />}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
