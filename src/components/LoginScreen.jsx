import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { T } from "../constants/theme";

export function LoginScreen() {
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // signInWithPopup is used instead of signInWithRedirect — redirect flow loses
  // the session in modern browsers (Chrome/Safari) due to third-party cookie
  // restrictions; popup completes in the same tab context and is fully reliable.
  const login = async () => {
    setLoading(true);
    setErr("");
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in App.jsx will pick up the new user automatically
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setErr("Sign-in failed. Please try again.");
      }
      setLoading(false);
    }
  };
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360,width:"100%"}}>
        <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px"}}>ðŸª™</div>
        <div style={{fontWeight:800,fontSize:28,color:T.text,marginBottom:8}}>Narangi Finance</div>
        <div style={{color:T.muted,fontSize:14,marginBottom:36}}>Your private family finance tracker</div>
        <button onClick={login} disabled={loading} style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:12,
          width:"100%",padding:"14px 20px",background:T.card,
          border:`1px solid ${T.border}`,borderRadius:14,
          color:T.text,fontSize:15,fontWeight:700,cursor:"pointer",
          WebkitTapHighlightColor:"transparent",
          opacity:loading?0.6:1,
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          {loading ? "Signing inâ€¦" : "Sign in with Google"}
        </button>
        {err&&<div style={{color:T.rose,fontSize:13,marginTop:12}}>{err}</div>}
        <div style={{color:T.muted,fontSize:12,marginTop:24}}>Shared family ledger â€” only Google accounts allowed in Firestore rules can sign in.</div>
      </div>
    </div>
  );
}
