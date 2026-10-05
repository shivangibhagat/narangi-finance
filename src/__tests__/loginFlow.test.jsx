import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ─── Mocks (same shape as smoke.test.jsx) ───────────────────────────────────
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null); // signed OUT — the login screen is what renders
    return () => {};
  },
  signOut: vi.fn(),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: class {},
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  onSnapshot: () => () => {},
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

beforeAll(() => {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test.appspot.com");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("login flow — signed-out screen", () => {
  it("shows the login screen when signed out (no app shell leaks through)", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { default: App } = await import("../App");

    render(<App />);
    expect(screen.getByText("Narangi Finance")).toBeTruthy();
    expect(screen.getByText(/private family finance tracker/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sign in with Google/ })).toBeTruthy();
    // Nothing from the app shell should render before auth completes
    expect(screen.queryByText(/Annual Overview/)).toBeNull();
  });

  it("clicking the button starts the Google popup flow", async () => {
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { LoginScreen } = await import("../components/LoginScreen");
    const { signInWithPopup } = await import("firebase/auth");

    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/ }));
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it("silently ignores 'popup closed by user' (no scary error for a cancel)", async () => {
    const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
    const { LoginScreen } = await import("../components/LoginScreen");
    const { signInWithPopup } = await import("firebase/auth");

    const err = new Error("closed");
    err.code = "auth/popup-closed-by-user";
    signInWithPopup.mockRejectedValueOnce(err);

    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/ }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign in with Google/ })).toBeTruthy();
    });
    expect(screen.queryByText(/Sign-in failed/)).toBeNull();
  });

  it("shows a friendly error for real sign-in failures and re-enables the button", async () => {
    const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
    const { LoginScreen } = await import("../components/LoginScreen");
    const { signInWithPopup } = await import("firebase/auth");

    const err = new Error("boom");
    err.code = "auth/network-request-failed";
    signInWithPopup.mockRejectedValueOnce(err);

    render(<LoginScreen />);
    const btn = screen.getByRole("button", { name: /Sign in with Google/ });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText("Sign-in failed. Please try again.")).toBeTruthy();
    });
    // Button is clickable again (loading reset)
    expect(screen.getByRole("button", { name: /Sign in with Google/ }).disabled).toBe(false);
  });
});
