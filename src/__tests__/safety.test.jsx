import { describe, it, expect, vi, beforeAll } from "vitest";

// ─── Mocks (same as smoke.test.jsx) ─────────────────────────────────────────
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

describe("safety pack — delete confirm, undo toast, activity log", () => {
  it("quick-adds a txn, deletes it via the confirm dialog, then undoes", async () => {
    const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
    const { default: App } = await import("../App");

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Annual Overview/)).toBeTruthy();
    });

    // 1. Quick-add a transaction
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    await waitFor(() => {
      expect(screen.getByText(/Quick Add/)).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
      target: { value: "UndoMe-Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));

    // 2. It shows up on the Txns tab
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => {
      expect(screen.getByText("UndoMe-Test")).toBeTruthy();
    });

    // 3. Delete asks for in-app confirmation (no window.confirm anywhere)
    const confirmSpy = vi.spyOn(window, "confirm");
    fireEvent.click(screen.getByRole("button", { name: "🗑" }));
    await waitFor(() => {
      expect(screen.getByText("Delete transaction?")).toBeTruthy();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();

    // Cancel keeps the transaction…
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete transaction?")).toBeNull();
    });
    expect(screen.getByText("UndoMe-Test")).toBeTruthy();

    // …and confirming deletes it with an undo toast
    fireEvent.click(screen.getByRole("button", { name: "🗑" }));
    await waitFor(() => {
      expect(screen.getByText("Delete transaction?")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.getByText('Deleted "UndoMe-Test"')).toBeTruthy();
    });
    expect(screen.queryByText("UndoMe-Test")).toBeNull();

    // 4. Undo restores the transaction
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByText("Change undone")).toBeTruthy();
      expect(screen.getByText("UndoMe-Test")).toBeTruthy();
    });

    // 5. The More tab shows backup actions + the full activity trail
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    await waitFor(() => {
      expect(screen.getByText(/Data & Backup/)).toBeTruthy();
      expect(screen.getByText(/Recent Activity/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Transactions CSV/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Full Backup/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Restore from Backup/ })).toBeTruthy();
    expect(screen.getByText("Undid the last change")).toBeTruthy();
    expect(screen.getByText('Deleted "UndoMe-Test" · ₹500')).toBeTruthy();
    expect(screen.getByText('Added "UndoMe-Test" · ₹500')).toBeTruthy();
  });
});
