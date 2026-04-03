import { useState, useEffect, useRef } from "react";

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

function canSeeAll(r)    { return r === "owner" || r === "manager"; }
function canRemoveAll(r) { return r === "owner" || r === "manager"; }
function canBrowse(r)    { return r === "owner" || r === "manager" || r === "linktree"; }
function canEdit(r)      { return r !== "linktree"; }

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
const PALETTE = ["#6366f1","#ec4899","#0ea5e9","#059669","#f59e0b","#ef4444","#8b5cf6","#14b8a6"];
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name||"").length; i++) h = (h*31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}
function parseChannels(str) {
  try { return JSON.parse(str) || []; } catch { return []; }
}
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 44 }) {
  const c = nameColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${c}, ${c}aa)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.38), letterSpacing: -0.3,
    }}>{(name||"?")[0].toUpperCase()}</div>
  );
}

// ─── Source Row ───────────────────────────────────────────────
function SourceRow({ a, visitKey, onVisit, onRemove, canRemove, userChannels, onPostedTo, isMobile }) {
  const lv = a[visitKey] || a.lastVisited;
  const selected = a.postedTo || "";
  const chObj = (userChannels||[]).find(c => c.name === selected);

  function open(e) {
    if (e) e.preventDefault();
    onVisit(a.id);
    window.open(`https://www.instagram.com/${a.username}`, "_blank", "noreferrer");
  }

  if (isMobile) {
    return (
      <div onClick={open} style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
        borderBottom: "1px solid #f2f2f2", background: "#fff", cursor: "pointer",
        WebkitTapHighlightColor: "transparent", userSelect: "none",
      }}>
        <Avatar name={a.username} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#18181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.username}
          </div>
          <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected : "instagram.com/" + a.username}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {lv && <span style={{ fontSize: 11, color: "#c7c7c7" }}>{timeAgo(lv)}</span>}
          <div style={{ border: "1.5px solid #dbdbdb", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#18181b", background: "#fff", whiteSpace: "nowrap" }}>Open</div>
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); if (window.confirm(`Remove @${a.username}?`)) onRemove(a.id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#d4d4d4", fontSize: 20, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>×</button>
          )}
        </div>
      </div>
    );
  }

  // desktop
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "9px 20px", borderBottom: "1px solid #f2f2f2", background: "#fff", transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#fafaf9"}
      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
    >
      <Avatar name={a.username} size={36} />
      <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer" onClick={() => onVisit(a.id)}
          style={{ fontWeight: 500, fontSize: 13, color: "#18181b", textDecoration: "none" }}
          onMouseEnter={e => e.target.style.textDecoration = "underline"}
          onMouseLeave={e => e.target.style.textDecoration = "none"}
        >instagram.com/{a.username}</a>
      </div>
      {/* posted to */}
      <div style={{ width: 200, display: "flex", alignItems: "center", gap: 6 }}>
        {userChannels !== null ? (
          <>
            <select value={selected} onChange={e => onPostedTo(a.id, e.target.value)}
              style={{ background: "transparent", border: "none", fontSize: 12, color: selected ? "#18181b" : "#a1a1aa", outline: "none", cursor: "pointer", fontFamily: "inherit", maxWidth: 150 }}>
              <option value="">— none —</option>
              {(userChannels||[]).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {chObj && (
              <a href={chObj.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, textDecoration: "none", background: "#eef2ff", padding: "2px 6px", borderRadius: 4 }}>↗</a>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: selected ? "#71717a" : "#d4d4d4" }}>{selected || "—"}</span>
        )}
      </div>
      <div style={{ width: 100, fontSize: 12, color: "#a1a1aa" }}>{a.addedAt || "—"}</div>
      <div style={{ width: 90, fontSize: 12, color: lv ? "#71717a" : "#d4d4d4" }}>{lv ? timeAgo(lv) : "Never"}</div>
      {canRemove && (
        <button onClick={() => { if (window.confirm(`Remove instagram.com/${a.username}?`)) onRemove(a.id); }}
          style={{ background: "none", border: "1px solid #e5e5e5", borderRadius: 5, cursor: "pointer", fontSize: 11, padding: "3px 8px", color: "#a1a1aa", fontWeight: 500, transition: "all .15s", marginLeft: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "#fecaca"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#a1a1aa"; e.currentTarget.style.borderColor = "#e5e5e5"; }}>Remove</button>
      )}
    </div>
  );
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
  const isMobile = useIsMobile();
  const [authScreen, setAuthScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [page, setPage] = useState("sources");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminTab, setAdminTab] = useState("accounts");
  const [browseExpanded, setBrowseExpanded] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdImg, setNewProdImg] = useState("");
  const [newProdLink, setNewProdLink] = useState("");
  const [addingProd, setAddingProd] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [userChannels, setUserChannels] = useState([]);
  const [newChName, setNewChName] = useState("");
  const [newChUrl, setNewChUrl] = useState("");
  const [savingCh, setSavingCh] = useState(false);
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
          const ch = localStorage.getItem(`cv_ch_${p.username}`);
          if (ch) setUserChannels(parseChannels(ch));
        }
      }
    } catch {}
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  useEffect(() => {
    if (!user) return;
    refresh(); loadChannels(); loadProducts();
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
      const docs = await fsGet("channels");
      const mine = docs.find(d => d.id === user.username);
      if (mine?.data) {
        const ch = parseChannels(mine.data);
        setUserChannels(ch);
        localStorage.setItem(`cv_ch_${user.username}`, JSON.stringify(ch));
      } else if (user.role === "owner") {
        const def = [
          { name: "The Tailored Farm", url: "https://www.youtube.com/@thetailoredfarm" },
          { name: "Flufflings", url: "https://www.youtube.com/@Flufflingss" },
        ];
        setUserChannels(def);
        await fsSet("channels", user.username, { data: JSON.stringify(def) });
        localStorage.setItem(`cv_ch_${user.username}`, JSON.stringify(def));
      }
    } catch {}
  }

  async function saveChannel() {
    if (!newChName.trim() || !newChUrl.trim()) return;
    setSavingCh(true);
    const updated = [...userChannels, { name: newChName.trim(), url: newChUrl.trim() }];
    try {
      await fsSet("channels", user.username, { data: JSON.stringify(updated) });
      setUserChannels(updated);
      localStorage.setItem(`cv_ch_${user.username}`, JSON.stringify(updated));
      setNewChName(""); setNewChUrl("");
    } catch {}
    setSavingCh(false);
  }

  async function removeChannel(i) {
    const updated = userChannels.filter((_,idx) => idx !== i);
    await fsSet("channels", user.username, { data: JSON.stringify(updated) });
    setUserChannels(updated);
    localStorage.setItem(`cv_ch_${user.username}`, JSON.stringify(updated));
  }

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const docs = await fsGet("products");
      setProducts(docs.sort((a,b) => (b.addedAt||"").localeCompare(a.addedAt||"")));
    } catch {}
    setLoadingProducts(false);
  }

  async function addProduct() {
    if (!newProdName.trim() || !newProdLink.trim()) return;
    setAddingProd(true);
    const id = Date.now().toString();
    const entry = {
      name: newProdName.trim(),
      imgUrl: newProdImg.trim(),
      link: newProdLink.trim(),
      addedBy: user.displayName,
      addedAt: new Date().toISOString(),
    };
    try {
      await fsSet("products", id, entry);
      await loadProducts();
      setNewProdName(""); setNewProdImg(""); setNewProdLink("");
      setShowAddProd(false);
    } catch {}
    setAddingProd(false);
  }

  async function removeProduct(id) {
    await fsDelete("products", id);
    await loadProducts();
  }

  async function handleVisit(id) {
    const now = new Date().toISOString();
    const k = `lastVisit_${user.username}`;
    await fsPatch("sources", id, {[k]:now, lastVisited:now});
    setAccounts(prev => prev.map(a => a.id===id ? {...a,[k]:now,lastVisited:now} : a));
  }

  async function updatePostedTo(id, val) {
    await fsPatch("sources", id, { postedTo: val });
    setAccounts(prev => prev.map(a => a.id===id ? {...a, postedTo:val} : a));
  }

  async function removeAccount(id) {
    await fsDelete("sources", id); await refresh();
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
    setUser(null); setNameInput(""); setPassInput(""); setAuthError(""); setMessages([]);
    setPage("sources"); setUserChannels([]);
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
      await fsSet("sources", username, {username, owner:user.displayName, ownerUsername:user.username, role:user.role, addedAt:new Date().toISOString().slice(0,10), igLink:`https://www.instagram.com/${username}`, postedTo:""});
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

  const myAccounts = accounts.filter(a=>a.owner===user?.displayName);
  const visitKey = user ? `lastVisit_${user.username}` : "";
  const color = user ? ROLE_COLORS[user.role] : "#18181b";

  const sourceList = myAccounts
    .filter(a => !searchQuery || a.username.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a,b) => (a.username||"").localeCompare(b.username||""));

  // ── AUTH ──────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#fafaf9", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',system-ui,sans-serif", padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontWeight:700, fontSize:22, letterSpacing:-0.5, color:"#18181b", marginBottom:4 }}>ContentVault</div>
          <div style={{ fontSize:13, color:"#a1a1aa" }}>Team content source tracker</div>
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
            <input value={nameInput} onChange={e=>{setNameInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey} placeholder="Your name" autoFocus
              style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#18181b", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
          <div>
            <div style={{ fontSize:12, color:"#71717a", fontWeight:500, marginBottom:5 }}>Password</div>
            <div style={{ position:"relative" }}>
              <input type={showPass?"text":"password"} value={passInput} onChange={e=>{setPassInput(e.target.value);setAuthError("");}} onKeyDown={handleAuthKey} placeholder="Role password"
                style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 40px 10px 12px", color:"#18181b", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
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
        <div style={{ marginTop:24, display:"flex", flexWrap:"wrap", gap:6 }}>
          {Object.entries(ROLE_LABELS).map(([r,l])=>(
            <div key={r} style={{ background:ROLE_COLORS[r]+"12", color:ROLE_COLORS[r], borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );

  const navItems = [
    {id:"sources",  label:"Sources",  show:true},
    {id:"browse",   label:"Browse",   show:canBrowse(user.role)},
    {id:"winning",  label:"Winning",  show:true},
    {id:"chat",     label:"Chat",     show:canEdit(user.role)},
    {id:"admin",    label:"Admin",    show:canSeeAll(user.role)},
    {id:"profile",  label:"Profile",  show:true},
  ].filter(n=>n.show);

  return (
    <div style={{ minHeight:"100vh", background:"#fafaf9", fontFamily:"'DM Sans',system-ui,sans-serif", color:"#18181b", display:"flex", flexDirection:"column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── TOP BAR ── */}
      <div style={{ background:"#fff", borderBottom:"1px solid #ebebeb", padding:`0 ${isMobile?14:20}px`, height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:isMobile?10:14 }}>
          <span style={{ fontWeight:700, fontSize:15, letterSpacing:-0.3 }}>ContentVault</span>
          {!isMobile && (
            <div style={{ display:"flex", gap:2 }}>
              {navItems.map(n=>(
                <button key={n.id} onClick={()=>setPage(n.id)} style={{ background:page===n.id?"#18181b":"transparent", color:page===n.id?"#fff":"#71717a", border:"none", borderRadius:6, padding:"6px 12px", fontWeight:500, fontSize:13, cursor:"pointer", transition:"all .15s" }}>{n.label}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {syncing && <span style={{ fontSize:11, color:"#c7c7c7" }}>syncing…</span>}
          <div style={{ width:28, height:28, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:12 }}>{user.displayName[0].toUpperCase()}</div>
          {!isMobile && <button onClick={logout} style={{ background:"none", border:"1px solid #e5e5e5", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#71717a", cursor:"pointer" }}>Log out</button>}
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #ebebeb", display:"flex", zIndex:20, paddingBottom:"env(safe-area-inset-bottom)" }}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{ flex:1, background:"none", border:"none", padding:"10px 0 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <span style={{ fontSize:18 }}>
                {n.id==="sources"?"📋":n.id==="browse"?"👥":n.id==="winning"?"🏆":n.id==="chat"?"💬":n.id==="admin"?"🛡️":"👤"}
              </span>
              <span style={{ fontSize:10, color:page===n.id?"#18181b":"#a1a1aa", fontWeight:page===n.id?600:400 }}>{n.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── SOURCES ── */}
      {page==="sources" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", paddingBottom: isMobile ? 70 : 0 }}>
          {/* toolbar */}
          <div style={{ padding:`10px ${isMobile?14:20}px`, display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid #ebebeb", background:"#fff" }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, fontWeight:600 }}>My Sources</span>
              <span style={{ fontSize:12, color:"#a1a1aa", background:"#f4f4f5", borderRadius:4, padding:"1px 7px" }}>{sourceList.length}</span>
            </div>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search…"
              style={{ width: isMobile?120:180, background:"#f4f4f5", border:"none", borderRadius:8, padding:"7px 10px", color:"#18181b", fontSize:13, outline:"none", fontFamily:"inherit" }} />
          </div>

          {/* desktop header */}
          {!isMobile && (
            <div style={{ display:"flex", alignItems:"center", padding:"7px 20px", borderBottom:"1px solid #ebebeb", background:"#fafaf9" }}>
              <div style={{ width:36+12, flexShrink:0 }} />
              <div style={{ flex:1, fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>Account</div>
              <div style={{ width:200, fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>Posted to</div>
              <div style={{ width:100, fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>Added</div>
              <div style={{ width:90, fontSize:11, fontWeight:600, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:.5 }}>Last visited</div>
              <div style={{ width:80 }} />
            </div>
          )}

          {/* list */}
          <div style={{ flex:1, overflow:"auto", background:"#fff" }}>
            {sourceList.length===0 ? (
              <div style={{ textAlign:"center", padding:"80px 20px", color:"#a1a1aa" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>—</div>
                <div style={{ fontSize:14 }}>{searchQuery?"No results.":"No sources yet."}</div>
                {canEdit(user.role)&&!searchQuery&&<button onClick={()=>setPage("chat")} style={{ marginTop:14, background:"#18181b", color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add via chat</button>}
              </div>
            ) : sourceList.map(a=>(
              <SourceRow key={a.id} a={a} visitKey={visitKey} onVisit={handleVisit}
                onRemove={removeAccount}
                canRemove={a.owner===user.displayName||canRemoveAll(user.role)}
                userChannels={a.owner===user.displayName ? userChannels : null}
                onPostedTo={updatePostedTo}
                isMobile={isMobile}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── BROWSE TEAMMATES ── */}
      {page==="browse" && canBrowse(user.role) && (
        <div style={{ flex:1, overflow:"auto", paddingBottom: isMobile ? 70 : 0 }}>
          <div style={{ padding:`14px ${isMobile?14:20}px`, borderBottom:"1px solid #ebebeb", background:"#fff" }}>
            <div style={{ fontSize:14, fontWeight:600 }}>Browse Teammates</div>
            <div style={{ fontSize:13, color:"#a1a1aa", marginTop:2 }}>Tap a name to see their sources</div>
          </div>
          <div style={{ background:"#fff" }}>
            {users.filter(u=>u.role==="teammate").length===0 ? (
              <div style={{ padding:"60px 20px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No teammates yet.</div>
            ) : users.filter(u=>u.role==="teammate").map((u,i,arr)=>{
              const uAccounts = accounts.filter(a=>a.owner===u.displayName);
              const isOpen = browseExpanded===u.id;
              const nc = nameColor(u.displayName);
              return (
                <div key={u.id} style={{ borderBottom: i<arr.length-1?"1px solid #f2f2f2":"none" }}>
                  <div onClick={()=>setBrowseExpanded(isOpen?null:u.id)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:`11px ${isMobile?14:20}px`, cursor:"pointer", background:"#fff", WebkitTapHighlightColor:"transparent" }}>
                    <Avatar name={u.displayName} size={46} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{u.displayName}</div>
                      <div style={{ fontSize:12, color:"#a1a1aa", marginTop:1 }}>{uAccounts.length} source{uAccounts.length!==1?"s":""}</div>
                    </div>
                    <span style={{ color:"#d4d4d4", fontSize:12, transform:isOpen?"rotate(90deg)":"rotate(0deg)", transition:"transform .2s", display:"inline-block" }}>▶</span>
                  </div>
                  {isOpen && (
                    <div style={{ background:"#fafaf9", borderTop:"1px solid #f2f2f2" }}>
                      {uAccounts.length===0 ? (
                        <div style={{ padding:`12px ${isMobile?14:20}px`, fontSize:13, color:"#a1a1aa" }}>No sources yet.</div>
                      ) : uAccounts.map(a=>(
                        <div key={a.id} onClick={()=>{ handleVisit(a.id); window.open(`https://www.instagram.com/${a.username}`,"_blank","noreferrer"); }}
                          style={{ display:"flex", alignItems:"center", gap:12, padding:`10px ${isMobile?14:20}px`, paddingLeft: isMobile?46:56, borderBottom:"1px solid #f2f2f2", cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                          <Avatar name={a.username} size={36} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:500, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.username}</div>
                            {a.postedTo && <div style={{ fontSize:11, color:"#a1a1aa", marginTop:1 }}>{a.postedTo}</div>}
                          </div>
                          <div style={{ border:"1.5px solid #dbdbdb", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:600, color:"#18181b", flexShrink:0 }}>Open</div>
                        </div>
                      ))}
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
        <div style={{ flex:1, display:"flex", flexDirection:"column", paddingBottom: isMobile ? 70 : 0 }}>
          <div style={{ flex:1, overflow:"auto", padding:"16px 14px 8px" }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:10, gap:8, alignItems:"flex-end" }}>
                {m.role==="assistant"&&<div style={{ width:26, height:26, borderRadius:6, background:"#18181b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, flexShrink:0 }}>CV</div>}
                <div style={{ maxWidth:"80%", background:m.role==="user"?"#18181b":"#fff", color:m.role==="user"?"#fff":"#18181b", borderRadius:m.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px", padding:"10px 13px", fontSize:14, lineHeight:1.6, border:m.role==="assistant"?"1px solid #ebebeb":"none", whiteSpace:"pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex", gap:8, alignItems:"flex-end", marginBottom:10 }}>
                <div style={{ width:26, height:26, borderRadius:6, background:"#18181b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700 }}>CV</div>
                <div style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:"16px 16px 16px 3px", padding:"10px 14px", display:"flex", gap:4 }}>
                  {[0,1,2].map(d=><span key={d} style={{ width:5, height:5, borderRadius:"50%", background:"#a1a1aa", display:"inline-block", animation:`bounce 1s ${d*.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div style={{ padding:"8px 14px", display:"flex", gap:6, flexWrap:"wrap", borderTop:"1px solid #f2f2f2" }}>
            {["show my sources","is @username taken?","add instagram.com/...",...(canSeeAll(user.role)?["show all accounts"]:[])].map(s=>(
              <button key={s} onClick={()=>{setInput(s);inputRef.current?.focus();}} style={{ background:"#f4f4f5", border:"none", borderRadius:6, padding:"5px 10px", color:"#71717a", fontSize:12, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, padding:"10px 14px 14px", borderTop:"1px solid #f2f2f2", background:"#fff" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleChatKey} placeholder="Paste a link or @username…" rows={1}
              style={{ flex:1, background:"#f4f4f5", border:"none", borderRadius:10, padding:"10px 12px", color:"#18181b", fontSize:14, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }} />
            <button onClick={send} disabled={loading||!input.trim()} style={{ background:loading||!input.trim()?"#f4f4f5":"#18181b", color:loading||!input.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:10, width:42, height:42, cursor:loading||!input.trim()?"not-allowed":"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, alignSelf:"flex-end", transition:"all .15s" }}>↑</button>
          </div>
        </div>
      )}

      {/* ── WINNING PRODUCTS ── */}
      {page==="winning" && (
        <div style={{ flex:1, overflow:"auto", paddingBottom: isMobile ? 70 : 0 }}>
          {/* header */}
          <div style={{ padding:`14px ${isMobile?14:20}px`, borderBottom:"1px solid #ebebeb", background:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>Winning Products</div>
              <div style={{ fontSize:12, color:"#a1a1aa", marginTop:2 }}>Products doing well — source videos featuring these</div>
            </div>
            {canSeeAll(user.role) && (
              <button onClick={()=>setShowAddProd(!showAddProd)}
                style={{ background: showAddProd?"#f4f4f5":"#18181b", color: showAddProd?"#71717a":"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .15s" }}>
                {showAddProd ? "Cancel" : "+ Add"}
              </button>
            )}
          </div>

          {/* add product form */}
          {showAddProd && canSeeAll(user.role) && (
            <div style={{ padding:`14px ${isMobile?14:20}px`, borderBottom:"1px solid #ebebeb", background:"#fafaf9" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:480 }}>
                <input value={newProdName} onChange={e=>setNewProdName(e.target.value)} placeholder="Product name"
                  style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" }} />
                <input value={newProdImg} onChange={e=>setNewProdImg(e.target.value)} placeholder="Image URL (paste a direct image link)"
                  style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" }} />
                <input value={newProdLink} onChange={e=>setNewProdLink(e.target.value)} placeholder="Video link (YouTube, TikTok, etc.)"
                  style={{ background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" }} />
                {newProdImg && (
                  <img src={newProdImg} alt="preview" style={{ width:"100%", maxWidth:200, height:140, objectFit:"cover", borderRadius:10, border:"1px solid #e5e5e5" }} onError={e=>e.target.style.display="none"} />
                )}
                <button onClick={addProduct} disabled={addingProd||!newProdName.trim()||!newProdLink.trim()}
                  style={{ background:addingProd||!newProdName.trim()||!newProdLink.trim()?"#e5e5e5":"#18181b", color:addingProd||!newProdName.trim()||!newProdLink.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:8, padding:"10px", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                  {addingProd?"Adding…":"Add Product"}
                </button>
              </div>
            </div>
          )}

          {/* pinterest grid */}
          <div style={{ padding:`16px ${isMobile?12:20}px` }}>
            {loadingProducts ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#a1a1aa", fontSize:13 }}>Loading…</div>
            ) : products.length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 20px", color:"#a1a1aa" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>—</div>
                <div style={{ fontSize:14 }}>No winning products yet.</div>
                {canSeeAll(user.role) && <div style={{ fontSize:13, color:"#c7c7c7", marginTop:6 }}>Tap "+ Add" to add the first one.</div>}
              </div>
            ) : (
              <div style={{
                columns: isMobile ? 2 : 3,
                columnGap: isMobile ? 10 : 14,
              }}>
                {products.map(p => {
                  const daysAgo = Math.floor((Date.now() - new Date(p.addedAt).getTime()) / 86400000);
                  const timeLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
                  return (
                    <div key={p.id} style={{
                      breakInside: "avoid",
                      marginBottom: isMobile ? 10 : 14,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
                      cursor: "pointer",
                      transition: "transform .15s, box-shadow .15s",
                      display: "inline-block",
                      width: "100%",
                    }}
                      onClick={() => window.open(p.link, "_blank", "noreferrer")}
                      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)"; }}
                    >
                      {/* image */}
                      {p.imgUrl ? (
                        <div style={{ width:"100%", background:"#f4f4f5", position:"relative" }}>
                          <img src={p.imgUrl} alt={p.name}
                            style={{ width:"100%", display:"block", borderRadius:"14px 14px 0 0" }}
                            onError={e => { e.target.parentElement.style.display="none"; }}
                          />
                        </div>
                      ) : (
                        <div style={{ width:"100%", height:120, background:"linear-gradient(135deg,#f4f4f5,#e5e5e5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🎬</div>
                      )}
                      {/* info */}
                      <div style={{ padding:"10px 12px 12px" }}>
                        <div style={{ fontWeight:600, fontSize: isMobile?13:14, color:"#18181b", lineHeight:1.3, marginBottom:6 }}>{p.name}</div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:4 }}>
                          <span style={{ fontSize:11, color:"#a1a1aa" }}>{timeLabel}</span>
                          <span style={{ fontSize:11, color:"#a1a1aa" }}>by {p.addedBy}</span>
                        </div>
                        <div style={{ marginTop:8, background:"#18181b", color:"#fff", borderRadius:6, padding:"5px 10px", fontSize:11, fontWeight:600, textAlign:"center" }}>Watch video ↗</div>
                        {canSeeAll(user.role) && (
                          <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`Remove "${p.name}"?`)) removeProduct(p.id); }}
                            style={{ width:"100%", marginTop:6, background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#d4d4d4", padding:"2px 0" }}
                            onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#d4d4d4"}>Remove</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page==="admin" && canSeeAll(user.role) && (
        <div style={{ flex:1, overflow:"auto", paddingBottom: isMobile ? 70 : 0 }}>
          <div style={{ padding:`14px ${isMobile?14:20}px`, borderBottom:"1px solid #ebebeb", background:"#fff" }}>
            <div style={{ fontSize:14, fontWeight:600 }}>Admin Panel</div>
          </div>
          <div style={{ padding:`14px ${isMobile?14:20}px` }}>
            <div style={{ display:"flex", background:"#f4f4f5", borderRadius:7, padding:3, marginBottom:16, width:"fit-content" }}>
              {[{id:"accounts",l:"Accounts"},{id:"members",l:"Members"}].map(t=>(
                <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{ background:adminTab===t.id?"#fff":"transparent", border:"none", borderRadius:5, padding:"5px 14px", color:adminTab===t.id?"#18181b":"#71717a", fontWeight:adminTab===t.id?600:400, fontSize:13, cursor:"pointer", boxShadow:adminTab===t.id?"0 1px 3px rgba(0,0,0,0.07)":"none" }}>{t.l}</button>
              ))}
            </div>

            {adminTab==="accounts" && (
              <div style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:10, overflow:"hidden" }}>
                {accounts.length===0 ? <div style={{ padding:"40px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No accounts yet.</div>
                : accounts.sort((a,b)=>(b.addedAt||"").localeCompare(a.addedAt||"")).map((a,i,arr)=>(
                  <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:`10px ${isMobile?12:16}px`, borderBottom:i<arr.length-1?"1px solid #f2f2f2":"none" }}>
                    <Avatar name={a.username} size={34} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <a href={`https://www.instagram.com/${a.username}`} target="_blank" rel="noreferrer"
                        style={{ fontWeight:500, fontSize:13, color:"#18181b", textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>
                        {isMobile ? a.username : `instagram.com/${a.username}`}
                      </a>
                      <div style={{ fontSize:11, color:nameColor(a.owner), fontWeight:500, marginTop:1 }}>{a.owner}{a.postedTo ? ` · ${a.postedTo}` : ""}</div>
                    </div>
                    <span style={{ fontSize:11, color:"#c7c7c7", flexShrink:0 }}>{a.addedAt}</span>
                    <button onClick={()=>{ if(window.confirm(`Remove @${a.username}?`)) removeAccount(a.id); }}
                      style={{ background:"none", border:"1px solid #e5e5e5", borderRadius:5, cursor:"pointer", fontSize:11, padding:"3px 8px", color:"#a1a1aa", fontWeight:500, flexShrink:0 }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="#fef2f2"; e.currentTarget.style.color="#ef4444"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="#a1a1aa"; }}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            {adminTab==="members" && (
              <div style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:10, overflow:"hidden" }}>
                {users.length===0 ? <div style={{ padding:"40px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No members yet.</div>
                : users.sort((a,b)=>{const o={owner:0,manager:1,linktree:2,teammate:3};return(o[a.role]||3)-(o[b.role]||3);}).map((u,i,arr)=>(
                  <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:`10px ${isMobile?12:16}px`, borderBottom:i<arr.length-1?"1px solid #f2f2f2":"none" }}>
                    <Avatar name={u.displayName} size={34} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, fontSize:13 }}>{u.displayName}</div>
                      <div style={{ fontSize:11, color:ROLE_COLORS[u.role], fontWeight:600, marginTop:1 }}>{ROLE_LABELS[u.role]}</div>
                    </div>
                    <span style={{ fontSize:12, color:"#a1a1aa" }}>{accounts.filter(a=>a.owner===u.displayName).length} sources</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROFILE ── */}
      {page==="profile" && (
        <div style={{ flex:1, overflow:"auto", paddingBottom: isMobile ? 70 : 0 }}>
          <div style={{ padding:`14px ${isMobile?14:20}px`, borderBottom:"1px solid #ebebeb", background:"#fff" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Avatar name={user.displayName} size={48} />
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{user.displayName}</div>
                <div style={{ fontSize:12, color:color, fontWeight:600, marginTop:2 }}>{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
          </div>

          <div style={{ padding:`16px ${isMobile?14:20}px`, display:"flex", flexDirection:"column", gap:16 }}>
            {/* stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[{label:"My sources",value:myAccounts.length},{label:"Team total",value:accounts.length}].map(s=>(
                <div key={s.label} style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:24, fontWeight:700, color:"#18181b" }}>{s.value}</div>
                  <div style={{ fontSize:12, color:"#a1a1aa", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* YouTube channels */}
            <div style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:10, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>YouTube Channels</div>
              {userChannels.length===0 ? (
                <div style={{ fontSize:13, color:"#a1a1aa", marginBottom:12 }}>No channels added yet.</div>
              ) : userChannels.map((c,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f2f2f2" }}>
                  <div style={{ width:30, height:30, borderRadius:6, background:"#fee2e2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>▶</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#a1a1aa", textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>{c.url}</a>
                  </div>
                  <button onClick={()=>removeChannel(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#d4d4d4", fontSize:18, padding:"2px 4px" }}
                    onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#d4d4d4"}>×</button>
                </div>
              ))}
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:12 }}>
                <input value={newChName} onChange={e=>setNewChName(e.target.value)} placeholder="Channel name"
                  style={{ background:"#f4f4f5", border:"none", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" }} />
                <input value={newChUrl} onChange={e=>setNewChUrl(e.target.value)} placeholder="YouTube link"
                  style={{ background:"#f4f4f5", border:"none", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" }} />
                <button onClick={saveChannel} disabled={savingCh||!newChName.trim()||!newChUrl.trim()}
                  style={{ background:savingCh||!newChName.trim()||!newChUrl.trim()?"#f4f4f5":"#18181b", color:savingCh||!newChName.trim()||!newChUrl.trim()?"#a1a1aa":"#fff", border:"none", borderRadius:8, padding:"9px", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                  {savingCh?"Saving…":"Add channel"}
                </button>
              </div>
            </div>

            <button onClick={logout} style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:10, padding:"12px", color:"#ef4444", fontWeight:600, fontSize:13, cursor:"pointer" }}>Log out</button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-4px);opacity:1}} * { box-sizing: border-box; }`}</style>
    </div>
  );
}
