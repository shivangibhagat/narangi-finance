import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULTS } from "../constants/defaults";
import { mergeData, cleanForDb } from "../utils/finance";

export const FIRESTORE_DOC = doc(db, "narangi-finance", "shared-data");

export function useFirestoreSync(user) {
  const [s, setS] = useState({ ...DEFAULTS, transactions: [] });
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const isRemote = useRef(false);
  const saveTimer = useRef(null);
  const isSavingRef = useRef(false);
  const isManualSave = useRef(false);
  const pendingRemoteRef = useRef(null);

  const applyRemoteSnapshot = useCallback((snap) => {
    isRemote.current = true;
    if (snap.exists()) setS(mergeData(snap.data()));
    else {
      const init = { ...DEFAULTS, transactions: [] };
      setDoc(FIRESTORE_DOC, cleanForDb(init));
      setS(init);
    }
    setSyncStatus("live");
    setLoaded(true);
  }, []);

  const flushPendingRemote = useCallback(() => {
    if (pendingRemoteRef.current) {
      const snap = pendingRemoteRef.current;
      pendingRemoteRef.current = null;
      applyRemoteSnapshot(snap);
    }
  }, [applyRemoteSnapshot]);

  useEffect(() => {
    if (!user) {
      setLoaded(false);
      return;
    }
    setLoaded(false);
    setSyncStatus("connecting");
    const unsub = onSnapshot(
      FIRESTORE_DOC,
      (snap) => {
        if (isSavingRef.current) {
          pendingRemoteRef.current = snap;
          return;
        }
        applyRemoteSnapshot(snap);
      },
      (err) => {
        console.error("Firestore:", err);
        setSyncStatus("error");
        setLoaded(true);
      }
    );
    return unsub;
  }, [user?.uid, applyRemoteSnapshot]);

  const saveNow = useCallback(
    (newState) => {
      clearTimeout(saveTimer.current);
      isManualSave.current = true;
      isSavingRef.current = true;
      setSyncStatus("saving");
      setDoc(FIRESTORE_DOC, cleanForDb(newState))
        .then(() => {
          isSavingRef.current = false;
          setSyncStatus("live");
          flushPendingRemote();
        })
        .catch((e) => {
          isSavingRef.current = false;
          setSyncStatus("error");
          console.error("Save error:", e);
          flushPendingRemote();
        });
    },
    [flushPendingRemote]
  );

  const saveSoon = useCallback(
    (newState) => {
      clearTimeout(saveTimer.current);
      isSavingRef.current = true;
      setSyncStatus("saving");
      saveTimer.current = setTimeout(() => {
        setDoc(FIRESTORE_DOC, cleanForDb(newState))
          .then(() => {
            isSavingRef.current = false;
            setSyncStatus("live");
            flushPendingRemote();
          })
          .catch((e) => {
            isSavingRef.current = false;
            setSyncStatus("error");
            console.error("Save error:", e);
            flushPendingRemote();
          });
      }, 400);
    },
    [flushPendingRemote]
  );

  useEffect(() => {
    if (!loaded) return;
    if (isRemote.current) {
      isRemote.current = false;
      return;
    }
    if (isManualSave.current) {
      isManualSave.current = false;
      return;
    }
    if (syncStatus === "connecting") return;
    saveSoon(s);
  }, [s, loaded, saveSoon]);

  useEffect(() => {
    const handler = (e) => {
      if (isSavingRef.current) {
        e.preventDefault();
        e.returnValue = "Saving your data — please wait a moment before refreshing.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const upd = useCallback((patch) => {
    setS((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  }, []);

  const updNow = useCallback(
    (patch) => {
      setS((p) => {
        const resolved = typeof patch === "function" ? patch(p) : patch;
        const newS = { ...p, ...resolved };
        saveNow(newS);
        return newS;
      });
    },
    [saveNow]
  );

  return { s, setS, loaded, syncStatus, upd, updNow, saveNow, isSavingRef };
}
