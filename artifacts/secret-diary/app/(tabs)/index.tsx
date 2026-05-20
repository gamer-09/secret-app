import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { useDiary } from "@/context/DiaryContext";

const c = colors.light;
const LINE_HEIGHT = 26;
const MAX_CHARS = 680;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Lock Screen ──────────────────────────────────────────────────────────────

function LockScreen() {
  const { hasPassword, unlock, setupPassword } = useDiary();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (!hasPassword) {
      if (password.length < 4) {
        setError("At least 4 characters");
        shake();
        return;
      }
      if (password !== confirmPwd) {
        setError("Passwords do not match");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
        return;
      }
      await setupPassword(password);
    } else {
      const ok = unlock(password);
      if (!ok) {
        setError("Wrong password");
        setPassword("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
      }
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <LinearGradient
      colors={[c.cover, c.coverMid, c.cover] as [string, string, string]}
      locations={[0, 0.5, 1]}
      style={[
        styles.lockRoot,
        { paddingTop: topPad + 16, paddingBottom: botPad + 16 },
      ]}
    >
      <Animated.View
        style={[
          styles.coverFrame,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.coverInner}>
          <View style={styles.goldDivider} />

          <Text style={styles.coverTitle}>Secret Diary</Text>

          <View style={styles.goldDivider} />

          <View style={styles.lockCircle}>
            <Feather name="lock" size={36} color={c.coverGold} />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.lockHint}>
              {!hasPassword ? "Create a password" : "Enter your password"}
            </Text>
          )}

          {!hasPassword ? (
            <>
              <TextInput
                style={styles.lockInput}
                placeholder="New password"
                placeholderTextColor={c.coverGold + "55"}
                secureTextEntry
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError("");
                }}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TextInput
                style={styles.lockInput}
                placeholder="Confirm password"
                placeholderTextColor={c.coverGold + "55"}
                secureTextEntry
                value={confirmPwd}
                onChangeText={(t) => {
                  setConfirmPwd(t);
                  setError("");
                }}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </>
          ) : (
            <TextInput
              style={styles.lockInput}
              placeholder="Password"
              placeholderTextColor={c.coverGold + "55"}
              secureTextEntry
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError("");
              }}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              autoFocus
            />
          )}

          <TouchableOpacity
            style={styles.openButton}
            onPress={handleSubmit}
            activeOpacity={0.75}
          >
            <Text style={styles.openButtonText}>
              {!hasPassword ? "BEGIN" : "OPEN"}
            </Text>
          </TouchableOpacity>

          <View style={styles.goldDivider} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

// ─── Ruled Lines ──────────────────────────────────────────────────────────────

function RuledLines({ areaH }: { areaH: number }) {
  const count = Math.ceil(areaH / LINE_HEIGHT) + 2;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.ruledLine, { top: (i + 1) * LINE_HEIGHT - 1 }]}
        />
      ))}
    </>
  );
}

// ─── Diary Book ───────────────────────────────────────────────────────────────

