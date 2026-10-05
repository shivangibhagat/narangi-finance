import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { MONTHS, YEARS } from "../constants/theme";

// ─── Mocks (same shape as smoke.test.jsx — signed-in user, empty Firestore) ─
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

afterEach(() => {
  cleanup();
  // NOTE: no vi.unstubAllGlobals() here — the ResizeObserver stub above must
  // survive across every test in this file.
  vi.restoreAllMocks();
});

// The month/year the app should boot on — mirrors App.jsx's bootDate logic so
// the suite stays correct no matter what day it runs on.
const bootDate = (() => {
  const now = new Date();
  const year = YEARS.includes(now.getFullYear()) ? now.getFullYear() : YEARS[0];
  const visible = year === 2026 ? MONTHS.slice(MONTHS.indexOf("May")) : MONTHS;
  const month = visible.includes(MONTHS[now.getMonth()]) ? MONTHS[now.getMonth()] : visible[0];
  return { year, month };
})();

// Helpers ─────────────────────────────────────────────────────────────────────
async function boot() {
  const rtl = await import("@testing-library/react");
  const { default: App } = await import("../App");
  const view = rtl.render(<App />);
  await rtl.waitFor(() => {
    expect(rtl.screen.getByText(/Annual Overview/)).toBeTruthy();
  });
  return {
    screen: rtl.screen,
    fireEvent: rtl.fireEvent,
    waitFor: rtl.waitFor,
    container: view.container,
  };
}

// From an element containing `labelText`, walk up to the nearest ancestor that
// holds a button whose exact text is `btnText` (i.e. the row), and return it.
function rowButton(screen, labelText, btnText) {
  let node = screen.getAllByText(labelText)[0];
  while (node) {
    const btns = node.querySelectorAll ? node.querySelectorAll("button") : [];
    for (const b of btns) if (b.textContent.trim() === btnText) return b;
    node = node.parentElement;
  }
  throw new Error(`No "${btnText}" button found near "${labelText}"`);
}

// Same walk, but returns the nearest ancestor containing `needle` text AND an
// input with the given placeholder (i.e. the card/section container).
function sectionWith(screen, labelText, inputPlaceholder) {
  let node = screen.getAllByText(labelText)[0];
  while (node) {
    if (node.querySelectorAll && node.querySelector(`input[placeholder="${inputPlaceholder}"]`))
      return node;
    node = node.parentElement;
  }
  throw new Error(`No section with input "${inputPlaceholder}" near "${labelText}"`);
}

async function quickAdd(screen, waitFor, name, amount) {
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.click(screen.getByRole("button", { name: "+" }));
  await waitFor(() => expect(screen.getByText(/Quick Add/)).toBeTruthy());
  fireEvent.change(screen.getByPlaceholderText("What was this for?"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: String(amount) } });
  fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
  await waitFor(() => expect(screen.queryByText(/Quick Add/)).toBeNull());
}

describe("full flow — boot", () => {
  it("opens on the CURRENT month/year (October 2026 today), not a hard-coded month", async () => {
    const { screen } = await boot();
    const { year, month } = bootDate;

    // Header: "Synced · Oct 2026"
    expect(screen.getAllByText(new RegExp(`· ${month} ${year}`)).length).toBeGreaterThan(0);

    // The selected month pill is the current month; the tracking start (May) is visible too
    expect(screen.getByRole("button", { name: month })).toBeTruthy();
    expect(screen.getByRole("button", { name: "May" })).toBeTruthy();

    // Quick-add form defaults its date to the 1st of the CURRENT month
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    const mm = String(MONTHS.indexOf(month) + 1).padStart(2, "0");
    const dateInput = await screen.findByDisplayValue(`${year}-${mm}-01`);
    expect(dateInput).toBeTruthy();
  });
});

