import { useEffect } from "react";

export function useOutsideClick(ref, handler) {
  useEffect(() => {
    const l = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener("mousedown", l);
    document.addEventListener("touchstart", l);
    return () => {
      document.removeEventListener("mousedown", l);
      document.removeEventListener("touchstart", l);
    };
  }, [ref, handler]);
}
