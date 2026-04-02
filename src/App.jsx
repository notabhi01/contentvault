import { useState, useEffect, useRef } from "react";

// ─── config ───────────────────────────────────────────────────
const PASSWORDS = {
  owner:    "Hooperlink69",
  manager:  "manager2026",
  linktree: "linktree2026",
  teammate: "team2026",
};
const FB = { apiKey: "AIzaSyAzCqX4CzYsm0LfMpPKDL9NYEZ-FWKSajg", projectId: "contentvault-434f1" };
const FS = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;

const ROLE_LABELS = { owner: "Owner", manager: "Content Manager", linktree: "Linktree Manager", teammate: "Teammate" };
const ROLE_COLORS = { owner: "#18181b", manager: "#6366f1", linktree: "#059669", teammate: "#0ea5e9" };
const ROLE_ICONS  = { owner: "◆", manager: "▲", linktree: "⬡", teammate: "●" };

// Abhi's pre-loaded channels
const OWNER_CHANNELS = [
  { name: "The Tailored Farm", url: "https://www.youtube.com/@thetailoredfarm" },
  { name: "Flufflings",        url: "https://www.youtube.com/@Flufflingss" },
];

function canSeeAll(role)    { return role === "owner" || role === "manager"; }
function canRemoveAll(role) { return role === "owner" || role === "manager"; }
function canBrowse(role)    { return role === "owner" || role === "manager" || role === "linktree"; }
function canEdit(role)      { return role !== "linktree"; }