function DiaryBook() {
  const {
    currentPage,
    currentPageIndex,
    totalPages,
    updateCurrentPage,
    addPage,
    goToNextPage,
    goToPrevPage,
    lock,
    hasPassword,
  } = useDiary();

  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get("window");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const HEADER_H = topPad + 48;
  const FOOTER_H = botPad + 52;
  const PAGE_H = SH - HEADER_H - FOOTER_H;
  const DATE_ROW_H = 28;
  const TEXT_H = PAGE_H - DATE_ROW_H - 24;

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTurn = useCallback(
    (dir: "next" | "prev", callback: () => void) => {
      const out = dir === "next" ? -SW : SW;
      Animated.timing(slideAnim, {
        toValue: out,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        callback();
        slideAnim.setValue(-out * 0.3);
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 120,
          friction: 14,
          useNativeDriver: true,
        }).start();
      });
    },
    [slideAnim, SW]
  );

  const handleNext = useCallback(() => {
    if (currentPageIndex < totalPages - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateTurn("next", goToNextPage);
    }
  }, [currentPageIndex, totalPages, animateTurn, goToNextPage]);

  const handlePrev = useCallback(() => {
    if (currentPageIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateTurn("prev", goToPrevPage);
    }
  }, [currentPageIndex, animateTurn, goToPrevPage]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 18 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.8,
      onPanResponderMove: (_, gs) => {
        slideAnim.setValue(gs.dx * 0.35);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -55) {
          handleNext();
        } else if (gs.dx > 55) {
          handlePrev();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const handleAddPage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const out = -SW;
    Animated.timing(slideAnim, {
      toValue: out,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      addPage();
      slideAnim.setValue(SW * 0.3);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }).start();
    });
  };

  const isLastPage = currentPageIndex === totalPages - 1;
  const charCount = currentPage?.content.length ?? 0;
  const isFull = charCount >= MAX_CHARS;

  return (
    <View style={[styles.bookRoot, { backgroundColor: c.background }]}>
      {/* Header */}
      <View
        style={[styles.bookHeader, { paddingTop: topPad, height: HEADER_H }]}
      >
        {hasPassword ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={lock}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="lock" size={19} color={c.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}

        <Text style={styles.headerTitle}>My Diary</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleAddPage}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="plus" size={22} color={c.primary} />
        </TouchableOpacity>
      </View>

      {/* Page */}
      <Animated.View
        style={[
          styles.pageOuter,
          {
            height: PAGE_H,
            transform: [{ translateX: slideAnim }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drop shadow behind page */}
        <View
          pointerEvents="none"
          style={[styles.pageShadowEl, { height: PAGE_H }]}
        />

        <View style={[styles.page, { height: PAGE_H }]}>
          {/* Ruled lines layer */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <RuledLines areaH={PAGE_H} />
          </View>

          {/* Left margin line */}
          <View style={styles.marginLine} pointerEvents="none" />

          {/* Date row */}
          <Text style={[styles.pageDate, { height: DATE_ROW_H }]} numberOfLines={1}>
            {currentPage ? formatDate(currentPage.createdAt) : ""}
          </Text>

          {/* Writing TextInput — no scroll, fits the page */}
          <View
            style={[styles.textContainer, { height: TEXT_H }]}
            pointerEvents="box-none"
          >
            <TextInput
              style={[
                styles.pageText,
                { height: TEXT_H, fontFamily: "Lora_400Regular" },
              ]}
              multiline
              scrollEnabled={false}
              value={currentPage?.content ?? ""}
              onChangeText={updateCurrentPage}
              maxLength={MAX_CHARS}
              placeholder={
                isFull
                  ? "Page full — swipe or tap ▶ to add a new page"
                  : "Start writing..."
              }
              placeholderTextColor={c.pageLines}
              textAlignVertical="top"
              autoCorrect
              autoCapitalize="sentences"
            />
          </View>
        </View>
      </Animated.View>

      {/* Footer */}
      <View
        style={[
          styles.bookFooter,
          { paddingBottom: botPad, height: FOOTER_H },
        ]}
      >
        <TouchableOpacity
          style={[styles.navBtn, currentPageIndex === 0 && styles.navDisabled]}
          onPress={handlePrev}
          disabled={currentPageIndex === 0}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="chevron-left"
            size={26}
            color={currentPageIndex === 0 ? c.pageLines : c.primary}
          />
        </TouchableOpacity>

        <Text style={styles.pageNumText}>
          {currentPageIndex + 1} / {totalPages}
        </Text>

        {isLastPage ? (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleAddPage}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="plus-circle" size={22} color={c.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleNext}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-right" size={26} color={c.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DiaryScreen() {
  const { isLocked, isLoading } = useDiary();

  if (isLoading) {
    return (
      <LinearGradient
        colors={[c.cover, c.coverMid, c.cover] as [string, string, string]}
        style={styles.loadingRoot}
      >
        <Text style={styles.loadingText}>Opening your diary…</Text>
      </LinearGradient>
    );
  }

  if (isLocked) return <LockScreen />;
  return <DiaryBook />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Lock Screen
  lockRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverFrame: {
    width: "84%",
    borderWidth: 2,
    borderColor: c.coverGold,
    borderRadius: 3,
    padding: 4,
  },
  coverInner: {
    borderWidth: 1,
    borderColor: c.coverGold + "70",
    borderRadius: 1,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 18,
  },
  goldDivider: {
    width: "75%",
    height: 1,
    backgroundColor: c.coverGold,
    opacity: 0.65,
  },
  coverTitle: {
    fontFamily: "Lora_700Bold",
    fontSize: 30,
    color: c.coverGold,
    letterSpacing: 2.5,
    textAlign: "center",
  },
  lockCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: c.coverGold + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  lockHint: {
    fontFamily: "Lora_400Regular",
    fontSize: 13,
    color: c.coverGold + "cc",
    letterSpacing: 0.4,
  },
  errorText: {
    fontFamily: "Lora_400Regular",
    fontSize: 13,
    color: "#f08080",
    letterSpacing: 0.3,
  },
  lockInput: {
    width: "100%",
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: c.coverGold + "80",
    color: c.coverGold,
    fontFamily: "Lora_400Regular",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 6,
    backgroundColor: "transparent",
  },
  openButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderWidth: 1,
    borderColor: c.coverGold,
    borderRadius: 2,
  },
  openButtonText: {
    fontFamily: "Lora_700Bold",
    fontSize: 13,
    color: c.coverGold,
    letterSpacing: 4,
  },

  // Book
  bookRoot: {
    flex: 1,
  },
  bookHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: c.background,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: "Lora_700Bold",
    fontSize: 17,
    color: c.primary,
    textAlign: "center",
    letterSpacing: 1.2,
  },
  pageOuter: {
    flex: 1,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  pageShadowEl: {
    position: "absolute",
    top: 5,
    left: 18,
    right: 18,
    borderRadius: 3,
    backgroundColor: "#6b4a25",
    opacity: 0.18,
  },
  page: {
    flex: 1,
    backgroundColor: c.page,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: c.border,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 8,
    paddingLeft: 50,
  },
  marginLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 42,
    width: 1.5,
    backgroundColor: c.pageMarginLine,
    opacity: 0.55,
  },
  ruledLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: c.pageLines,
  },
  pageDate: {
    fontFamily: "Lora_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
    letterSpacing: 0.3,
    marginBottom: 4,
    includeFontPadding: false,
  },
  textContainer: {
    overflow: "hidden",
  },
  pageText: {
    flex: 1,
    color: c.pageInk,
    fontSize: 16,
    lineHeight: LINE_HEIGHT,
    textAlignVertical: "top",
    padding: 0,
    margin: 0,
    backgroundColor: "transparent",
    includeFontPadding: false,
  },

  // Footer
  bookFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 10,
    justifyContent: "space-between",
    backgroundColor: c.background,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navDisabled: {
    opacity: 0.25,
  },
  pageNumText: {
    fontFamily: "Lora_400Regular",
    fontSize: 13,
    color: c.mutedForeground,
    letterSpacing: 1.2,
    alignSelf: "center",
  },

  // Loading
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: "Lora_400Regular",
    fontSize: 15,
    color: c.coverGold,
    opacity: 0.8,
    letterSpacing: 1,
  },
});