describe("full flow — transactions lifecycle", () => {
  it("quick-add → shows in Txns → edit → delete (in-app confirm) → undo", async () => {
    const { screen, waitFor, fireEvent } = await boot();

    await quickAdd(screen, waitFor, "FlowTest Coffee", 250);

    // Appears on the Txns tab
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => expect(screen.getByText("FlowTest Coffee")).toBeTruthy());

    // Edit via the row's ✏️
    fireEvent.click(rowButton(screen, "FlowTest Coffee", "✏️"));
    await waitFor(() => expect(screen.getByText(/Edit Transaction/)).toBeTruthy());
    const editInput = screen
      .getAllByPlaceholderText("What was this for?")
      .find((i) => i.value === "FlowTest Coffee");
    fireEvent.change(editInput, { target: { value: "FlowTest Lunch" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.getByText("FlowTest Lunch")).toBeTruthy());
    expect(screen.queryByText("FlowTest Coffee")).toBeNull();

    // Delete → in-app confirm (never window.confirm) → undo
    const confirmSpy = vi.spyOn(window, "confirm");
    fireEvent.click(rowButton(screen, "FlowTest Lunch", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete transaction?")).toBeTruthy());
    expect(confirmSpy).not.toHaveBeenCalled();

    // Cancel keeps it
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Delete transaction?")).toBeNull());
    expect(screen.getByText("FlowTest Lunch")).toBeTruthy();

    // Confirm deletes it with an undo toast
    fireEvent.click(rowButton(screen, "FlowTest Lunch", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete transaction?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText('Deleted "FlowTest Lunch"')).toBeTruthy()
    );
    expect(screen.queryByText("FlowTest Lunch")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByText("Change undone")).toBeTruthy();
      expect(screen.getByText("FlowTest Lunch")).toBeTruthy();
    });
  });

  it("adds via the Txns-tab inline form, searches, and filters by person", async () => {
    const { screen, waitFor, fireEvent } = await boot();

    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    // Inline desktop form renders its own TxnForm (title + inputs)
    await waitFor(() =>
      expect(screen.getAllByPlaceholderText("What was this for?").length).toBeGreaterThan(0)
    );

    const inputs = screen.getAllByPlaceholderText("What was this for?");
    fireEvent.change(inputs[0], { target: { value: "FlowTest Groceries" } });
    const amounts = screen.getAllByPlaceholderText("0");
    fireEvent.change(amounts[0], { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
    await waitFor(() => expect(screen.getByText("FlowTest Groceries")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Added: FlowTest Groceries/)).toBeTruthy());

    // Search narrows the list
    fireEvent.change(screen.getByPlaceholderText(/Search description/), {
      target: { value: "Groceries" },
    });
    expect(screen.getByText("FlowTest Groceries")).toBeTruthy();

    // Person filter: SHIVU has no txns → empty state.
    // Two "SHIVU" buttons exist (TxnForm's person selector + the filter pill);
    // the filter pill renders after the form in the DOM.
    const shivuBtns = screen.getAllByRole("button", { name: "SHIVU" });
    fireEvent.click(shivuBtns[shivuBtns.length - 1]);
    await waitFor(() => expect(screen.getByText(/No transactions found/)).toBeTruthy());
    const narrBtns = screen.getAllByRole("button", { name: "NARR" });
    fireEvent.click(narrBtns[narrBtns.length - 1]);
    await waitFor(() => expect(screen.getByText("FlowTest Groceries")).toBeTruthy());
  });
});

describe("full flow — month & year navigation", () => {
  it("switches months and years, keeping month validity per year", async () => {
    const { screen, waitFor, fireEvent } = await boot();

    // Jump to June (visible for the start year 2026)
    fireEvent.click(screen.getByRole("button", { name: "Jun" }));
    await waitFor(() =>
      expect(screen.getAllByText(new RegExp(`· Jun ${bootDate.year}`)).length).toBeGreaterThan(0)
    );

    // Year picker → 2027 shows all 12 months and keeps June selected
    fireEvent.click(screen.getByRole("button", { name: `${bootDate.year} ▾` }));
    await waitFor(() => expect(screen.getByText("2027")).toBeTruthy());
    fireEvent.click(screen.getByText("2027"));
    await waitFor(() =>
      expect(screen.getAllByText(/· Jun 2027/).length).toBeGreaterThan(0)
    );
    expect(screen.getByRole("button", { name: "Jan" })).toBeTruthy(); // Jan visible in non-start years
  });
});

describe("full flow — plan tab CRUD", () => {
  it("income: add → edit → delete-with-confirm → undo", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    await waitFor(() => expect(screen.getByText(/Income Sources/)).toBeTruthy());

    // Add
    fireEvent.change(screen.getByPlaceholderText("Source name"), {
      target: { value: "Flow Income" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("₹")[0], { target: { value: "5000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[0]);
    await waitFor(() => expect(screen.getByText("Flow Income")).toBeTruthy());

    // Edit inline
    fireEvent.click(rowButton(screen, "Flow Income", "✏️"));
    fireEvent.change(screen.getByDisplayValue("Flow Income"), {
      target: { value: "Flow Income 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "✓" }));
    await waitFor(() => expect(screen.getByText("Flow Income 2")).toBeTruthy());

    // Delete with confirm + undo
    fireEvent.click(rowButton(screen, "Flow Income 2", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete income source?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText('Deleted income source "Flow Income 2"')).toBeTruthy()
    );
    expect(screen.queryByText("Flow Income 2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByText("Flow Income 2")).toBeTruthy());
  });

  it("fixed expenses, categories, tags, savings goals — add + guarded delete", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    await waitFor(() => expect(screen.getByText(/Income Sources/)).toBeTruthy());

    // Fixed expense add
    fireEvent.change(screen.getByPlaceholderText("Expense name"), {
      target: { value: "Flow Rent" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("₹")[1], { target: { value: "1000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[1]);
    await waitFor(() => expect(screen.getByText("Flow Rent")).toBeTruthy());

    // Variable category add + delete
    fireEvent.change(screen.getByPlaceholderText("NEW CATEGORY"), {
      target: { value: "FLOWCAT" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[2]);
    await waitFor(() => expect(screen.getByText("FLOWCAT")).toBeTruthy());
    fireEvent.click(rowButton(screen, "FLOWCAT", "×"));
    await waitFor(() => expect(screen.getByText("Delete category?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("FLOWCAT")).toBeNull());

    // Custom tag add
    fireEvent.change(screen.getByPlaceholderText("new tag"), {
      target: { value: "flowtag" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[3]);
    await waitFor(() => expect(screen.getByText("flowtag")).toBeTruthy());

    // Savings goal add, then delete-cancel keeps it, delete-confirm removes it
    fireEvent.change(screen.getByPlaceholderText("Goal name"), {
      target: { value: "Flow Goal" },
    });
    fireEvent.change(screen.getByPlaceholderText("Monthly ₹"), { target: { value: "100" } });
    fireEvent.change(screen.getByPlaceholderText("Total goal ₹"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Goal" }));
    await waitFor(() => expect(screen.getByText("Flow Goal")).toBeTruthy());

    fireEvent.click(rowButton(screen, "Flow Goal", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete savings goal?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Delete savings goal?")).toBeNull());
    expect(screen.getByText("Flow Goal")).toBeTruthy();

    fireEvent.click(rowButton(screen, "Flow Goal", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete savings goal?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText('Deleted savings goal "Flow Goal"')).toBeTruthy()
    );
    expect(screen.queryByText("Flow Goal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByText("Flow Goal")).toBeTruthy());
  });
});

describe("full flow — credit cards tab", () => {
  it("add card → set charges → log payment → edit → delete (confirm + undo)", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    fireEvent.click(screen.getByRole("button", { name: /Cards/ }));
    await waitFor(() => expect(screen.getByText(/Total CC Debt/)).toBeTruthy());

    // Add a card
    fireEvent.click(screen.getByRole("button", { name: /Add Credit Card/ }));
    await waitFor(() => expect(screen.getByPlaceholderText("e.g. HDFC Regalia")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("e.g. HDFC Regalia"), {
      target: { value: "Flow Card" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Card" }));
    await waitFor(() => expect(screen.getByText("Flow Card")).toBeTruthy());

    // Monthly statement: set new charges → closing balance reflects them
    const sec = sectionWith(screen, "Flow Card", "0");
    const chargeInput = sec.querySelector('input[placeholder="0"]');
    fireEvent.change(chargeInput, { target: { value: "500" } });
    await waitFor(() => expect(screen.getByText("₹500")).toBeTruthy());

    // Log a payment → becomes a CC PAYMENT transaction
    const payBtn = Array.from(sec.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Log Payment")
    );
    fireEvent.click(payBtn);
    await waitFor(() => expect(screen.getByPlaceholderText("Amount ₹")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Amount ₹"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Payment" }));
    // Recent payments row shows up (date — note) with the paid amount
    await waitFor(() =>
      expect(screen.getAllByText(/— Payment/).length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("₹200").length).toBeGreaterThan(0);

    // Edit the card name
    fireEvent.click(rowButton(screen, "Flow Card", "✏️"));
    fireEvent.change(screen.getByDisplayValue("Flow Card"), {
      target: { value: "Flow Card 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Flow Card 2")).toBeTruthy());

    // Delete with confirm + undo
    fireEvent.click(rowButton(screen, "Flow Card 2", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete credit card?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText('Deleted card "Flow Card 2"')).toBeTruthy()
    );
    await waitFor(() => expect(screen.queryByText("Flow Card 2")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByText("Flow Card 2")).toBeTruthy());
  });
});

describe("full flow — more tab: exports, restore, clear-all, activity", () => {
  it("CSV/JSON exports succeed when the browser supports downloads", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    await quickAdd(screen, waitFor, "ExportMe", 99);

    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    await waitFor(() => expect(screen.getByText(/Data & Backup/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Transactions CSV/ }));
    await waitFor(() =>
      expect(screen.getByText("Transactions exported as CSV")).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: /Full Backup/ }));
    await waitFor(() => expect(screen.getByText("Full backup downloaded")).toBeTruthy());
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);

    // Without download support the app degrades gracefully (no crash)
    delete URL.createObjectURL;
    fireEvent.click(screen.getByRole("button", { name: /Transactions CSV/ }));
    await waitFor(() =>
      expect(screen.getByText("Export failed in this browser")).toBeTruthy()
    );
  });

  it("restore: rejects bad files, replaces data from a good one, and is undoable", async () => {
    const { screen, waitFor, fireEvent, container } = await boot();
    await quickAdd(screen, waitFor, "Original Txn", 111);

    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    await waitFor(() => expect(screen.getByText(/Data & Backup/)).toBeTruthy());
    const fileInput = container.querySelector('input[type="file"]');

    // 1) Invalid JSON → friendly error, nothing changes
    fireEvent.change(fileInput, {
      target: { files: [new File(["{nope"], "bad.json", { type: "application/json" })] },
    });
    await waitFor(() =>
      expect(screen.getByText(/Restore failed: Not a valid JSON file/)).toBeTruthy()
    );

    // 2) Valid JSON without transactions → friendly error
    fireEvent.change(fileInput, {
      target: { files: [new File(["{}"], "empty.json", { type: "application/json" })] },
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Restore failed: No transactions found in this file/)
      ).toBeTruthy()
    );

    // 3) A real backup → confirm → data replaced → undo restores prior state
    const backup = {
      app: "narangi-finance",
      version: 1,
      exportedAt: "2026-10-01T00:00:00.000Z",
      exportedBy: "test",
      counts: { transactions: 1 },
      data: {
        transactions: [
          {
            id: "bk1",
            date: `${bootDate.year}-${String(MONTHS.indexOf(bootDate.month) + 1).padStart(2, "0")}-02`,
            spentOn: "Backup Seed Txn",
            amount: 77,
            category: "VARIABLE EXPENSES",
            subCat: "SHOPPING",
            person: "NARR",
            tags: [],
            note: "",
          },
        ],
      },
    };
    fireEvent.change(fileInput, {
      target: {
        files: [new File([JSON.stringify(backup)], "backup.json", { type: "application/json" })],
      },
    });
    await waitFor(() => expect(screen.getByText("Restore backup?")).toBeTruthy());
    // The confirm message quotes the backup's contents
    expect(screen.getByText(/Replace ALL current shared data/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.getByText("Backup restored")).toBeTruthy());

    // The restored data is live; the old txn is gone
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => expect(screen.getByText("Backup Seed Txn")).toBeTruthy());
    expect(screen.queryByText("Original Txn")).toBeNull();

    // Undo brings the pre-restore state back
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByText("Change undone")).toBeTruthy();
      expect(screen.getByText("Original Txn")).toBeTruthy();
    });
    expect(screen.queryByText("Backup Seed Txn")).toBeNull();
  });

  it("clear all data: wipes everything to the starter template, undoable", async () => {
    const { screen, waitFor, fireEvent } = await boot();

    // Enter some real data first: a txn + a custom income source
    await quickAdd(screen, waitFor, "SoonToVanish", 42);
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    await waitFor(() => expect(screen.getByText(/Income Sources/)).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Source name"), {
      target: { value: "Temp Income" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("₹")[0], { target: { value: "777" } });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[0]);
    await waitFor(() => expect(screen.getByText("Temp Income")).toBeTruthy());

    // Clear everything from the More tab
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    await waitFor(() => expect(screen.getByText(/Fresh Start/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Clear All Data/ }));
    await waitFor(() => expect(screen.getByText("Clear all data?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Clear everything" }));
    await waitFor(() => expect(screen.getByText("All data cleared")).toBeTruthy());

    // Activity trail records the wipe
    expect(
      screen.getByText("Cleared all data and reset to the starter template")
    ).toBeTruthy();

    // Transactions are gone; plan is back to the starter template
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => expect(screen.getByText(/No transactions found/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    await waitFor(() => expect(screen.queryByText("Temp Income")).toBeNull());
    expect(screen.getByText("NARR Salary")).toBeTruthy(); // template restored

    // Undo brings EVERYTHING back
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByText("Change undone")).toBeTruthy();
      expect(screen.getByText("Temp Income")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    await waitFor(() => expect(screen.getByText("SoonToVanish")).toBeTruthy());
  });

  it("activity log records the full trail of actions, newest first", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    await quickAdd(screen, waitFor, "TrailTxn", 15);

    fireEvent.click(screen.getByRole("button", { name: /Txns/ }));
    fireEvent.click(rowButton(screen, "TrailTxn", "🗑"));
    await waitFor(() => expect(screen.getByText("Delete transaction?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByText('Deleted "TrailTxn"')).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    await waitFor(() => expect(screen.getByText(/Recent Activity/)).toBeTruthy());
    const details = screen.getAllByText(/TrailTxn/).map((n) => n.textContent);
    const delIdx = details.findIndex((t) => t.startsWith("Deleted"));
    const addIdx = details.findIndex((t) => t.startsWith("Added"));
    expect(delIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(-1);
    expect(delIdx).toBeLessThan(addIdx); // newest (delete) above older (add)
    expect(screen.getAllByText(/test · /).length).toBeGreaterThan(0); // actor = email prefix
  });
});

describe("full flow — sign out", () => {
  it("user menu signs out via Firebase auth", async () => {
    const { screen, waitFor, fireEvent } = await boot();
    const { signOut } = await import("firebase/auth");

    fireEvent.click(screen.getByRole("button", { name: /👤 Test/ }));
    await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
    fireEvent.click(screen.getByText(/Sign Out/));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