// ─── Firestore ────────────────────────────────────────────────
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
  for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: String(v) };
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
  for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: String(v) };
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join("&");
  await fetch(`${FS}/${col}/${id}?key=${FB.apiKey}&${mask}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

// ─── utils ────────────────────────────────────────────────────
function extractUsername(raw) {
  raw = raw.trim();
  const url = raw.match(/instagram\.com\/(?:_u\/)?([^/?#&\s]+)/i);
  if (url) return url[1].toLowerCase().replace(/\/$/, "");
  const at = raw.match(/@([a-zA-Z0-9._]+)/);
  if (at) return at[1].toLowerCase();
  return null;
}
function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
const PALETTE = ["#6366f1","#ec4899","#0ea5e9","#059669","#f59e0b","#ef4444","#8b5cf6"];
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name||"").length; i++) h = (h*31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

// parse channels stored as JSON string
function parseChannels(str) {
  try { return JSON.parse(str) || []; } catch { return []; }
}

// ─── local bot ────────────────────────────────────────────────
function localBot(text, user, accounts) {
  const lower = text.toLowerCase().trim();
  const mine = accounts.filter(a => a.owner === user.displayName);
  const isRemove = /\b(remove|delete|drop)\b/.test(lower);
  const isCheck  = /\b(check|available|free|taken|is|who has)\b/.test(lower) && !/\b(add|want)\b/.test(lower);
  const isList   = /\b(list|show|my accounts|my sources|all accounts|everyone|team)\b/.test(lower);
  const isHelp   = /\b(help|hi|hey|hello|what can)\b/.test(lower);
  const username = extractUsername(text);

  if (!canEdit(user.role)) return { action:"chat", reply:"You have view-only access. Use Browse Teammates to find sources." };

  if (isList) {
    if (canSeeAll(user.role) && /\b(all|everyone|team)\b/.test(lower)) {
      if (!accounts.length) return { action:"chat", reply:"No accounts claimed yet." };
      const g = {};
      accounts.forEach(a => { if (!g[a.owner]) g[a.owner]=[]; g[a.owner].push(a.username); });
      return { action:"chat", reply:Object.entries(g).map(([o,a])=>`${o}: ${a.join(", ")}`).join("\n") };
    }
    if (!mine.length) return { action:"chat", reply:"You haven't added any sources yet." };
    return { action:"chat", reply:`Your sources:\n${mine.map(a=>`• instagram.com/${a.username}`).join("\n")}` };
  }
  if (isRemove) {
    if (!username) return { action:"chat", reply:"Which account? Send the @username or link." };
    const t = accounts.find(a => a.username === username);
    if (!t) return { action:"chat", reply:`Can't find @${username}.` };
    if (t.owner !== user.displayName && !canRemoveAll(user.role)) return { action:"chat", reply:`@${username} belongs to ${t.owner}.` };
    return { action:"remove", username, reply:`Removed @${username}.` };
  }
  if (isCheck && username) {
    const c = accounts.find(a => a.username === username);
    if (c) return { action:"chat", reply: c.owner===user.displayName ? `@${username} is yours ✓` : canSeeAll(user.role) ? `@${username} is taken by ${c.owner}` : `@${username} is taken` };
    return { action:"chat", reply:`@${username} is free — want me to add it?` };
  }
  if (username) {
    const c = accounts.find(a => a.username === username);
    if (c) return { action:"chat", reply: c.owner===user.displayName ? `@${username} is already yours ✓` : canSeeAll(user.role) ? `@${username} is taken by ${c.owner}` : `@${username} is taken` };
    return { action:"add", username, reply:`Added instagram.com/${username} to your sources.` };
  }
  if (isHelp) return { action:"chat", reply:`Hey ${user.displayName}! You can:\n• Add — paste a link or @username\n• Check — "is @username taken?"\n• Remove — "remove @username"\n• List — "show my sources"` };
  return { action:"chat", reply:`Send me an Instagram link or @username to add it.` };
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
  const [searchQuery, setSearchQuery] = useState("");
  const [adminTab, setAdminTab] = useState("accounts");
  const [browseExpanded, setBrowseExpanded] = useState(null);

  // profile / channels state
  const [userChannels, setUserChannels] = useState([]); // [{name, url}]
  const [newChName, setNewChName] = useState("");
  const [newChUrl, setNewChUrl] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("cv_user");
      if (s) {
        const p = JSON.parse(s);
        if (p?.username) {
          setUser(p);
          setMessages([{role:"assistant",text:`Welcome back, ${p.displayName}.`}]);
          // load channels from localStorage as quick cache
          const ch = localStorage.getItem(`cv_channels_${p.username}`);
          if (ch) setUserChannels(parseChannels(ch));
        }
      }
    } catch {}
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  useEffect(() => {
    if (!user) return;
    refresh();
    loadChannels();
    pollRef.current = setInterval(refresh, 12000);
    return () => clearInterval(pollRef.current);
  }, [user]);

  async function refresh() {
    setSyncing(true);
    const [s,u] = await Promise.all([fsGet("sources"), fsGet("users")]);
    setAccounts(s); setUsers(u); setSyncing(false);
  }

  async function loadChannels() {
    try {
      const docs = await fsGet(`channels`);
      const mine = docs.find(d => d.id === user.username);
      if (mine && mine.data) {
        const ch = parseChannels(mine.data);
        setUserChannels(ch);
        localStorage.setItem(`cv_channels_${user.username}`, JSON.stringify(ch));
      } else if (user.role === "owner") {
        // pre-load owner channels
        setUserChannels(OWNER_CHANNELS);
        await fsSet("channels", user.username, { data: JSON.stringify(OWNER_CHANNELS) });
        localStorage.setItem(`cv_channels_${user.username}`, JSON.stringify(OWNER_CHANNELS));
      }
    } catch {}
  }

  async function saveChannel() {
    if (!newChName.trim() || !newChUrl.trim()) return;
    setSavingChannel(true);
    const updated = [...userChannels, { name: newChName.trim(), url: newChUrl.trim() }];
    try {
      await fsSet("channels", user.username, { data: JSON.stringify(updated) });
      setUserChannels(updated);
      localStorage.setItem(`cv_channels_${user.username}`, JSON.stringify(updated));
      setNewChName(""); setNewChUrl("");
    } catch {}
    setSavingChannel(false);
  }

  async function removeChannel(idx) {
    const updated = userChannels.filter((_,i) => i !== idx);
    await fsSet("channels", user.username, { data: JSON.stringify(updated) });
    setUserChannels(updated);
    localStorage.setItem(`cv_channels_${user.username}`, JSON.stringify(updated));
  }

  async function updatePostedTo(accountId, channelName) {
    await fsPatch("sources", accountId, { postedTo: channelName });
    setAccounts(prev => prev.map(a => a.id === accountId ? {...a, postedTo: channelName} : a));
  }

  // get channel url from name for a given owner
  async function getChannelUrl(ownerUsername, channelName) {
    try {
      const docs = await fsGet("channels");
      const ownerDoc = docs.find(d => d.id === ownerUsername);
      if (ownerDoc && ownerDoc.data) {
        const chs = parseChannels(ownerDoc.data);
        const ch = chs.find(c => c.name === channelName);
        return ch?.url || null;
      }
    } catch {}
    return null;
  }

  async function handleVisit(id) {
    const now = new Date().toISOString();
    const k = `lastVisit_${user.username}`;
    await fsPatch("sources", id, {[k]:now, lastVisited:now});
    setAccounts(prev => prev.map(a => a.id===id ? {...a,[k]:now,lastVisited:now} : a));
  }

  async function handleToggleHot(id, val) {
    await fsPatch("sources", id, {hot:String(val)});
    setAccounts(prev => prev.map(a => a.id===id ? {...a,hot:String(val)} : a));
  }

  function detectRole(p) {
    if (p===PASSWORDS.owner) return "owner";
    if (p===PASSWORDS.manager) return "manager";
    if (p===PASSWORDS.linktree) return "linktree";
    if (p===PASSWORDS.teammate) return "teammate";
    return null;
  }

  async function handleSignup() {
    const dn = nameInput.trim(), pw = passInput.trim();
    if (!dn) { setAuthError("Enter your name."); return; }
    const role = detectRole(pw);
    if (!role) { setAuthError("Wrong password."); return; }
    const un = dn.toLowerCase().replace(/\s+/g,"_");
    setAuthLoading(true); setAuthError("");
    try {
      const ex = await fsGet("users");
      if (ex.find(u => u.username===un || u.displayName?.toLowerCase()===dn.toLowerCase())) {
        setAuthError(`"${dn}" is already taken.`); setAuthLoading(false); return;
      }
      await fsSet("users", un, {username:un, displayName:dn, role, createdAt:new Date().toISOString().slice(0,10)});
      const sd = {username:un, displayName:dn, role};
      localStorage.setItem("cv_user", JSON.stringify(sd));
      setUser(sd);
      setMessages([{role:"assistant",text:`Hey ${dn}, you're in.`}]);
    } catch { setAuthError("Something went wrong."); }
    finally { setAuthLoading(false); }
  }

  async function handleLogin() {
    const dn = nameInput.trim(), pw = passInput.trim();
    if (!dn) { setAuthError("Enter your name."); return; }
    const role = detectRole(pw);
    if (!role) { setAuthError("Wrong password."); return; }
    const un = dn.toLowerCase().replace(/\s+/g,"_");
    setAuthLoading(true); setAuthError("");
    try {
      const ex = await fsGet("users");
      const found = ex.find(u => u.username===un);
      if (!found) { setAuthError("Account not found. Sign up first."); setAuthLoading(false); return; }
      if (found.role !== role) { setAuthError("Wrong password for this account."); setAuthLoading(false); return; }
      const sd = {username:un, displayName:found.displayName, role:found.role};
      localStorage.setItem("cv_user", JSON.stringify(sd));
      setUser(sd);
      setMessages([{role:"assistant",text:`Welcome back, ${found.displayName}.`}]);
    } catch { setAuthError("Something went wrong."); }
    finally { setAuthLoading(false); }
  }

  function handleAuthKey(e) { if (e.key==="Enter") authScreen==="login" ? handleLogin() : handleSignup(); }

  function logout() {
    localStorage.removeItem("cv_user");
    setUser(null); setNameInput(""); setPassInput(""); setAuthError(""); setMessages([]); setMenuOpen(false); setPage("sources"); setUserChannels([]);
  }

  async function send() {
    const text = input.trim();
    if (!text||loading) return;
    setInput("");
    const hist = [...messages, {role:"user",text}];
    setMessages(hist); setLoading(true);
    const fresh = await fsGet("sources"); setAccounts(fresh);
    const {action,username,reply} = localBot(text,user,fresh);
    if (action==="add" && username && canEdit(user.role)) {
      await fsSet("sources", username, {username, owner:user.displayName, ownerUsername:user.username, role:user.role, addedAt:new Date().toISOString().slice(0,10), igLink:`https://www.instagram.com/${username}`, hot:"false", postedTo:""});
      setAccounts(await fsGet("sources"));
    } else if (action==="remove" && username && canEdit(user.role)) {
      await fsDelete("sources", username);
      setAccounts(await fsGet("sources"));
    }
    await new Promise(r=>setTimeout(r,280));
    setMessages([...hist,{role:"assistant",text:reply}]);
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(),50);
  }

  function handleChatKey(e) { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }
  async function adminRemove(un) { await fsDelete("sources",un); await refresh(); }

  const myAccounts = accounts.filter(a=>a.owner===user?.displayName);
  const color = user ? ROLE_COLORS[user.role] : "#18181b";
  const visitKey = user ? `lastVisit_${user.username}` : "";
  const sourceList = (canSeeAll(user?.role) ? accounts : myAccounts)
    .filter(a => !searchQuery || a.username.toLowerCase().includes(searchQuery.toLowerCase()) || (a.owner||"").toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a,b) => {
      if (a.hot==="true" && b.hot!=="true") return -1;
      if (b.hot==="true" && a.hot!=="true") return 1;
      return (a.username||"").localeCompare(b.username||"");
    });

  const S = {
    page: { minHeight:"100vh", background:"#fafaf9", fontFamily:"'DM Sans',system-ui,sans-serif", color:"#18181b", display:"flex", flexDirection:"column" },
    topbar: { background:"#fff", borderBottom:"1px solid #e5e5e5", padding:"0 20px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20 },
    logo: { fontWeight:700, fontSize:15, letterSpacing:-0.3, color:"#18181b" },
    pill: (c) => ({ background:c+"12", color:c, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600, letterSpacing:.2 }),
    navBtn: (active) => ({ background:active?"#18181b":"transparent", color:active?"#fff":"#71717a", border:"none", borderRadius:6, padding:"6px 12px", fontWeight:500, fontSize:13, cursor:"pointer", transition:"all .15s" }),
    input: { width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#18181b", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" },
    cell: { padding:"10px 10px", fontSize:13, display:"flex", alignItems:"center", overflow:"hidden" },
    sectionTitle: { fontSize:12, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 },
  };

  // ── AUTH ──────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#fafaf9", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',system-ui,sans-serif", padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontWeight:700, fontSize:22, letterSpacing:-0.5, color:"#18181b", marginBottom:4 }}>ContentVault</div>
          <div style={{ fontSize:13, color:"#71717a" }}>Team content source tracker</div>
        </div>
        <div style={{ display:"flex", background:"#f4f4f5", borderRadius:8, padding:3, marginBottom:20 }}>
          {["login","signup"].map(t=>(
            <button key={t} onClick={()=>{setAuthScreen(t);setAuthError("");}} style={{ flex:1, background:authScreen===t?"#fff":"transparent", border:"none", borderRadius:6, padding:"7px 0", color:authScreen===t?"#18181b":"#71717a", fontWeight:authScreen===t?600:400, fontSize:13, cursor:"pointer", boxShadow:authScreen===t?"0 1px 3px rgba(0,0,0,0.08)":"none", transition:"all .15s" }}>
              {t==="login"?"Log in":"Sign up"}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <div style={{ fontSize:12, color:"#71717a", fontWeight:500, marginBottom:5 }}>Name</div>
            <input value={nameInput} onChange={e=>{setNameInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey} placeholder="Your name" autoFocus style={{...S.input,fontSize:14}} />
          </div>
          <div>
            <div style={{ fontSize:12, color:"#71717a", fontWeight:500, marginBottom:5 }}>Password</div>
            <div style={{ position:"relative" }}>
              <input type={showPass?"text":"password"} value={passInput} onChange={e=>{setPassInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey} placeholder="Role password" style={{...S.input,fontSize:14,paddingRight:40}} />
              <button onClick={()=>setShowPass(!showPass)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#a1a1aa", cursor:"pointer", fontSize:14, padding:0 }}>{showPass?"●":"○"}</button>
            </div>
          </div>
          {authError && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:7, padding:"9px 12px", color:"#dc2626", fontSize:13 }}>{authError}</div>}
          <button onClick={authScreen==="login"?handleLogin:handleSignup} disabled={authLoading||!nameInput.trim()||!passInput.trim()}
            style={{ background:authLoading||!nameInput.trim()||!passInput.trim()?"#e5e5e5":"#18181b", color:authLoading||!nameInput.trim()||!passInput.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:8, padding:"11px", fontWeight:600, fontSize:14, cursor:authLoading||!nameInput.trim()||!passInput.trim()?"not-allowed":"pointer", transition:"all .15s", marginTop:4 }}>
            {authLoading?"…":authScreen==="login"?"Log in":"Create account"}
          </button>
          <div style={{ textAlign:"center", fontSize:12, color:"#a1a1aa" }}>
            {authScreen==="login"?"Don't have an account? ":"Already have an account? "}
            <button onClick={()=>{setAuthScreen(authScreen==="login"?"signup":"login");setAuthError("");}} style={{ background:"none", border:"none", color:"#18181b", cursor:"pointer", fontSize:12, fontWeight:600, padding:0, textDecoration:"underline" }}>
              {authScreen==="login"?"Sign up":"Log in"}
            </button>
          </div>
        </div>
        <div style={{ marginTop:28, display:"flex", flexWrap:"wrap", gap:6 }}>
          {Object.entries(ROLE_LABELS).map(([r,l])=>(
            <div key={r} style={S.pill(ROLE_COLORS[r])}>{ROLE_ICONS[r]} {l}</div>
          ))}
        </div>
      </div>
    </div>
  );

  const navItems = [
    {id:"sources", label:"Sources", show:true},
    {id:"browse",  label:"Browse",  show:canBrowse(user.role)},
    {id:"chat",    label:"Chat",    show:canEdit(user.role)},
    {id:"admin",   label:"Admin",   show:canSeeAll(user.role)},
    {id:"profile", label:"Profile", show:true},
  ].filter(n=>n.show);

  // grid columns for sources table
  const gridCols = canSeeAll(user.role)
    ? "2fr 1fr 1.4fr 0.9fr 0.9fr 60px"
    : "2fr 1.4fr 0.9fr 0.9fr 60px";

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* topbar */}
      <div style={S.topbar}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={S.logo}>ContentVault</span>
          <div style={{ display:"flex", gap:2 }}>
            {navItems.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)} style={S.navBtn(page===n.id)}>{n.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {syncing && <span style={{ fontSize:11, color:"#a1a1aa" }}>syncing…</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:11 }}>{user.displayName[0].toUpperCase()}</div>
            <span style={{ fontSize:13, fontWeight:500 }}>{user.displayName}</span>
            <span style={S.pill(color)}>{ROLE_LABELS[user.role]}</span>
          </div>
          <button onClick={logout} style={{ background:"none", border:"1px solid #e5e5e5", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#71717a", cursor:"pointer" }}>Log out</button>
        </div>
      </div>

      {/* ── SOURCES ── */}
      {page==="sources" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, borderBottom:"1px solid #e5e5e5", background:"#fff" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{canSeeAll(user.role)?"All Sources":"My Sources"}</span>
              <span style={{ fontSize:12, color:"#a1a1aa", background:"#f4f4f5", borderRadius:4, padding:"1px 7px" }}>{sourceList.length}</span>
              {sourceList.filter(a=>a.hot==="true").length > 0 && (
                <span style={{ fontSize:12, color:"#f97316", background:"#fff7ed", borderRadius:4, padding:"1px 7px", border:"1px solid #fed7aa" }}>🔥 {sourceList.filter(a=>a.hot==="true").length}</span>
              )}
            </div>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search…" style={{...S.input,width:180,padding:"6px 10px",fontSize:12}} />
          </div>

          {/* table header */}
          <div style={{ display:"grid", gridTemplateColumns:gridCols, padding:"0 20px", borderBottom:"1px solid #e5e5e5", background:"#fafaf9" }}>
            {[
              "Account",
              ...(canSeeAll(user.role)?["Owner"]:[]),
              "Posted to",
              "Added",
              "Last visited",
              ""
            ].map((h,i)=>(
              <div key={i} style={{ padding:"8px 10px", fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>{h}</div>
            ))}
          </div>

          {/* rows */}
          <div style={{ flex:1, overflow:"auto" }}>
            {sourceList.length===0 ? (
              <div style={{ textAlign:"center", padding:"80px 20px", color:"#a1a1aa" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>—</div>
                <div style={{ fontSize:14 }}>{searchQuery?"No results.":"No sources yet."}</div>
                {canEdit(user.role)&&!searchQuery&&<button onClick={()=>setPage("chat")} style={{ marginTop:12, background:"#18181b", color:"#fff", border:"none", borderRadius:7, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add via chat</button>}
              </div>
            ) : sourceList.map((a,idx)=>{
              const isHot = a.hot==="true";
              const lv = a[visitKey]||a.lastVisited;
              const nc = nameColor(a.owner||"");
              // get channels for this account's owner
              const ownerChannels = a.ownerUsername === user.username ? userChannels : [];
              const selectedChannel = a.postedTo || "";
              const channelObj = ownerChannels.find(c=>c.name===selectedChannel);

              return (
                <div key={a.id}
                  style={{ display:"grid", gridTemplateColumns:gridCols, padding:"0 20px", borderBottom:"1px solid #f0f0f0", background:idx%2===0?"#fff":"#fafaf9", transition:"background .1s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#f4f4f5"}
                  onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"#fff":"#fafaf9"}
                >
                  {/* account */}
                  <div style={S.cell}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                      {isHot&&<span style={{ fontSize:11, flexShrink:0 }}>🔥</span>}
                      <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer" onClick={()=>handleVisit(a.id)}
                        style={{ color:"#18181b", fontWeight:500, fontSize:13, textDecoration:"none", borderBottom:"1px solid #e5e5e5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                        onMouseEnter={e=>e.target.style.borderBottomColor="#18181b"}
                        onMouseLeave={e=>e.target.style.borderBottomColor="#e5e5e5"}
                      >instagram.com/{a.username}</a>
                    </div>
                  </div>

                  {/* owner (admin only) */}
                  {canSeeAll(user.role) && (
                    <div style={S.cell}>
                      <span style={{ fontSize:12, color:nc, fontWeight:500 }}>{a.owner||"—"}</span>
                    </div>
                  )}

                  {/* posted to */}
                  <div style={{...S.cell, gap:6}}>
                    {/* only the account owner can edit posted to */}
                    {a.owner === user.displayName ? (
                      <div style={{ display:"flex", alignItems:"center", gap:4, minWidth:0 }}>
                        <select
                          value={selectedChannel}
                          onChange={e=>updatePostedTo(a.id, e.target.value)}
                          style={{ background:"transparent", border:"none", fontSize:12, color: selectedChannel?"#18181b":"#a1a1aa", outline:"none", cursor:"pointer", fontFamily:"inherit", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}
                        >
                          <option value="">— none —</option>
                          {userChannels.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        {channelObj && (
                          <a href={channelObj.url} target="_blank" rel="noreferrer" title="Open channel" style={{ color:"#a1a1aa", fontSize:12, textDecoration:"none", flexShrink:0 }}
                            onMouseEnter={e=>e.target.style.color="#18181b"}
                            onMouseLeave={e=>e.target.style.color="#a1a1aa"}
                          >↗</a>
                        )}
                      </div>
                    ) : canSeeAll(user.role) ? (
                      // admin sees channel name + link
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ fontSize:12, color: selectedChannel?"#18181b":"#d4d4d4" }}>{selectedChannel||"—"}</span>
                        {selectedChannel && (
                          <ChannelLink ownerUsername={a.ownerUsername} channelName={selectedChannel} />
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize:12, color:"#d4d4d4" }}>—</span>
                    )}
                  </div>

                  {/* added */}
                  <div style={S.cell}><span style={{ fontSize:12, color:"#a1a1aa" }}>{a.addedAt||"—"}</span></div>

                  {/* last visited */}
                  <div style={S.cell}><span style={{ fontSize:12, color:lv?"#71717a":"#d4d4d4" }}>{lv?timeAgo(lv):"Never"}</span></div>

                  {/* actions */}
                  <div style={{...S.cell, gap:4, justifyContent:"flex-end"}}>
                    {canEdit(user.role)&&(
                      <button onClick={()=>handleToggleHot(a.id,!isHot)} title={isHot?"Unmark":"Mark hot"} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:"2px 3px", color:isHot?"#f97316":"#d4d4d4", transition:"color .15s" }}>🔥</button>
                    )}
                    {(a.owner===user.displayName||canRemoveAll(user.role))&&(
                      <button onClick={()=>adminRemove(a.id)} title="Remove" style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, padding:"2px 3px", color:"#d4d4d4" }}
                        onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#d4d4d4"}>✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BROWSE ── */}
      {page==="browse" && canBrowse(user.role) && (
        <div style={{ flex:1, overflow:"auto", maxWidth:700, width:"100%", margin:"0 auto", padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Browse Teammates</div>
          <div style={{ fontSize:13, color:"#a1a1aa", marginBottom:20 }}>Tap a name to see their sources</div>
          <div style={{ border:"1px solid #e5e5e5", borderRadius:10, overflow:"hidden", background:"#fff" }}>
            {users.filter(u=>u.role==="teammate").length===0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No teammates yet.</div>
            ) : users.filter(u=>u.role==="teammate").map((u,i,arr)=>{
              const uAccounts = accounts.filter(a=>a.owner===u.displayName);
              const isOpen = browseExpanded===u.id;
              const nc = nameColor(u.displayName);
              const hotCount = uAccounts.filter(a=>a.hot==="true").length;
              return (
                <div key={u.id} style={{ borderBottom:i<arr.length-1?"1px solid #f0f0f0":"none" }}>
                  <button onClick={()=>setBrowseExpanded(isOpen?null:u.id)} style={{ width:"100%", background:isOpen?"#fafaf9":"#fff", border:"none", cursor:"pointer", padding:"13px 16px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:nc+"15", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:nc }}>{u.displayName[0].toUpperCase()}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{u.displayName}</div>
                      <div style={{ fontSize:12, color:"#a1a1aa", marginTop:1 }}>{uAccounts.length} source{uAccounts.length!==1?"s":""}{hotCount>0?` · ${hotCount} 🔥`:""}</div>
                    </div>
                    <span style={{ color:"#d4d4d4", fontSize:11, transform:isOpen?"rotate(90deg)":"rotate(0deg)", transition:"transform .2s" }}>▶</span>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop:"1px solid #f0f0f0", background:"#fafaf9" }}>
                      {uAccounts.length===0 ? <div style={{ padding:"16px 60px", fontSize:13, color:"#a1a1aa" }}>No sources yet.</div>
                      : uAccounts.sort((a,b)=>(b.hot==="true"?1:0)-(a.hot==="true"?1:0)).map(a=>{
                        const lv = a[`lastVisit_${u.username}`]||a.lastVisited;
                        return (
                          <div key={a.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px 10px 60px", borderBottom:"1px solid #f0f0f0" }}>
                            {a.hot==="true"&&<span style={{ fontSize:11 }}>🔥</span>}
                            <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer" onClick={()=>handleVisit(a.id)}
                              style={{ flex:1, color:"#18181b", fontSize:13, fontWeight:500, textDecoration:"none", borderBottom:"1px solid #e5e5e5" }}
                              onMouseEnter={e=>e.target.style.borderBottomColor="#18181b"}
                              onMouseLeave={e=>e.target.style.borderBottomColor="#e5e5e5"}
                            >instagram.com/{a.username}</a>
                            {a.postedTo && <span style={{ fontSize:11, color:"#a1a1aa" }}>{a.postedTo}</span>}
                            {lv&&<span style={{ fontSize:11, color:"#a1a1aa", flexShrink:0 }}>{timeAgo(lv)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHAT ── */}
      {page==="chat" && canEdit(user.role) && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", maxWidth:640, width:"100%", margin:"0 auto" }}>
          <div style={{ flex:1, overflow:"auto", padding:"20px 20px 8px" }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:10, gap:8, alignItems:"flex-end" }}>
                {m.role==="assistant"&&<div style={{ width:26, height:26, borderRadius:6, background:"#18181b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, flexShrink:0 }}>CV</div>}
                <div style={{ maxWidth:"78%", background:m.role==="user"?"#18181b":"#fff", color:m.role==="user"?"#fff":"#18181b", borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px", padding:"9px 13px", fontSize:13, lineHeight:1.6, border:m.role==="assistant"?"1px solid #e5e5e5":"none", whiteSpace:"pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex", gap:8, alignItems:"flex-end", marginBottom:10 }}>
                <div style={{ width:26, height:26, borderRadius:6, background:"#18181b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700 }}>CV</div>
                <div style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:"14px 14px 14px 3px", padding:"10px 14px", display:"flex", gap:4 }}>
                  {[0,1,2].map(d=><span key={d} style={{ width:5, height:5, borderRadius:"50%", background:"#a1a1aa", display:"inline-block", animation:`bounce 1s ${d*.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div style={{ padding:"8px 20px", display:"flex", gap:6, flexWrap:"wrap", borderTop:"1px solid #f0f0f0" }}>
            {["show my sources","is @username taken?","add instagram.com/...",...(canSeeAll(user.role)?["show all accounts"]:[])].map(s=>(
              <button key={s} onClick={()=>{setInput(s);inputRef.current?.focus();}} style={{ background:"#f4f4f5", border:"none", borderRadius:6, padding:"4px 10px", color:"#71717a", fontSize:12, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, padding:"10px 20px 16px", borderTop:"1px solid #f0f0f0", background:"#fff" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleChatKey} placeholder="Paste a link or @username…" rows={1} style={{ flex:1, background:"#fafaf9", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#18181b", fontSize:13, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }} />
            <button onClick={send} disabled={loading||!input.trim()} style={{ background:loading||!input.trim()?"#f4f4f5":"#18181b", color:loading||!input.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:8, width:40, height:40, cursor:loading||!input.trim()?"not-allowed":"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, alignSelf:"flex-end", transition:"all .15s" }}>↑</button>
          </div>
        </div>
      )}

      {/* ── PROFILE ── */}
      {page==="profile" && (
        <div style={{ flex:1, overflow:"auto", maxWidth:560, width:"100%", margin:"0 auto", padding:"24px 20px" }}>
          {/* user card */}
          <div style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:12, padding:20, marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:52, height:52, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:22, color:"#fff" }}>{user.displayName[0].toUpperCase()}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>{user.displayName}</div>
              <div style={{ marginTop:4 }}><span style={S.pill(color)}>{ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}</span></div>
            </div>
          </div>

          {/* YouTube channels */}
          <div style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={S.sectionTitle}>YouTube Channels</div>
            {userChannels.length===0 ? (
              <div style={{ fontSize:13, color:"#a1a1aa", marginBottom:14 }}>No channels added yet.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                {userChannels.map((c,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#fafaf9", borderRadius:8, border:"1px solid #f0f0f0" }}>
                    <div style={{ width:28, height:28, borderRadius:6, background:"#fee2e2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>▶</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#a1a1aa", textDecoration:"none" }}
                        onMouseEnter={e=>e.target.style.color="#18181b"} onMouseLeave={e=>e.target.style.color="#a1a1aa"}
                      >{c.url} ↗</a>
                    </div>
                    <button onClick={()=>removeChannel(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#d4d4d4", fontSize:13 }}
                      onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#d4d4d4"}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {/* add channel form */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <input value={newChName} onChange={e=>setNewChName(e.target.value)} placeholder="Channel name (e.g. Pets Channel)" style={{...S.input, fontSize:13}} />
              <input value={newChUrl} onChange={e=>setNewChUrl(e.target.value)} placeholder="YouTube link (e.g. youtube.com/@channel)" style={{...S.input, fontSize:13}} />
              <button onClick={saveChannel} disabled={savingChannel||!newChName.trim()||!newChUrl.trim()} style={{ background:savingChannel||!newChName.trim()||!newChUrl.trim()?"#f4f4f5":"#18181b", color:savingChannel||!newChName.trim()||!newChUrl.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:8, padding:"9px", fontWeight:600, fontSize:13, cursor:savingChannel||!newChName.trim()||!newChUrl.trim()?"not-allowed":"pointer", transition:"all .15s" }}>
                {savingChannel?"Saving…":"Add channel"}
              </button>
            </div>
          </div>

          {/* stats */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[{label:"My sources",value:myAccounts.length},{label:"🔥 Hot",value:myAccounts.filter(a=>a.hot==="true").length}].map(s=>(
              <div key={s.label} style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:10, padding:"14px" }}>
                <div style={{ fontSize:22, fontWeight:700, color:"#18181b" }}>{s.value}</div>
                <div style={{ fontSize:12, color:"#a1a1aa", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <button onClick={logout} style={{ width:"100%", background:"#fff", border:"1px solid #fecaca", borderRadius:10, padding:"11px", color:"#ef4444", fontWeight:600, fontSize:13, cursor:"pointer" }}>Log out</button>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page==="admin" && canSeeAll(user.role) && (
        <div style={{ flex:1, overflow:"auto", maxWidth:800, width:"100%", margin:"0 auto", padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Admin Panel</div>
          <div style={{ display:"flex", background:"#f4f4f5", borderRadius:7, padding:3, marginBottom:20, width:"fit-content" }}>
            {[{id:"accounts",l:"Accounts"},{id:"members",l:"Members"}].map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{ background:adminTab===t.id?"#fff":"transparent", border:"none", borderRadius:5, padding:"5px 14px", color:adminTab===t.id?"#18181b":"#71717a", fontWeight:adminTab===t.id?600:400, fontSize:13, cursor:"pointer", boxShadow:adminTab===t.id?"0 1px 3px rgba(0,0,0,0.07)":"none", transition:"all .15s" }}>{t.l}</button>
            ))}
          </div>
          {adminTab==="accounts" && (
            <div style={{ border:"1px solid #e5e5e5", borderRadius:10, overflow:"hidden", background:"#fff" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 0.8fr 40px", borderBottom:"1px solid #e5e5e5", background:"#fafaf9" }}>
                {["Account","Owner","Posted to","Added",""].map((h,i)=>(
                  <div key={i} style={{ padding:"8px 12px", fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>{h}</div>
                ))}
              </div>
              {accounts.length===0?<div style={{ padding:"40px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No accounts yet.</div>
              :accounts.sort((a,b)=>(b.addedAt||"").localeCompare(a.addedAt||"")).map((a,i,arr)=>(
                <div key={a.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 0.8fr 40px", borderBottom:i<arr.length-1?"1px solid #f0f0f0":"none", background:i%2===0?"#fff":"#fafaf9" }}>
                  <div style={{ padding:"10px 12px", fontSize:13, display:"flex", alignItems:"center", gap:5 }}>
                    {a.hot==="true"&&<span>🔥</span>}
                    <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer" style={{ color:"#18181b", fontWeight:500, textDecoration:"none", borderBottom:"1px solid #e5e5e5" }}>instagram.com/{a.username}</a>
                  </div>
                  <div style={{ padding:"10px 12px", fontSize:12, color:nameColor(a.owner), fontWeight:500, display:"flex", alignItems:"center" }}>{a.owner}</div>
                  <div style={{ padding:"10px 12px", fontSize:12, color:"#71717a", display:"flex", alignItems:"center" }}>{a.postedTo||"—"}</div>
                  <div style={{ padding:"10px 12px", fontSize:12, color:"#a1a1aa", display:"flex", alignItems:"center" }}>{a.addedAt}</div>
                  <div style={{ padding:"10px 8px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <button onClick={()=>adminRemove(a.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#d4d4d4", fontSize:13 }}
                      onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#d4d4d4"}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adminTab==="members" && (
            <div style={{ border:"1px solid #e5e5e5", borderRadius:10, overflow:"hidden", background:"#fff" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 0.7fr 0.7fr", borderBottom:"1px solid #e5e5e5", background:"#fafaf9" }}>
                {["Name","Role","Sources","Joined"].map((h,i)=>(
                  <div key={i} style={{ padding:"8px 12px", fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>{h}</div>
                ))}
              </div>
              {users.length===0?<div style={{ padding:"40px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No members yet.</div>
              :users.sort((a,b)=>{const o={owner:0,manager:1,linktree:2,teammate:3};return(o[a.role]||3)-(o[b.role]||3);}).map((u,i,arr)=>(
                <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 0.7fr 0.7fr", borderBottom:i<arr.length-1?"1px solid #f0f0f0":"none", background:i%2===0?"#fff":"#fafaf9" }}>
                  <div style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:ROLE_COLORS[u.role]+"15", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11, color:ROLE_COLORS[u.role] }}>{u.displayName?.[0]?.toUpperCase()}</div>
                    <span style={{ fontSize:13, fontWeight:500 }}>{u.displayName}</span>
                  </div>
                  <div style={{ padding:"10px 12px", display:"flex", alignItems:"center" }}>
                    <span style={S.pill(ROLE_COLORS[u.role])}>{ROLE_LABELS[u.role]}</span>
                  </div>
                  <div style={{ padding:"10px 12px", fontSize:13, color:"#71717a", display:"flex", alignItems:"center" }}>{accounts.filter(a=>a.owner===u.displayName).length}</div>
                  <div style={{ padding:"10px 12px", fontSize:12, color:"#a1a1aa", display:"flex", alignItems:"center" }}>{u.createdAt||"—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}

// helper component to fetch & show channel link for admin view
function ChannelLink({ ownerUsername, channelName }) {
  const [url, setUrl] = useState(null);
  const FB2 = { apiKey: "AIzaSyAzCqX4CzYsm0LfMpPKDL9NYEZ-FWKSajg", projectId: "contentvault-434f1" };
  const FS2 = `https://firestore.googleapis.com/v1/projects/${FB2.projectId}/databases/(default)/documents`;

  useEffect(() => {
    if (!ownerUsername || !channelName) return;
    fetch(`${FS2}/channels/${ownerUsername}?key=${FB2.apiKey}`)
      .then(r=>r.json())
      .then(d => {
        const data = d.fields?.data?.stringValue;
        if (data) {
          const chs = JSON.parse(data);
          const ch = chs.find(c=>c.name===channelName);
          if (ch) setUrl(ch.url);
        }
      }).catch(()=>{});
  }, [ownerUsername, channelName]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open channel" style={{ color:"#a1a1aa", fontSize:12, textDecoration:"none" }}
      onMouseEnter={e=>e.target.style.color="#18181b"} onMouseLeave={e=>e.target.style.color="#a1a1aa"}>↗</a>
  );
}
