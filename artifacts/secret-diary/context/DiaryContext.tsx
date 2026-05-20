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

export type DiaryView = "home" | "diary";

interface DiaryContextValue {
  isLocked: boolean;
  hasPassword: boolean;
  pages: DiaryPage[];
  currentPageIndex: number;
  currentPage: DiaryPage | null;
  totalPages: number;
  isLoading: boolean;
  view: DiaryView;
  setView: (v: DiaryView) => void;
  unlock: (password: string) => boolean;
  setupPassword: (password: string) => Promise<void>;
  lock: () => void;
  updateCurrentPage: (content: string) => void;
  addPage: () => void;
  deletePage: (index: number) => void;
  importFromText: (text: string) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  goToPage: (index: number) => void;
}

const DiaryContext = createContext<DiaryContextValue | null>(null);

const PASSWORD_KEY = "diary_secret_password";
const PAGES_KEY = "diary_pages_v1";
export const PAGE_MAX_CHARS = 680;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function newPage(content = ""): DiaryPage {
  return {
    id: generateId(),
    content,
    createdAt: new Date().toISOString(),
  };
}

// Split a long text into page-sized chunks, breaking on word boundaries.
function splitIntoPages(text: string): DiaryPage[] {
  const chunks: string[] = [];
  let remaining = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (remaining.length > 0) {
    if (remaining.length <= PAGE_MAX_CHARS) {
      chunks.push(remaining);
      break;
    }
    let splitAt = PAGE_MAX_CHARS;
    const lastNewline = remaining.lastIndexOf("\n", PAGE_MAX_CHARS);
    const lastSpace = remaining.lastIndexOf(" ", PAGE_MAX_CHARS);
    const best = Math.max(lastNewline, lastSpace);
    if (best > 0) splitAt = best;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks.map((c) => newPage(c));
}

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [pages, setPages] = useState<DiaryPage[]>([newPage()]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<DiaryView>("home");

  // ── Load persisted data ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const pwd = await AsyncStorage.getItem(PASSWORD_KEY);
        if (pwd) {
          setStoredPassword(pwd);
          setHasPassword(true);
        } else {
          setHasPassword(false);
        }
        const raw = await AsyncStorage.getItem(PAGES_KEY);
        if (raw) {
          const parsed: DiaryPage[] = JSON.parse(raw);
          if (parsed.length > 0) {
            setPages(parsed);
            setCurrentPageIndex(0);
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // ── Auto-save pages whenever they change ─────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(PAGES_KEY, JSON.stringify(pages)).catch(() => {});
    }
  }, [pages, isLoading]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const unlock = useCallback(
    (password: string): boolean => {
      if (!hasPassword || password === storedPassword) {
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
      setView("home");
    }
  }, [hasPassword]);

  // ── Page operations ──────────────────────────────────────────────────────
  const updateCurrentPage = useCallback(
    (content: string) => {
      setPages((prev) =>
        prev.map((p, i) => (i === currentPageIndex ? { ...p, content } : p))
      );
    },
    [currentPageIndex]
  );

  const addPage = useCallback(() => {
    setCurrentPageIndex(pages.length);
    setPages((prev) => [...prev, newPage()]);
  }, [pages.length]);

  const deletePage = useCallback(
    (index: number) => {
      setPages((prev) => {
        const next = prev.filter((_, i) => i !== index);
        // Always keep at least one page
        return next.length > 0 ? next : [newPage()];
      });
      setCurrentPageIndex((prev) => {
        if (index < prev) return prev - 1;
        if (index === prev) return Math.max(0, index - 1);
        return prev;
      });
    },
    []
  );

  const importFromText = useCallback(
    (text: string) => {
      const imported = splitIntoPages(text);
      const insertAt = pages.length;
      setCurrentPageIndex(insertAt);
      setPages((prev) => [...prev, ...imported]);
      setView("diary");
    },
    [pages.length]
  );

  const goToNextPage = useCallback(() => {
    setCurrentPageIndex((prev) => Math.min(prev + 1, pages.length - 1));
  }, [pages.length]);

  const goToPrevPage = useCallback(() => {
    setCurrentPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      setCurrentPageIndex(Math.max(0, Math.min(index, pages.length - 1)));
    },
    [pages.length]
  );

  return (
    <DiaryContext.Provider
      value={{
        isLocked,
        hasPassword,
        pages,
        currentPageIndex,
        currentPage: pages[currentPageIndex] ?? null,
        totalPages: pages.length,
        isLoading,
        view,
        setView,
        unlock,
        setupPassword,
        lock,
        updateCurrentPage,
        addPage,
        deletePage,
        importFromText,
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
