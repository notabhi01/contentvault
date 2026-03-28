import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
//  PASSWORDS — change these before sharing with your team
// ─────────────────────────────────────────────────────────────
const PASSWORDS = {
  owner:    "owner2026",
  manager:  "manager2026",
  teammate: "team2026",
};

// ─────────────────────────────────────────────────────────────
//  Firebase config — CONNECTED ✅
// ─────────────────────────────────────────────────────────────
const FB = {
  apiKey:    "AIzaSyAzCqX4CzYsm0LfMpPKDL9NYEZ-FWKSajg",
  projectId: "contentvault-434f1",
};

const CONFIGURED = true;
const FS = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;

const ROLE_LABELS = { owner: "Owner", manager: "Content Manager", teammate: "Teammate" };
const ROLE_COLORS = { owner: "#f97316", manager: "#a855f7", teammate: "#06b6d4" };
const ROLE_ICONS  = { owner: "👑", manager: "🎯", teammate: "⚡" };

function canSeeAll(role)    { return role === "owner" || role === "manager"; }
function canRemoveAll(role) { return role === "owner" || role === "manager"; }

// ─── Firestore helpers ────────────────────────────────────────
function toObj(doc) {
  const id = doc.name.split("/").pop();
  const obj = { id };
  for (const [k, v] of Object.entries(doc.fields || {}))
    obj[k] = v.stringValue ?? v.booleanValue ?? null;
  return obj;
}
async function fsGet(col) {
  try {
    const r = await fetch(`${FS}/${col}?key=${FB.apiKey}`);
    const d = await r.json();
    return (d.documents || []).map(toObj);
  } catch { return []; }
}
async function fsSet(col, id, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data))
    fields[k] = { stringValue: String(v) };
  await fetch(`${FS}/${col}/${id}?key=${FB.apiKey}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}
async function fsDelete(col, id) {
  await fetch(`${FS}/${col}/${id}?key=${FB.apiKey}`, { method: "DELETE" });
}

// ─── extract Instagram username ───────────────────────────────
function extractUsername(raw) {
  raw = raw.trim();
  const url = raw.match(/instagram\.com\/(?:_u\/)?([^/?#&\s]+)/i);
  if (url) return url[1].toLowerCase().replace(/\/$/, "");
  const at = raw.match(/@([a-zA-Z0-9._]+)/);
  if (at) return at[1].toLowerCase();
  return null;
}

// ─── color from name hash ─────────────────────────────────────
const PALETTE = ["#f97316","#a855f7","#06b6d4","#10b981","#f43f5e","#eab308","#3b82f6"];
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name||"").length; i++) h = (h * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

// ─── local bot brain ──────────────────────────────────────────
function localBot(text, user, accounts) {
  const lower = text.toLowerCase().trim();
  const myAccounts = accounts.filter((a) => a.owner === user.displayName);
  const isAdd    = /\b(add|claim|use|take|mine|save|register|want)\b/.test(lower);
  const isRemove = /\b(remove|delete|drop|release|unassign)\b/.test(lower);
  const isCheck  = /\b(check|available|free|taken|is|does|anyone|who has)\b/.test(lower) && !isAdd;
  const isList   = /\b(list|show|my accounts|my sources|what do i|see all|everyone|all accounts|all sources|team)\b/.test(lower);
  const isHelp   = /\b(help|how|what can|commands|hi|hey|hello|sup|yo)\b/.test(lower);
  const username = extractUsername(text);

  if (isList) {
    if (canSeeAll(user.role) && /\b(all|everyone|team|whole)\b/.test(lower)) {
      if (accounts.length === 0) return { action:"chat", reply:"No accounts claimed by anyone yet!" };
      const grouped = {};
      accounts.forEach(a => { if (!grouped[a.owner]) grouped[a.owner] = []; grouped[a.owner].push("@"+a.username); });
      const lines = Object.entries(grouped).map(([owner, accs]) => `${owner} (${accs.length}):\n${accs.join(", ")}`).join("\n\n");
      return { action:"chat", reply:`Team accounts:\n\n${lines}` };
    }
    if (myAccounts.length === 0) return { action:"chat", reply:"You haven't claimed any accounts yet! Send me a link or @username." };
    return { action:"chat", reply:`Your ${myAccounts.length} account${myAccounts.length>1?"s":""}:\n${myAccounts.map(a=>"• @"+a.username).join("\n")}` };
  }

  if (isRemove) {
    if (!username) return { action:"chat", reply:"Which account should I remove? Send the @username or link." };
    const target = accounts.find((a) => a.username === username);
    if (!target) return { action:"chat", reply:`I can't find @${username} in the system.` };
    if (target.owner !== user.displayName && !canRemoveAll(user.role))
      return { action:"chat", reply:`@${username} belongs to ${target.owner}. Only admins can remove other people's accounts.` };
    return { action:"remove", username, reply:`Done! @${username} has been removed.` };
  }

  if (isCheck && username) {
    const clash = accounts.find((a) => a.username === username);
    if (clash) {
      if (clash.owner === user.displayName) return { action:"chat", reply:`@${username} is already yours! ✅` };
      return { action:"chat", reply: canSeeAll(user.role) ? `@${username} is taken by ${clash.owner} 🚫` : `@${username} is already taken 🚫` };
    }
    return { action:"chat", reply:`@${username} is free! Want me to add it?` };
  }

  if (username) {
    const clash = accounts.find((a) => a.username === username);
    if (clash) {
      if (clash.owner === user.displayName) return { action:"chat", reply:`@${username} is already in your list! ✅` };
      return { action:"chat", reply: canSeeAll(user.role) ? `@${username} is already taken by ${clash.owner} 🚫` : `@${username} is already taken 🚫` };
    }
    return { action:"add", username, reply:`✅ @${username} added to your sources!` };
  }

  if (isHelp) {
    const adminTip = canSeeAll(user.role) ? "\n• Show all team accounts — \"show all accounts\"" : "";
    return { action:"chat", reply:`Hey ${user.displayName}! Here's what I can do:\n\n• Add — paste a link or @username\n• Check — "is @nike taken?"\n• List — "show my accounts"${adminTip}\n• Remove — "remove @nike"\n\nJust talk naturally!` };
  }

  return { action:"chat", reply:`Not sure what you mean. Try sending an Instagram link, a @username, or say "show my accounts".` };
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authScreen, setAuthScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [page, setPage] = useState("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [adminTab, setAdminTab] = useState("accounts");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cv_user");
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.username) {
          setUser(p);
          setMessages([{ role:"assistant", text:`Welcome back, ${p.displayName}! 👋 Send me an Instagram link or @username to get started.` }]);
        }
      }
    } catch {}
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (!user) return;
    refresh();
    pollRef.current = setInterval(refresh, 10000);
    return () => clearInterval(pollRef.current);
  }, [user]);

  async function refresh() {
    setSyncing(true);
    const [s, u] = await Promise.all([fsGet("sources"), fsGet("users")]);
    setAccounts(s); setUsers(u);
    setSyncing(false);
  }

  function detectRole(pass) {
    if (pass === PASSWORDS.owner)    return "owner";
    if (pass === PASSWORDS.manager)  return "manager";
    if (pass === PASSWORDS.teammate) return "teammate";
    return null;
  }

  async function handleSignup() {
    const displayName = nameInput.trim();
    const pass = passInput.trim();
    if (!displayName) { setAuthError("Please enter your name."); return; }
    if (displayName.length < 2) { setAuthError("Name must be at least 2 characters."); return; }
    const role = detectRole(pass);
    if (!role) { setAuthError("Wrong password. Ask your manager for the correct one."); return; }
    const username = displayName.toLowerCase().replace(/\s+/g, "_");
    setAuthLoading(true); setAuthError("");
    try {
      const existingUsers = await fsGet("users");
      const clash = existingUsers.find((u) => u.username === username || u.displayName?.toLowerCase() === displayName.toLowerCase());
      if (clash) { setAuthError(`"${displayName}" is already taken. Choose a different name.`); setAuthLoading(false); return; }
      const userData = { username, displayName, role, createdAt: new Date().toISOString().slice(0, 10) };
      await fsSet("users", username, userData);
      const sessionData = { username, displayName, role };
      localStorage.setItem("cv_user", JSON.stringify(sessionData));
      setUser(sessionData);
      setMessages([{ role:"assistant", text:`Hey ${displayName}! 👋 You're in as ${ROLE_LABELS[role]} ${ROLE_ICONS[role]}\n\nSend me an Instagram link or @username to claim it!` }]);
    } catch { setAuthError("Something went wrong. Try again."); }
    finally { setAuthLoading(false); }
  }

  async function handleLogin() {
    const displayName = nameInput.trim();
    const pass = passInput.trim();
    if (!displayName) { setAuthError("Please enter your name."); return; }
    const role = detectRole(pass);
    if (!role) { setAuthError("Wrong password."); return; }
    const username = displayName.toLowerCase().replace(/\s+/g, "_");
    setAuthLoading(true); setAuthError("");
    try {
      const existingUsers = await fsGet("users");
      const found = existingUsers.find((u) => u.username === username);
      if (!found) { setAuthError("Account not found. Sign up first!"); setAuthLoading(false); return; }
      if (found.role !== role) { setAuthError("Wrong password for this account."); setAuthLoading(false); return; }
      const sessionData = { username, displayName: found.displayName, role: found.role };
      localStorage.setItem("cv_user", JSON.stringify(sessionData));
      setUser(sessionData);
      setMessages([{ role:"assistant", text:`Welcome back, ${found.displayName}! ${ROLE_ICONS[found.role]} What do you need today?` }]);
    } catch { setAuthError("Something went wrong. Try again."); }
    finally { setAuthLoading(false); }
  }

  function handleAuthKey(e) { if (e.key === "Enter") authScreen==="login" ? handleLogin() : handleSignup(); }

  function logout() {
    localStorage.removeItem("cv_user");
    setUser(null); setNameInput(""); setPassInput(""); setAuthError(""); setMessages([]); setMenuOpen(false); setPage("chat");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newHistory = [...messages, { role:"user", text }];
    setMessages(newHistory);
    setLoading(true);
    const fresh = await fsGet("sources");
    setAccounts(fresh);
    const { action, username, reply } = localBot(text, user, fresh);
    if (action === "add" && username) {
      const entry = { username, owner: user.displayName, role: user.role, addedAt: new Date().toISOString().slice(0, 10), igLink: `https://instagram.com/${username}` };
      await fsSet("sources", username, entry);
      setAccounts(await fsGet("sources"));
    } else if (action === "remove" && username) {
      await fsDelete("sources", username);
      setAccounts(await fsGet("sources"));
    }
    await new Promise((r) => setTimeout(r, 300));
    setMessages([...newHistory, { role:"assistant", text: reply }]);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleChatKey(e) { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

  async function adminRemove(username) {
    await fsDelete("sources", username);
    await refresh();
  }

  const myAccounts = accounts.filter((a) => a.owner === user?.displayName);
  const color = user ? ROLE_COLORS[user.role] : "#f97316";

  // ── AUTH ──────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#08080f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", padding:24 }}>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>⚡</div>
        <div style={{ color:"#fff", fontSize:26, fontWeight:900, letterSpacing:-1 }}>ContentVault</div>
        <div style={{ color:"#444", fontSize:13, marginTop:5 }}>Team content source tracker</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {Object.entries(ROLE_LABELS).map(([r, label]) => (
          <div key={r} style={{ background: ROLE_COLORS[r]+"15", border:`1px solid ${ROLE_COLORS[r]}44`, borderRadius:20, padding:"4px 12px", fontSize:11, color: ROLE_COLORS[r], fontWeight:700 }}>
            {ROLE_ICONS[r]} {label}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", background:"#111118", borderRadius:12, padding:4, marginBottom:24, width:"100%", maxWidth:320 }}>
        {["login","signup"].map((t) => (
          <button key={t} onClick={() => { setAuthScreen(t); setAuthError(""); }} style={{ flex:1, background: authScreen===t?"#1e1e2e":"transparent", border:"none", borderRadius:9, padding:"9px 0", color: authScreen===t?"#fff":"#555", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}>
            {t==="login" ? "Log In" : "Sign Up"}
          </button>
        ))}
      </div>

      <div style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:"#555", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Your Name</div>
          <input value={nameInput} onChange={e => { setNameInput(e.target.value); setAuthError(""); }} onKeyDown={handleAuthKey}
            placeholder={authScreen==="signup" ? "Enter your real name..." : "Enter your name"}
            style={{ width:"100%", background:"#111118", border:"1.5px solid #1e1e2e", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} autoFocus />
        </div>
        <div>
          <div style={{ fontSize:11, color:"#555", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Password</div>
          <div style={{ position:"relative" }}>
            <input type={showPass?"text":"password"} value={passInput} onChange={e => { setPassInput(e.target.value); setAuthError(""); }} onKeyDown={handleAuthKey}
              placeholder="Enter your role password"
              style={{ width:"100%", background:"#111118", border:"1.5px solid #1e1e2e", borderRadius:12, padding:"12px 44px 12px 14px", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
            <button onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>{showPass?"🙈":"👁️"}</button>
          </div>
          <div style={{ fontSize:11, color:"#333", marginTop:6 }}>Each role has its own password — Owner, Manager, or Teammate.</div>
        </div>

        {authError && <div style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:10, padding:"10px 13px", color:"#f87171", fontSize:13 }}>{authError}</div>}

        <button onClick={authScreen==="login" ? handleLogin : handleSignup} disabled={authLoading||!nameInput.trim()||!passInput.trim()}
          style={{ background: authLoading||!nameInput.trim()||!passInput.trim()?"#1e1e2e":"linear-gradient(135deg,#f97316,#a855f7)", color:"#fff", border:"none", borderRadius:12, padding:"14px", fontWeight:800, fontSize:15, cursor: authLoading||!nameInput.trim()||!passInput.trim()?"not-allowed":"pointer", transition:"all .15s", marginTop:4 }}>
          {authLoading ? "…" : authScreen==="login" ? "Log In →" : "Create Account →"}
        </button>

        <div style={{ textAlign:"center", fontSize:12, color:"#333", marginTop:4 }}>
          {authScreen==="login" ? "New here? " : "Already have an account? "}
          <button onClick={() => { setAuthScreen(authScreen==="login"?"signup":"login"); setAuthError(""); }} style={{ background:"none", border:"none", color:"#f97316", cursor:"pointer", fontSize:12, fontWeight:700, padding:0 }}>
            {authScreen==="login" ? "Sign Up" : "Log In"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── MAIN APP ──────────────────────────────────────────────────
  const navItems = [
    { id:"chat",    icon:"💬", label:"Chat with Vault" },
    { id:"sources", icon:"📋", label: canSeeAll(user.role) ? "All Sources" : "My Sources" },
    ...(canSeeAll(user.role) ? [{ id:"admin", icon:"🛡️", label:"Admin Panel" }] : []),
    { id:"profile", icon:"👤", label:"My Profile" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#08080f", fontFamily:"'DM Sans',sans-serif", color:"#fff", display:"flex", flexDirection:"column", position:"relative" }}>

      {/* top bar */}
      <div style={{ background:"#0d0d14", borderBottom:"1px solid #1a1a26", padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>⚡</div>
          <div>
            <span style={{ fontWeight:900, fontSize:15, letterSpacing:-0.5 }}>{navItems.find(n=>n.id===page)?.label || "Vault"}</span>
            <span style={{ marginLeft:8, fontSize:10, background:ROLE_COLORS[user.role]+"20", color:ROLE_COLORS[user.role], borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span>
          </div>
          {syncing && <span style={{ fontSize:10, color:"#444" }}>• syncing</span>}
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, padding:6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width:20, height:2, borderRadius:2, background: menuOpen?(i===1?"transparent":"#f97316"):"#666", transition:"all .2s", transform: menuOpen?(i===0?"rotate(45deg) translate(4px,4px)":i===2?"rotate(-45deg) translate(4px,-4px)":""):"" }} />)}
        </button>
      </div>

      {/* slide menu */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex" }} onClick={() => setMenuOpen(false)}>
          <div style={{ flex:1 }} />
          <div style={{ width:256, background:"#0d0d14", borderLeft:"1px solid #1a1a26", padding:"60px 0 24px", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"0 20px 20px", borderBottom:"1px solid #1a1a26", marginBottom:8 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20, color, marginBottom:10 }}>{user.displayName[0].toUpperCase()}</div>
              <div style={{ fontWeight:800, fontSize:16 }}>{user.displayName}</div>
              <div style={{ fontSize:12, color:"#444", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ background:color+"20", color, borderRadius:20, padding:"2px 8px", fontWeight:700, fontSize:11 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span>
                <span>· {myAccounts.length} sources</span>
              </div>
            </div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setPage(item.id); setMenuOpen(false); }} style={{ background: page===item.id?color+"15":"none", border:"none", cursor:"pointer", padding:"13px 20px", color: page===item.id?color:"#666", fontWeight: page===item.id?700:400, fontSize:14, display:"flex", alignItems:"center", gap:12, textAlign:"left", borderLeft: page===item.id?`3px solid ${color}`:"3px solid transparent", transition:"all .15s" }}>
                <span style={{ fontSize:17 }}>{item.icon}</span> {item.label}
              </button>
            ))}
            <div style={{ flex:1 }} />
            <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", padding:"13px 20px", color:"#4a1a1a", fontSize:13, display:"flex", alignItems:"center", gap:10 }}>↩ Log out</button>
          </div>
        </div>
      )}

      {/* CHAT */}
      {page==="chat" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
          <div style={{ flex:1, overflow:"auto", padding:"20px 16px 8px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent: m.role==="user"?"flex-end":"flex-start", marginBottom:12, alignItems:"flex-end", gap:8 }}>
                {m.role==="assistant" && <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚡</div>}
                <div style={{ maxWidth:"76%", background: m.role==="user"?color:"#111118", color:"#fff", borderRadius: m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 14px", fontSize:14, lineHeight:1.6, border: m.role==="assistant"?"1px solid #1a1a26":"none", whiteSpace:"pre-wrap" }}>{m.text}</div>
                {m.role==="user" && <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color }}>{user.displayName[0].toUpperCase()}</div>}
              </div>
            ))}
            {loading && (
              <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:12 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚡</div>
                <div style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:"18px 18px 18px 4px", padding:"12px 16px", display:"flex", gap:5, alignItems:"center" }}>
                  {[0,1,2].map(d => <span key={d} style={{ width:6, height:6, borderRadius:"50%", background:"#f97316", display:"inline-block", animation:`bounce 1s ${d*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding:"6px 16px", display:"flex", gap:7, flexWrap:"wrap" }}>
            {["Show my accounts","Is @username available?","Add instagram.com/...",
              ...(canSeeAll(user.role)?["Show all team accounts"]:[])
            ].map(s => (
              <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:20, padding:"5px 12px", color:"#555", fontSize:11, fontWeight:600, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, padding:"10px 16px 16px", background:"#0d0d14", borderTop:"1px solid #1a1a26" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleChatKey} placeholder="Paste a link, @username, or ask anything…" rows={1} style={{ flex:1, background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:14, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }} />
            <button onClick={send} disabled={loading||!input.trim()} style={{ background: loading||!input.trim()?"#1a1a26":color, color:"#fff", border:"none", borderRadius:12, width:44, height:44, cursor: loading||!input.trim()?"not-allowed":"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, alignSelf:"flex-end", transition:"background .15s" }}>➤</button>
          </div>
        </div>
      )}

      {/* SOURCES */}
      {page==="sources" && (
        <div style={{ flex:1, overflow:"auto", padding:20 }}>
          {canSeeAll(user.role) ? (
            <>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>All Team Sources <span style={{ color:"#444", fontWeight:400, fontSize:13 }}>({accounts.length})</span></div>
              {accounts.length === 0
                ? <div style={{ textAlign:"center", padding:"60px 20px", color:"#333" }}><div style={{ fontSize:40 }}>📭</div><div style={{ fontSize:14, marginTop:12 }}>No accounts claimed yet.</div></div>
                : Object.entries(accounts.reduce((acc, a) => { if (!acc[a.owner]) acc[a.owner]=[]; acc[a.owner].push(a); return acc; }, {})).map(([owner, accs]) => (
                  <div key={owner} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:nameColor(owner)+"22", border:`1.5px solid ${nameColor(owner)}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:nameColor(owner) }}>{owner[0].toUpperCase()}</div>
                      <span style={{ fontWeight:700, fontSize:14 }}>{owner}</span>
                      <span style={{ fontSize:12, color:"#444" }}>{accs.length} sources</span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {accs.map(a => (
                        <div key={a.id} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:12, padding:"11px 14px", display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13 }}>@{a.username}</div><div style={{ fontSize:11, color:"#444", marginTop:1 }}>Added {a.addedAt}</div></div>
                          <a href={a.igLink} target="_blank" rel="noreferrer" style={{ background:"#1a1a26", borderRadius:7, color:"#666", fontSize:11, padding:"4px 9px", textDecoration:"none", fontWeight:600 }}>Open ↗</a>
                          <button onClick={() => adminRemove(a.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a1a1a", fontSize:15, padding:4 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              }
            </>
          ) : (
            <>
              <div style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20, color, flexShrink:0 }}>{user.displayName[0].toUpperCase()}</div>
                <div><div style={{ fontWeight:800 }}>{user.displayName}</div><div style={{ fontSize:12, color:"#444", marginTop:2 }}>{myAccounts.length} sources claimed</div></div>
              </div>
              {myAccounts.length === 0
                ? <div style={{ textAlign:"center", padding:"60px 20px", color:"#333" }}><div style={{ fontSize:40, marginBottom:12 }}>📭</div><div style={{ fontSize:14, marginBottom:16 }}>No accounts yet!</div><button onClick={() => setPage("chat")} style={{ background:color, color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:14 }}>Go to Chat →</button></div>
                : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {myAccounts.sort((a,b)=>(b.addedAt||"").localeCompare(a.addedAt||"")).map(a => (
                      <div key={a.id} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:14, padding:"13px 16px", display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:38, height:38, borderRadius:"50%", background:"#1a1a26", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:16, color:"#fff", flexShrink:0 }}>{a.username[0]?.toUpperCase()}</div>
                        <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:14 }}>@{a.username}</div><div style={{ fontSize:11, color:"#444", marginTop:2 }}>Added {a.addedAt}</div></div>
                        <a href={a.igLink} target="_blank" rel="noreferrer" style={{ background:"#1a1a26", borderRadius:8, color:"#666", fontSize:11, padding:"5px 10px", textDecoration:"none", fontWeight:600 }}>Open ↗</a>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}
        </div>
      )}

      {/* ADMIN */}
      {page==="admin" && canSeeAll(user.role) && (
        <div style={{ flex:1, overflow:"auto", padding:20 }}>
          <div style={{ display:"flex", background:"#111118", borderRadius:12, padding:4, marginBottom:20 }}>
            {[{id:"accounts",label:"📋 Accounts"},{id:"members",label:"👥 Members"}].map(t => (
              <button key={t.id} onClick={() => setAdminTab(t.id)} style={{ flex:1, background: adminTab===t.id?"#1e1e2e":"transparent", border:"none", borderRadius:9, padding:"9px 0", color: adminTab===t.id?"#fff":"#555", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}>{t.label}</button>
            ))}
          </div>
          {adminTab==="accounts" && (
            <>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>All Claimed Accounts <span style={{ color:"#444", fontWeight:400, fontSize:13 }}>({accounts.length})</span></div>
              {accounts.length === 0
                ? <div style={{ textAlign:"center", padding:"40px 20px", color:"#333" }}><div style={{ fontSize:36 }}>📭</div><div style={{ marginTop:10, fontSize:14 }}>No accounts yet.</div></div>
                : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {accounts.sort((a,b)=>(b.addedAt||"").localeCompare(a.addedAt||"")).map(a => (
                      <div key={a.id} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:13, padding:"12px 15px", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:"50%", background:nameColor(a.owner)+"22", border:`1.5px solid ${nameColor(a.owner)}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color:nameColor(a.owner), flexShrink:0 }}>{a.owner?.[0]?.toUpperCase()}</div>
                        <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13 }}>@{a.username}</div><div style={{ fontSize:11, color:"#444", marginTop:1 }}>{a.owner} · {a.addedAt}</div></div>
                        <a href={`https://instagram.com/${a.username}`} target="_blank" rel="noreferrer" style={{ background:"#1a1a26", borderRadius:7, color:"#666", fontSize:11, padding:"4px 9px", textDecoration:"none", fontWeight:600, flexShrink:0 }}>Open ↗</a>
                        <button onClick={() => adminRemove(a.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a1a1a", fontSize:15, padding:4, flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}
          {adminTab==="members" && (
            <>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Team Members <span style={{ color:"#444", fontWeight:400, fontSize:13 }}>({users.length})</span></div>
              {users.length === 0
                ? <div style={{ textAlign:"center", padding:"40px 20px", color:"#333" }}><div style={{ fontSize:36 }}>👥</div><div style={{ marginTop:10, fontSize:14 }}>No members yet.</div></div>
                : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {users.sort((a,b)=>{ const o={owner:0,manager:1,teammate:2}; return (o[a.role]||2)-(o[b.role]||2); }).map(u => {
                      const uc = ROLE_COLORS[u.role] || "#888";
                      const ua = accounts.filter(a => a.owner === u.displayName).length;
                      return (
                        <div key={u.id} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:13, padding:"13px 15px", display:"flex", alignItems:"center", gap:12 }}>
                          <div style={{ width:40, height:40, borderRadius:"50%", background:uc+"22", border:`2px solid ${uc}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:16, color:uc, flexShrink:0 }}>{u.displayName?.[0]?.toUpperCase()}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14 }}>{u.displayName}</div>
                            <div style={{ fontSize:11, color:"#444", marginTop:2, display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ background:uc+"20", color:uc, borderRadius:20, padding:"1px 7px", fontWeight:700, fontSize:10 }}>{ROLE_ICONS[u.role]} {ROLE_LABELS[u.role]}</span>
                              <span>{ua} source{ua!==1?"s":""}</span>
                            </div>
                          </div>
                          <div style={{ fontSize:11, color:"#333" }}>Since {u.createdAt||"—"}</div>
                        </div>
                      );
                    })}
                  </div>
              }
            </>
          )}
        </div>
      )}

      {/* PROFILE */}
      {page==="profile" && (
        <div style={{ flex:1, overflow:"auto", padding:20 }}>
          <div style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:18, padding:28, marginBottom:16, textAlign:"center" }}>
            <div style={{ width:76, height:76, borderRadius:"50%", background:color+"22", border:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:30, color, margin:"0 auto 14px" }}>{user.displayName[0].toUpperCase()}</div>
            <div style={{ fontWeight:900, fontSize:22 }}>{user.displayName}</div>
            <div style={{ marginTop:6 }}><span style={{ background:color+"20", color, borderRadius:20, padding:"3px 12px", fontWeight:700, fontSize:12 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span></div>
            <div style={{ fontSize:12, color:"#333", marginTop:8 }}>@{user.username}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[{label:"My sources",value:myAccounts.length,icon:"📋"},{label:"Team total",value:accounts.length,icon:"🌐"}].map(s => (
              <div key={s.label} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:14, padding:"16px 14px" }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:26, fontWeight:900, marginTop:6, color }}>{s.value}</div>
                <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#0a1a0a", border:"1px solid #166534", borderRadius:14, padding:14, marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div style={{ fontSize:13, color:"#4ade80" }}><strong>Firebase connected!</strong> All data is saved and synced live across your whole team.</div>
          </div>
          <button onClick={logout} style={{ width:"100%", background:"#1a0808", border:"1px solid #7f1d1d", borderRadius:14, padding:"14px", color:"#f87171", fontWeight:700, fontSize:14, cursor:"pointer" }}>↩ Log Out</button>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}
