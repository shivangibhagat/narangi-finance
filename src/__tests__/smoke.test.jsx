import { describe, it, expect, vi, beforeAll } from "vitest";

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────
// Fake signed-in user so App renders past the LoginScreen.
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({ uid: "test-user", email: "test@example.com", displayName: "Test User" });
    return () => {};
  },
  signOut: vi.fn(),
  signInWithPopup: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: class {},
}));

// Empty Firestore (no existing doc) → app boots with DEFAULTS.
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  onSnapshot: (_ref, ok, _err) => {
    ok({ exists: () => false });
    return () => {};
  },
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

// jsdom lacks ResizeObserver (used by recharts ResponsiveContainer).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

beforeAll(() => {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test.appspot.com");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");
});

describe("smoke — every module imports without errors", () => {
  it("imports firebase, hooks, utils, constants", async () => {
    await expect(import("../firebase")).resolves.toBeTruthy();
    await expect(import("../hooks/useFirestoreSync")).resolves.toBeTruthy();
    await expect(import("../hooks/useIsMobile")).resolves.toBeTruthy();
    await expect(import("../hooks/useOutsideClick")).resolves.toBeTruthy();
    await expect(import("../utils/finance")).resolves.toBeTruthy();
    await expect(import("../utils/format")).resolves.toBeTruthy();
    await expect(import("../utils/dateParser")).resolves.toBeTruthy();
    await expect(import("../constants/theme")).resolves.toBeTruthy();
    await expect(import("../constants/defaults")).resolves.toBeTruthy();
  });

  it("imports every component (catches corruption/syntax errors)", async () => {
    await expect(import("../components/ui/primitives")).resolves.toBeTruthy();
    await expect(import("../components/LoginScreen")).resolves.toBeTruthy();
    await expect(import("../components/TxnForm")).resolves.toBeTruthy();
    await expect(import("../components/ImportModal")).resolves.toBeTruthy();
    await expect(import("../components/DashboardTab")).resolves.toBeTruthy();
    await expect(import("../components/TransactionsTab")).resolves.toBeTruthy();
    await expect(import("../components/PlanTab")).resolves.toBeTruthy();
    await expect(import("../components/CreditCardsTab")).resolves.toBeTruthy();
    await expect(import("../components/OpeningBalanceCard")).resolves.toBeTruthy();
    await expect(import("../App")).resolves.toBeTruthy();
  });
});

describe("smoke — App renders and every tab opens without crashing", () => {
  it("renders dashboard then switches through all tabs", async () => {
    const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
    const { default: App } = await import("../App");

    render(<App />);

    // Dashboard is the default tab — wait for it to appear (past loading screens)
    await waitFor(() => {
      expect(screen.getByText(/Annual Overview/)).toBeTruthy();
    });

    // Transactions tab
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search description/)).toBeTruthy();
    });

    // Plan tab (previously crashed: DEFAULTS used without import)
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    await waitFor(() => {
      expect(screen.getByText(/Income Sources/)).toBeTruthy();
    });

    // Credit Cards tab
    fireEvent.click(screen.getByRole("button", { name: /Cards/ }));
    await waitFor(() => {
      expect(screen.getByText(/Total CC Debt/)).toBeTruthy();
    });

    // Quick-add modal opens (FAB is the only button named exactly "+")
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    await waitFor(() => {
      expect(screen.getByText(/Quick Add/)).toBeTruthy();
    });

    // Close it, then open the Excel import modal from the Txns tab
    fireEvent.click(screen.getByText("×"));
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    fireEvent.click(screen.getByRole("button", { name: /Import from Excel/ }));
    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel file here/)).toBeTruthy();
    });
  });
});
