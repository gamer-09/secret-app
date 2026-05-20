import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface DiaryPage {
  id: string;
  content: string;
  createdAt: string;
}

interface DiaryContextValue {
  isLocked: boolean;
  hasPassword: boolean;
  pages: DiaryPage[];
  currentPageIndex: number;
  currentPage: DiaryPage | null;
  totalPages: number;
  isLoading: boolean;
  unlock: (password: string) => boolean;
  setupPassword: (password: string) => Promise<void>;
  lock: () => void;
  updateCurrentPage: (content: string) => void;
  addPage: () => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  goToPage: (index: number) => void;
}

const DiaryContext = createContext<DiaryContextValue | null>(null);

const PASSWORD_KEY = "diary_secret_password";
const PAGES_KEY = "diary_pages_v1";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function newPage(): DiaryPage {
  return {
    id: generateId(),
    content: "",
    createdAt: new Date().toISOString(),
  };
}

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [pages, setPages] = useState<DiaryPage[]>([newPage()]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const pwd = await AsyncStorage.getItem(PASSWORD_KEY);
        if (pwd) {
          setStoredPassword(pwd);
          setHasPassword(true);
          // isLocked stays true → user must enter password
        } else {
          setHasPassword(false);
          // isLocked stays true → user will see the "create password" screen
        }

        const raw = await AsyncStorage.getItem(PAGES_KEY);
        if (raw) {
          const parsed: DiaryPage[] = JSON.parse(raw);
          if (parsed.length > 0) {
            setPages(parsed);
            setCurrentPageIndex(parsed.length - 1);
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const savePages = useCallback(async (updated: DiaryPage[]) => {
    try {
      await AsyncStorage.setItem(PAGES_KEY, JSON.stringify(updated));
    } catch {}
  }, []);

  const unlock = useCallback(
    (password: string): boolean => {
      if (!hasPassword) {
        setIsLocked(false);
        return true;
      }
      if (password === storedPassword) {
        setIsLocked(false);
        return true;
      }
      return false;
    },
    [hasPassword, storedPassword]
  );

  const setupPassword = useCallback(async (password: string) => {
    await AsyncStorage.setItem(PASSWORD_KEY, password);
    setStoredPassword(password);
    setHasPassword(true);
    setIsLocked(false);
  }, []);

  const lock = useCallback(() => {
    if (hasPassword) {
      setIsLocked(true);
    }
  }, [hasPassword]);

  const updateCurrentPage = useCallback(
    (content: string) => {
      setPages((prev) => {
        const updated = prev.map((p, i) =>
          i === currentPageIndex ? { ...p, content } : p
        );
        savePages(updated);
        return updated;
      });
    },
    [currentPageIndex, savePages]
  );

  const addPage = useCallback(() => {
    setPages((prev) => {
      const updated = [...prev, newPage()];
      savePages(updated);
      setCurrentPageIndex(updated.length - 1);
      return updated;
    });
  }, [savePages]);

  const goToNextPage = useCallback(() => {
    setCurrentPageIndex((prev) => Math.min(prev + 1, pages.length - 1));
  }, [pages.length]);

  const goToPrevPage = useCallback(() => {
    setCurrentPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pages.length - 1));
      setCurrentPageIndex(clamped);
    },
    [pages.length]
  );

  const currentPage = pages[currentPageIndex] ?? null;

  return (
    <DiaryContext.Provider
      value={{
        isLocked,
        hasPassword,
        pages,
        currentPageIndex,
        currentPage,
        totalPages: pages.length,
        isLoading,
        unlock,
        setupPassword,
        lock,
        updateCurrentPage,
        addPage,
        goToNextPage,
        goToPrevPage,
        goToPage,
      }}
    >
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error("useDiary must be used inside DiaryProvider");
  return ctx;
}
