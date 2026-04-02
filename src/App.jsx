import { useState, useEffect, useRef } from "react";

const PASSWORDS = {
  owner:    "owner2026",
  manager:  "manager2026",
  linktree: "linktree2026",
  teammate: "team2026",
};

const FB = {
  apiKey:    "AIzaSyAzCqX4CzYsm0LfMpPKDL9NYEZ-FWKSajg",
  projectId: "contentvault-434f1",
};

const CONFIGURED = true;
const FS = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;

const ROLE_LABELS = { owner: "Owner", manager: "Content Manager", linktree: "Linktree Manager", teammate: "Teammate" };
const ROLE_COLORS = { owner: "#f97316", manager: "#a855f7", linktree: "#10b981", teammate: "#06b6d4" };
const ROLE_ICONS  = { owner: "👑", manager: "🎯", linktree: "🔗", teammate: "⚡" };

function canSeeAll(role)    { return role === "owner" || role === "manager"; }
function canRemoveAll(role) { return role === "owner" || role === "manager"; }
function canBrowse(role)    { return role === "owner" || role === "manager" || role === "linktree"; }
function canEdit(role)      { return role !== "linktree"; }

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
async function fsPatch(col, id, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data))
    fields[k] = { stringValue: String(v) };
  const updateMask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join("&");
  await fetch(`${FS}/${col}/${id}?key=${FB.apiKey}&${updateMask}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

// ─── helpers ──────────────────────────────────────────────────
function extractUsername(raw) {
  raw = raw.trim();
  const url = raw.match(/instagram\.com\/(?:_u\/)?([^/?#&\s]+)/i);
  if (url) return url[1].toLowerCase().replace(/\/$/, "");
  const at = raw.match(/@([a-zA-Z0-9._]+)/);
  if (at) return at[1].toLowerCase();
  return null;
}

const PALETTE = ["#f97316","#a855f7","#06b6d4","#10b981","#f43f5e","#eab308","#3b82f6"];
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name||"").length; i++) h = (h * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Instagram Source Card ────────────────────────────────────
function SourceCard({ account, onVisit, onToggleHot, showOwner, canToggleHot }) {
  const isHot = account.hot === "true";
  const lastVisit = account[`lastVisit_${account.owner?.toLowerCase().replace(/\s+/g,"_")}`] || account.lastVisited;

  function handleOpen() {
    onVisit(account.id);
    window.open(`https://www.instagram.com/${account.username}`, "_blank", "noreferrer");
  }

  return (
    <div style={{
      background: "#111118",
      border: `1.5px solid ${isHot ? "#f9731666" : "#1a1a26"}`,
      borderRadius: 16,
      padding: "14px 16px",
      transition: "border .2s",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* hot glow */}
      {isHot && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#f97316,#f43f5e)", borderRadius:"16px 16px 0 0" }} />}

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {/* avatar */}
        <div style={{
          width:46, height:46, borderRadius:"50%", flexShrink:0,
          background: `linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontWeight:900, fontSize:18, color:"#fff",
          border: isHot ? "2px solid #f97316" : "2px solid #1e1e2e"
        }}>
          {account.username[0]?.toUpperCase()}
        </div>

        {/* info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontWeight:800, fontSize:14, color:"#fff" }}>@{account.username}</span>
            {isHot && <span style={{ fontSize:12 }}>🔥</span>}
          </div>
          {showOwner && <div style={{ fontSize:11, color: nameColor(account.owner), fontWeight:600, marginTop:1 }}>{account.owner}</div>}
          {lastVisit && (
            <div style={{ fontSize:11, color:"#444", marginTop:2 }}>
              👁 Last visited {timeAgo(lastVisit)}
            </div>
          )}
          {!lastVisit && <div style={{ fontSize:11, color:"#333", marginTop:2 }}>Never visited</div>}
        </div>

        {/* actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
          <button onClick={handleOpen} style={{
            background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)",
            color:"#fff", border:"none", borderRadius:10,
            padding:"7px 14px", fontWeight:800, fontSize:12,
            cursor:"pointer", whiteSpace:"nowrap"
          }}>Open ↗</button>
          {canToggleHot && (
            <button onClick={() => onToggleHot(account.id, !isHot)} style={{
              background: isHot ? "#f9731620" : "#1e1e2e",
              color: isHot ? "#f97316" : "#555",
              border: `1px solid ${isHot ? "#f97316" : "#2a2a35"}`,
              borderRadius:10, padding:"5px 10px",
              fontWeight:700, fontSize:11, cursor:"pointer",
              transition:"all .15s"
            }}>{isHot ? "🔥 Hot" : "Mark 🔥"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Browse Teammates ─────────────────────────────────────────
function BrowseTeammates({ accounts, users, onVisit, onToggleHot, viewerRole }) {
  const [expanded, setExpanded] = useState(null);
  const teammates = users.filter(u => u.role === "teammate");

  return (
    <div style={{ flex:1, overflow:"auto", padding:20 }}>
      <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>Browse Teammates</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:16 }}>Tap a name to see their sources</div>
      {teammates.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"#333" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
          <div style={{ fontSize:14 }}>No teammates signed up yet.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {teammates.map(u => {
            const uAccounts = accounts.filter(a => a.owner === u.displayName);
            const isOpen = expanded === u.id;
            const uc = nameColor(u.displayName);
            const hotCount = uAccounts.filter(a => a.hot === "true").length;
            return (
              <div key={u.id} style={{ background:"#111118", border:`1px solid ${isOpen?uc+"66":"#1a1a26"}`, borderRadius:14, overflow:"hidden", transition:"border .2s" }}>
                <button onClick={() => setExpanded(isOpen ? null : u.id)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", padding:"14px 16px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
                  <div style={{ width:42, height:42, borderRadius:"50%", background:uc+"22", border:`2px solid ${uc}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:18, color:uc, flexShrink:0 }}>{u.displayName[0].toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:"#fff" }}>{u.displayName}</div>
                    <div style={{ fontSize:12, color:"#555", marginTop:2, display:"flex", gap:8 }}>
                      <span>{uAccounts.length} sources</span>
                      {hotCount > 0 && <span style={{ color:"#f97316" }}>🔥 {hotCount} hot</span>}
                    </div>
                  </div>
                  <div style={{ color:"#444", fontSize:18, transition:"transform .2s", transform: isOpen?"rotate(90deg)":"rotate(0deg)" }}>›</div>
                </button>
                {isOpen && (
                  <div style={{ borderTop:"1px solid #1a1a26", padding:"12px 16px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                    {uAccounts.length === 0
                      ? <div style={{ color:"#444", fontSize:13 }}>No sources yet.</div>
                      : uAccounts
                          .sort((a,b) => (b.hot==="true"?1:0)-(a.hot==="true"?1:0))
                          .map(a => (
                            <SourceCard
                              key={a.id}
                              account={a}
                              onVisit={onVisit}
                              onToggleHot={onToggleHot}
                              showOwner={false}
                              canToggleHot={canSeeAll(viewerRole)}
                            />
                          ))
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── local bot ────────────────────────────────────────────────
function localBot(text, user, accounts) {
  const lower = text.toLowerCase().trim();
  const myAccounts = accounts.filter((a) => a.owner === user.displayName);
  const isAdd    = /\b(add|claim|use|take|mine|save|register|want)\b/.test(lower);
  const isRemove = /\b(remove|delete|drop|release|unassign)\b/.test(lower);
  const isCheck  = /\b(check|available|free|taken|is|does|anyone|who has)\b/.test(lower) && !isAdd;
  const isList   = /\b(list|show|my accounts|my sources|what do i|see all|everyone|all accounts|all sources|team)\b/.test(lower);
  const isHelp   = /\b(help|how|what can|commands|hi|hey|hello|sup|yo)\b/.test(lower);
  const username = extractUsername(text);

  if (!canEdit(user.role)) {
    return { action:"chat", reply:`As a Linktree Manager you have view-only access. Use "Browse Teammates" from the menu! 🔗` };
  }

  if (isList) {
    if (canSeeAll(user.role) && /\b(all|everyone|team|whole)\b/.test(lower)) {
      if (accounts.length === 0) return { action:"chat", reply:"No accounts claimed by anyone yet!" };
      const grouped = {};
      accounts.forEach(a => { if (!grouped[a.owner]) grouped[a.owner]=[]; grouped[a.owner].push(a.username); });
      const lines = Object.entries(grouped).map(([owner, accs]) => `${owner} (${accs.length}):\n${accs.map(u=>`  instagram.com/${u}`).join("\n")}`).join("\n\n");
      return { action:"chat", reply:`Team accounts:\n\n${lines}` };
    }
    if (myAccounts.length === 0) return { action:"chat", reply:"You haven't claimed any accounts yet! Send me a link or @username." };
    return { action:"chat", reply:`Your ${myAccounts.length} source${myAccounts.length>1?"s":""}:\n${myAccounts.map(a=>`• instagram.com/${a.username}`).join("\n")}` };
  }

  if (isRemove) {
    if (!username) return { action:"chat", reply:"Which account should I remove? Send the @username or link." };
    const target = accounts.find((a) => a.username === username);
    if (!target) return { action:"chat", reply:`Can't find @${username}.` };
    if (target.owner !== user.displayName && !canRemoveAll(user.role))
      return { action:"chat", reply:`@${username} belongs to ${target.owner}. Only admins can remove it.` };
    return { action:"remove", username, reply:`Done! @${username} removed.` };
  }

  if (isCheck && username) {
    const clash = accounts.find((a) => a.username === username);
    if (clash) {
      if (clash.owner === user.displayName) return { action:"chat", reply:`instagram.com/${username} is already yours! ✅` };
      return { action:"chat", reply: canSeeAll(user.role) ? `instagram.com/${username} is taken by ${clash.owner} 🚫` : `instagram.com/${username} is already taken 🚫` };
    }
    return { action:"chat", reply:`instagram.com/${username} is free! Want me to add it?` };
  }

  if (username) {
    const clash = accounts.find((a) => a.username === username);
    if (clash) {
      if (clash.owner === user.displayName) return { action:"chat", reply:`instagram.com/${username} is already yours! ✅` };
      return { action:"chat", reply: canSeeAll(user.role) ? `instagram.com/${username} is taken by ${clash.owner} 🚫` : `instagram.com/${username} is already taken 🚫` };
    }
    return { action:"add", username, reply:`✅ Added! instagram.com/${username} is now yours.` };
  }

  if (isHelp) {
    const adminTip = canSeeAll(user.role) ? "\n• Show all team accounts" : "";
    return { action:"chat", reply:`Hey ${user.displayName}! I can:\n\n• Add — paste a link or @username\n• Check — "is @nike taken?"\n• List — "show my accounts"${adminTip}\n• Remove — "remove @nike"\n\nOr tap "My Sources" in the menu to browse your cards!` };
  }

  return { action:"chat", reply:`Try sending an Instagram link, a @username, or say "show my accounts".` };
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
  const [page, setPage] = useState("sources");
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [adminTab, setAdminTab] = useState("accounts");
  const [searchQuery, setSearchQuery] = useState("");
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
          setMessages([{ role:"assistant", text:`Welcome back, ${p.displayName}! 👋` }]);
        }
      }
    } catch {}
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (!user) return;
    refresh();
    pollRef.current = setInterval(refresh, 12000);
    return () => clearInterval(pollRef.current);
  }, [user]);

  async function refresh() {
    setSyncing(true);
    const [s, u] = await Promise.all([fsGet("sources"), fsGet("users")]);
    setAccounts(s); setUsers(u);
    setSyncing(false);
  }

  // track when user visits an account
  async function handleVisit(accountId) {
    const now = new Date().toISOString();
    const visitKey = `lastVisit_${user.username}`;
    await fsPatch("sources", accountId, { [visitKey]: now, lastVisited: now });
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, [visitKey]: now, lastVisited: now } : a));
  }

  // toggle hot flag
  async function handleToggleHot(accountId, isHot) {
    await fsPatch("sources", accountId, { hot: String(isHot) });
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, hot: String(isHot) } : a));
  }

  function detectRole(pass) {
    if (pass === PASSWORDS.owner)    return "owner";
    if (pass === PASSWORDS.manager)  return "manager";
    if (pass === PASSWORDS.linktree) return "linktree";
    if (pass === PASSWORDS.teammate) return "teammate";
    return null;
  }

  async function handleSignup() {
    const displayName = nameInput.trim();
    const pass = passInput.trim();
    if (!displayName) { setAuthError("Please enter your name."); return; }
    if (displayName.length < 2) { setAuthError("Name too short."); return; }
    const role = detectRole(pass);
    if (!role) { setAuthError("Wrong password. Ask your manager."); return; }
    const username = displayName.toLowerCase().replace(/\s+/g, "_");
    setAuthLoading(true); setAuthError("");
    try {
      const existingUsers = await fsGet("users");
      const clash = existingUsers.find((u) => u.username === username || u.displayName?.toLowerCase() === displayName.toLowerCase());
      if (clash) { setAuthError(`"${displayName}" is already taken.`); setAuthLoading(false); return; }
      await fsSet("users", username, { username, displayName, role, createdAt: new Date().toISOString().slice(0, 10) });
      const sessionData = { username, displayName, role };
      localStorage.setItem("cv_user", JSON.stringify(sessionData));
      setUser(sessionData);
      setMessages([{ role:"assistant", text:`Hey ${displayName}! 👋 You're in as ${ROLE_LABELS[role]} ${ROLE_ICONS[role]}` }]);
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
      setMessages([{ role:"assistant", text:`Welcome back, ${found.displayName}! ${ROLE_ICONS[found.role]}` }]);
    } catch { setAuthError("Something went wrong. Try again."); }
    finally { setAuthLoading(false); }
  }

  function handleAuthKey(e) { if (e.key === "Enter") authScreen==="login" ? handleLogin() : handleSignup(); }
  function logout() {
    localStorage.removeItem("cv_user");
    setUser(null); setNameInput(""); setPassInput(""); setAuthError(""); setMessages([]); setMenuOpen(false); setPage("sources");
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
    if (action === "add" && username && canEdit(user.role)) {
      const entry = { username, owner: user.displayName, role: user.role, addedAt: new Date().toISOString().slice(0, 10), igLink: `https://www.instagram.com/${username}`, hot: "false" };
      await fsSet("sources", username, entry);
      setAccounts(await fsGet("sources"));
    } else if (action === "remove" && username && canEdit(user.role)) {
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
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>⚡</div>
        <div style={{ color:"#fff", fontSize:26, fontWeight:900, letterSpacing:-1 }}>ContentVault</div>
        <div style={{ color:"#444", fontSize:13, marginTop:5 }}>Your daily content source</div>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20, justifyContent:"center" }}>
        {Object.entries(ROLE_LABELS).map(([r, label]) => (
          <div key={r} style={{ background:ROLE_COLORS[r]+"15", border:`1px solid ${ROLE_COLORS[r]}44`, borderRadius:20, padding:"4px 12px", fontSize:11, color:ROLE_COLORS[r], fontWeight:700 }}>{ROLE_ICONS[r]} {label}</div>
        ))}
      </div>
      <div style={{ display:"flex", background:"#111118", borderRadius:12, padding:4, marginBottom:24, width:"100%", maxWidth:320 }}>
        {["login","signup"].map((t) => (
          <button key={t} onClick={() => { setAuthScreen(t); setAuthError(""); }} style={{ flex:1, background:authScreen===t?"#1e1e2e":"transparent", border:"none", borderRadius:9, padding:"9px 0", color:authScreen===t?"#fff":"#555", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}>
            {t==="login"?"Log In":"Sign Up"}
          </button>
        ))}
      </div>
      <div style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:"#555", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Your Name</div>
          <input value={nameInput} onChange={e=>{setNameInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey}
            placeholder={authScreen==="signup"?"Enter your real name...":"Enter your name"}
            style={{ width:"100%", background:"#111118", border:"1.5px solid #1e1e2e", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} autoFocus />
        </div>
        <div>
          <div style={{ fontSize:11, color:"#555", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Password</div>
          <div style={{ position:"relative" }}>
            <input type={showPass?"text":"password"} value={passInput} onChange={e=>{setPassInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey}
              placeholder="Enter your role password"
              style={{ width:"100%", background:"#111118", border:"1.5px solid #1e1e2e", borderRadius:12, padding:"12px 44px 12px 14px", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
            <button onClick={()=>setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>{showPass?"🙈":"👁️"}</button>
          </div>
        </div>
        {authError && <div style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:10, padding:"10px 13px", color:"#f87171", fontSize:13 }}>{authError}</div>}
        <button onClick={authScreen==="login"?handleLogin:handleSignup} disabled={authLoading||!nameInput.trim()||!passInput.trim()}
          style={{ background:authLoading||!nameInput.trim()||!passInput.trim()?"#1e1e2e":"linear-gradient(135deg,#f97316,#a855f7)", color:"#fff", border:"none", borderRadius:12, padding:"14px", fontWeight:800, fontSize:15, cursor:authLoading||!nameInput.trim()||!passInput.trim()?"not-allowed":"pointer", transition:"all .15s", marginTop:4 }}>
          {authLoading?"…":authScreen==="login"?"Log In →":"Create Account →"}
        </button>
        <div style={{ textAlign:"center", fontSize:12, color:"#333", marginTop:4 }}>
          {authScreen==="login"?"New here? ":"Already have an account? "}
          <button onClick={()=>{setAuthScreen(authScreen==="login"?"signup":"login");setAuthError("");}} style={{ background:"none", border:"none", color:"#f97316", cursor:"pointer", fontSize:12, fontWeight:700, padding:0 }}>
            {authScreen==="login"?"Sign Up":"Log In"}
          </button>
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id:"sources", icon:"📱", label: canSeeAll(user.role) ? "All Sources" : "My Sources", show:true },
    { id:"browse",  icon:"🔗", label:"Browse Teammates", show:canBrowse(user.role) },
    { id:"chat",    icon:"💬", label:"Chat with Vault", show:canEdit(user.role) },
    { id:"admin",   icon:"🛡️", label:"Admin Panel", show:canSeeAll(user.role) },
    { id:"profile", icon:"👤", label:"My Profile", show:true },
  ].filter(n=>n.show);

  // filtered accounts for sources page
  const visitKey = `lastVisit_${user.username}`;
  const sourceAccounts = canSeeAll(user.role) ? accounts : myAccounts;
  const filteredAccounts = sourceAccounts
    .filter(a => !searchQuery || a.username.toLowerCase().includes(searchQuery.toLowerCase()) || (a.owner||"").toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a,b) => {
      // hot first, then by last visited, then alphabetical
      if (a.hot==="true" && b.hot!=="true") return -1;
      if (b.hot==="true" && a.hot!=="true") return 1;
      return (a.username||"").localeCompare(b.username||"");
    });
  const hotCount = sourceAccounts.filter(a => a.hot==="true").length;

  return (
    <div style={{ minHeight:"100vh", background:"#08080f", fontFamily:"'DM Sans',sans-serif", color:"#fff", display:"flex", flexDirection:"column", position:"relative" }}>

      {/* top bar */}
      <div style={{ background:"#0d0d14", borderBottom:"1px solid #1a1a26", padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>⚡</div>
          <div>
            <span style={{ fontWeight:900, fontSize:15, letterSpacing:-0.5 }}>{navItems.find(n=>n.id===page)?.label||"Vault"}</span>
            <span style={{ marginLeft:8, fontSize:10, background:ROLE_COLORS[user.role]+"20", color:ROLE_COLORS[user.role], borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span>
          </div>
          {syncing && <span style={{ fontSize:10, color:"#444" }}>• syncing</span>}
        </div>
        <button onClick={()=>setMenuOpen(!menuOpen)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, padding:6 }}>
          {[0,1,2].map(i=><div key={i} style={{ width:20, height:2, borderRadius:2, background:menuOpen?(i===1?"transparent":"#f97316"):"#666", transition:"all .2s", transform:menuOpen?(i===0?"rotate(45deg) translate(4px,4px)":i===2?"rotate(-45deg) translate(4px,-4px)":""):"" }} />)}
        </button>
      </div>

      {/* slide menu */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex" }} onClick={()=>setMenuOpen(false)}>
          <div style={{ flex:1 }} />
          <div style={{ width:256, background:"#0d0d14", borderLeft:"1px solid #1a1a26", padding:"60px 0 24px", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"0 20px 20px", borderBottom:"1px solid #1a1a26", marginBottom:8 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20, color, marginBottom:10 }}>{user.displayName[0].toUpperCase()}</div>
              <div style={{ fontWeight:800, fontSize:16 }}>{user.displayName}</div>
              <div style={{ fontSize:12, color:"#444", marginTop:3 }}>
                <span style={{ background:color+"20", color, borderRadius:20, padding:"2px 8px", fontWeight:700, fontSize:11 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span>
              </div>
            </div>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>{setPage(item.id);setMenuOpen(false);}} style={{ background:page===item.id?color+"15":"none", border:"none", cursor:"pointer", padding:"13px 20px", color:page===item.id?color:"#666", fontWeight:page===item.id?700:400, fontSize:14, display:"flex", alignItems:"center", gap:12, textAlign:"left", borderLeft:page===item.id?`3px solid ${color}`:"3px solid transparent", transition:"all .15s" }}>
                <span style={{ fontSize:17 }}>{item.icon}</span> {item.label}
              </button>
            ))}
            <div style={{ flex:1 }} />
            <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", padding:"13px 20px", color:"#4a1a1a", fontSize:13, display:"flex", alignItems:"center", gap:10 }}>↩ Log out</button>
          </div>
        </div>
      )}

      {/* ── SOURCES — main card view ── */}
      {page==="sources" && (
        <div style={{ flex:1, overflow:"auto", padding:"16px 16px 80px" }}>
          {/* stats bar */}
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            <div style={{ flex:1, background:"#111118", border:"1px solid #1a1a26", borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:22, fontWeight:900, color }}>{sourceAccounts.length}</div>
              <div style={{ fontSize:11, color:"#555", marginTop:1 }}>Total sources</div>
            </div>
            <div style={{ flex:1, background:"#111118", border:"1px solid #f9731622", borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:22, fontWeight:900, color:"#f97316" }}>{hotCount} 🔥</div>
              <div style={{ fontSize:11, color:"#555", marginTop:1 }}>Hot right now</div>
            </div>
          </div>

          {/* search */}
          <input
            value={searchQuery}
            onChange={e=>setSearchQuery(e.target.value)}
            placeholder="Search accounts…"
            style={{ width:"100%", background:"#111118", border:"1px solid #1a1a26", borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit", marginBottom:14, boxSizing:"border-box" }}
          />

          {/* hot section */}
          {hotCount > 0 && !searchQuery && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:"#f97316", fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>🔥 Hot right now</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {sourceAccounts.filter(a=>a.hot==="true").map(a=>(
                  <SourceCard key={a.id} account={a} onVisit={handleVisit} onToggleHot={handleToggleHot} showOwner={canSeeAll(user.role)} canToggleHot={canEdit(user.role)} />
                ))}
              </div>
            </div>
          )}

          {/* all accounts */}
          <div style={{ fontSize:12, color:"#444", fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>
            {searchQuery ? `Results (${filteredAccounts.length})` : "All Sources"}
          </div>

          {filteredAccounts.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#333" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <div style={{ fontSize:14, marginBottom:16 }}>{searchQuery?"No results found.":"No sources yet!"}</div>
              {canEdit(user.role) && !searchQuery && <button onClick={()=>setPage("chat")} style={{ background:color, color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:14 }}>Add via Chat →</button>}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {filteredAccounts.map(a=>(
                <SourceCard key={a.id} account={a} onVisit={handleVisit} onToggleHot={handleToggleHot} showOwner={canSeeAll(user.role)} canToggleHot={canEdit(user.role)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BROWSE TEAMMATES ── */}
      {page==="browse" && canBrowse(user.role) && (
        <BrowseTeammates accounts={accounts} users={users} onVisit={handleVisit} onToggleHot={handleToggleHot} viewerRole={user.role} />
      )}

      {/* ── CHAT ── */}
      {page==="chat" && canEdit(user.role) && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
          <div style={{ flex:1, overflow:"auto", padding:"20px 16px 8px" }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:12, alignItems:"flex-end", gap:8 }}>
                {m.role==="assistant" && <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚡</div>}
                <div style={{ maxWidth:"76%", background:m.role==="user"?color:"#111118", color:"#fff", borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 14px", fontSize:14, lineHeight:1.6, border:m.role==="assistant"?"1px solid #1a1a26":"none", whiteSpace:"pre-wrap" }}>{m.text}</div>
                {m.role==="user" && <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color }}>{user.displayName[0].toUpperCase()}</div>}
              </div>
            ))}
            {loading && (
              <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:12 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#f97316,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚡</div>
                <div style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:"18px 18px 18px 4px", padding:"12px 16px", display:"flex", gap:5, alignItems:"center" }}>
                  {[0,1,2].map(d=><span key={d} style={{ width:6, height:6, borderRadius:"50%", background:"#f97316", display:"inline-block", animation:`bounce 1s ${d*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding:"6px 16px", display:"flex", gap:7, flexWrap:"wrap" }}>
            {["Show my accounts","Is @username available?","Add instagram.com/...",...(canSeeAll(user.role)?["Show all team accounts"]:[])].map(s=>(
              <button key={s} onClick={()=>{setInput(s);inputRef.current?.focus();}} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:20, padding:"5px 12px", color:"#555", fontSize:11, fontWeight:600, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, padding:"10px 16px 16px", background:"#0d0d14", borderTop:"1px solid #1a1a26" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleChatKey} placeholder="Paste instagram.com/... or @username…" rows={1} style={{ flex:1, background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:14, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }} />
            <button onClick={send} disabled={loading||!input.trim()} style={{ background:loading||!input.trim()?"#1a1a26":color, color:"#fff", border:"none", borderRadius:12, width:44, height:44, cursor:loading||!input.trim()?"not-allowed":"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, alignSelf:"flex-end", transition:"background .15s" }}>➤</button>
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page==="admin" && canSeeAll(user.role) && (
        <div style={{ flex:1, overflow:"auto", padding:20 }}>
          <div style={{ display:"flex", background:"#111118", borderRadius:12, padding:4, marginBottom:20 }}>
            {[{id:"accounts",label:"📋 Accounts"},{id:"members",label:"👥 Members"}].map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{ flex:1, background:adminTab===t.id?"#1e1e2e":"transparent", border:"none", borderRadius:9, padding:"9px 0", color:adminTab===t.id?"#fff":"#555", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}>{t.label}</button>
            ))}
          </div>
          {adminTab==="accounts" && (
            <>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>All Accounts <span style={{ color:"#444", fontWeight:400, fontSize:13 }}>({accounts.length})</span></div>
              {accounts.length===0
                ?<div style={{ textAlign:"center", padding:"40px 20px", color:"#333" }}><div style={{ fontSize:36 }}>📭</div><div style={{ marginTop:10, fontSize:14 }}>No accounts yet.</div></div>
                :<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {accounts.sort((a,b)=>(b.addedAt||"").localeCompare(a.addedAt||"")).map(a=>(
                    <div key={a.id} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:13, padding:"12px 15px", display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:"50%", background:nameColor(a.owner)+"22", border:`1.5px solid ${nameColor(a.owner)}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color:nameColor(a.owner), flexShrink:0 }}>{a.owner?.[0]?.toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:13 }}>@{a.username} {a.hot==="true"&&"🔥"}</div>
                        <div style={{ fontSize:11, color:"#444", marginTop:1 }}>{a.owner} · {a.addedAt}</div>
                      </div>
                      <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer" style={{ background:"#1a1a26", borderRadius:7, color:"#666", fontSize:11, padding:"4px 9px", textDecoration:"none", fontWeight:600, flexShrink:0 }}>Open ↗</a>
                      <button onClick={()=>adminRemove(a.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a1a1a", fontSize:15, padding:4, flexShrink:0 }}>✕</button>
                    </div>
                  ))}
                </div>
              }
            </>
          )}
          {adminTab==="members" && (
            <>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Team Members <span style={{ color:"#444", fontWeight:400, fontSize:13 }}>({users.length})</span></div>
              {users.length===0
                ?<div style={{ textAlign:"center", padding:"40px 20px", color:"#333" }}><div style={{ fontSize:36 }}>👥</div><div style={{ marginTop:10, fontSize:14 }}>No members yet.</div></div>
                :<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {users.sort((a,b)=>{const o={owner:0,manager:1,linktree:2,teammate:3};return (o[a.role]||3)-(o[b.role]||3);}).map(u=>{
                    const uc=ROLE_COLORS[u.role]||"#888";
                    const ua=accounts.filter(a=>a.owner===u.displayName).length;
                    return(
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

      {/* ── PROFILE ── */}
      {page==="profile" && (
        <div style={{ flex:1, overflow:"auto", padding:20 }}>
          <div style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:18, padding:28, marginBottom:16, textAlign:"center" }}>
            <div style={{ width:76, height:76, borderRadius:"50%", background:color+"22", border:`3px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:30, color, margin:"0 auto 14px" }}>{user.displayName[0].toUpperCase()}</div>
            <div style={{ fontWeight:900, fontSize:22 }}>{user.displayName}</div>
            <div style={{ marginTop:6 }}><span style={{ background:color+"20", color, borderRadius:20, padding:"3px 12px", fontWeight:700, fontSize:12 }}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[{label:"My sources",value:myAccounts.length,icon:"📱"},{label:"🔥 Hot",value:myAccounts.filter(a=>a.hot==="true").length,icon:"🔥"}].map(s=>(
              <div key={s.label} style={{ background:"#111118", border:"1px solid #1a1a26", borderRadius:14, padding:"16px 14px" }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:26, fontWeight:900, marginTop:6, color }}>{s.value}</div>
                <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#0a1a0a", border:"1px solid #166534", borderRadius:14, padding:14, marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div style={{ fontSize:13, color:"#4ade80" }}><strong>Firebase connected!</strong> Live sync on.</div>
          </div>
          <button onClick={logout} style={{ width:"100%", background:"#1a0808", border:"1px solid #7f1d1d", borderRadius:14, padding:"14px", color:"#f87171", fontWeight:700, fontSize:14, cursor:"pointer" }}>↩ Log Out</button>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}
