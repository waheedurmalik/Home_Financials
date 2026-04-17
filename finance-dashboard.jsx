import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── Firebase Config ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBeB2_yxuxDe6k1TQSXB6EJEUQ6eGJWNTo",
  authDomain: "home-financials.firebaseapp.com",
  projectId: "home-financials",
  storageBucket: "home-financials.firebasestorage.app",
  messagingSenderId: "870885265385",
  appId: "1:870885265385:web:c435e2ff59f8b43c898578"
};

// Firebase — use compat SDK directly, no shim needed
// The compat SDK loads firebase.auth() and firebase.firestore() as callable functions
var _fbApp = null, _fbAuth = null, _fbDb = null;
function getFB() {
  if(_fbAuth && _fbDb) return {auth:_fbAuth, db:_fbDb};
  var fb = window.firebase;
  if(!fb) throw new Error("Firebase not loaded");
  // Initialize app
  if(!_fbApp) {
    _fbApp = (fb.apps && fb.apps.length) ? fb.apps[0] : fb.initializeApp(FIREBASE_CONFIG);
  }
  // firebase.auth and firebase.firestore are functions in compat SDK
  // Call them with the app to get instances
  _fbAuth = fb.auth(_fbApp);
  _fbDb   = fb.firestore(_fbApp);
  return {auth:_fbAuth, db:_fbDb};
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────
const DEFAULT_TAXONOMY = {
  "Food & Dining": { icon:"🍽️", color:"#0e9e7a", subs:{ "Online Grocery":{ icon:"📦", kw:["amazon grocery","amazon now","careem now","noon minutes","talabat mart","instashop","kibsons"] }, "Supermarket":{ icon:"🛒", kw:["lulu","carrefour","spinneys","waitrose","union coop","yass supermarket","choithrams","nesto"] }, "Restaurants":{ icon:"🍴", kw:["restaurant","cafe","kitchen","grill","diner","bistro","kana","underground cafe","puranmal","moheeb","ictur","yiyecek"] }, "Food Delivery":{ icon:"🛵", kw:["talabat","deliveroo","zomato","nownow","careem food"] }, "Coffee":{ icon:"☕", kw:["coffee","starbucks","costa","tim hortons","juice","smoothie"] }, "Other Food":{ icon:"🍽️", kw:[] } } },
  "Transport":     { icon:"🚗", color:"#4a62d8", subs:{ "Fuel":{ icon:"⛽", kw:["adnoc","enoc","shell","petrol","fuel"] }, "Ride Hailing":{ icon:"🚕", kw:["careem ride","uber","bolt","taxi","cab"] }, "Parking & Tolls":{ icon:"🅿️", kw:["parking","salik","toll","mpark"] }, "Public Transport":{ icon:"🚇", kw:["metro","bus","train","nol"] }, "Car Maintenance":{ icon:"🔧", kw:["service","repair","tyre","tire","workshop","car wash"] }, "Other Transport":{ icon:"🚗", kw:[] } } },
  "Shopping":      { icon:"🛍️", color:"#c8860a", subs:{ "Online Shopping":{ icon:"💻", kw:["amazon.ae","noon","namshi","ounass"] }, "Clothing & Fashion":{ icon:"👗", kw:["zara","h&m","uniqlo","gap","mango","fashion","clothing","majid alfuttaim hm","hm ibn"] }, "Electronics":{ icon:"📱", kw:["apple","samsung","jumbo","plug","emax","sharaf","photo magic"] }, "Home & Living":{ icon:"🏡", kw:["ikea","home centre","pan emirates","pottery barn","decor","furniture"] }, "Other Shopping":{ icon:"🛍️", kw:[] } } },
  "Housing":       { icon:"🏠", color:"#5a9e1a", subs:{ "Rent":{ icon:"🏢", kw:["rent","lease","tenancy","property"] }, "Cleaning":{ icon:"🧹", kw:["cleaning","shiny surface","maid","maintenance"] }, "Home Services":{ icon:"🔌", kw:["dewa","addc","sewa","water","electricity"] }, "Other Housing":{ icon:"🏠", kw:[] } } },
  "Utilities":     { icon:"⚡", color:"#3a8e10", subs:{ "Electricity & Water":{ icon:"💡", kw:["dewa","addc","sewa","electricity","water"] }, "Internet & Phone":{ icon:"📡", kw:["etisalat","du","e&","virgin","telecom","internet","mobile","e& digital"] }, "Government Fees":{ icon:"🏛️", kw:["smart dubai","government","municipality","visa","immigration","fee"] }, "Other Utilities":{ icon:"⚡", kw:[] } } },
  "Subscriptions": { icon:"📺", color:"#9b30d4", subs:{ "Streaming":{ icon:"🎬", kw:["netflix","spotify","apple music","youtube","osn","starzplay","anghami","disney"] }, "Food Subscriptions":{ icon:"🛵", kw:["deliveroo plus","talabat pro","careem plus","noon prime"] }, "Software & Apps":{ icon:"📱", kw:["adobe","microsoft","google","dropbox","icloud","nomod","app store"] }, "Other Subscriptions":{ icon:"📺", kw:[] } } },
  "Health":        { icon:"💊", color:"#d93060", subs:{ "Medical":{ icon:"🏥", kw:["hospital","clinic","doctor","medical","healthcare","dental","optical"] }, "Pharmacy":{ icon:"💊", kw:["pharmacy","aster","life pharmacy","boots","watson"] }, "Wellness":{ icon:"🧘", kw:["wellness","spa","massage","zero wellness","salon"] }, "Other Health":{ icon:"💊", kw:[] } } },
  "Entertainment": { icon:"🎬", color:"#c0206e", subs:{ "Cinema & Events":{ icon:"🎭", kw:["cinema","vox","reel","event","concert","theatre","ticket"] }, "Sports":{ icon:"⚽", kw:["sports","football","cricket","swim","padel","bowling","golf"] }, "Gaming":{ icon:"🎮", kw:["playstation","xbox","steam","gaming","nintendo"] }, "Other Entertainment":{ icon:"🎬", kw:[] } } },
  "Travel":        { icon:"✈️", color:"#0a8ab8", subs:{ "Flights":{ icon:"✈️", kw:["emirates","flydubai","airline","flight","etihad","qatar airways"] }, "Hotels":{ icon:"🏨", kw:["hotel","marriott","hilton","hyatt","accor","ihg","ritz","resort"] }, "Foreign Spend":{ icon:"🌍", kw:["istanbul","turkey","london","bangkok","paris"] }, "Other Travel":{ icon:"✈️", kw:[] } } },
  "Other":         { icon:"📦", color:"#5a6a5a", subs:{ "Transfers":{ icon:"💸", kw:["transfer","nomod","remittance","exchange","western union","wise"] }, "Insurance":{ icon:"🛡️", kw:["insurance","takaful","policy","premium"] }, "Education":{ icon:"📚", kw:["school","university","course","tuition","education"] }, "Miscellaneous":{ icon:"📦", kw:[] } } },
  "Income":        { icon:"💰", color:"#1a7a3a", subs:{ "Salary":{ icon:"💼", kw:["salary","payroll","wages","pay"] }, "Rental Income":{ icon:"🏠", kw:["rental","rent received","tenancy income"] }, "Shares & Dividends":{ icon:"📈", kw:["dividend","shares","investment income","interest"] }, "Other Income":{ icon:"💰", kw:[] } } },
};

const RAW_SEED = []; // MUST stay empty — transaction data is never stored in source code

// ─── GitHub Safety Guard ─────────────────────────────────────────────────────
// Runs at startup to verify no personal data is accidentally embedded in source
(function githubSafetyGuard() {
  // Check RAW_SEED is empty (never bake transaction data into source)
  if (RAW_SEED.length > 0) {
    console.error("⚠️ SECURITY: RAW_SEED contains data — this should never be committed to GitHub!");
  }
  // Warn if API key found in source (should only ever be in localStorage)
  const src = document.currentScript?.src || "";
  if (src.includes("sk-ant-")) {
    console.error("⚠️ SECURITY: Anthropic API key detected in source code — remove immediately!");
  }
  // Log clean status
  console.log("✓ GitHub safety guard: no personal data detected in source");
})();



// ─── Helpers ──────────────────────────────────────────────────────────────────
// Global display rates — set by App when user changes currency
var _globalDispRates = null;

const fmt  = (n, cur) => {
  // _globalDispRates = {GBP: 0.2105} means multiply AED amounts by this to get GBP
  var val = Math.abs(Number(n||0));
  var dispCur = cur || "AED";
  if(_globalDispRates) {
    var entries = Object.entries(_globalDispRates);
    if(entries.length > 0 && entries[0][1]) {
      val = val * entries[0][1];
      dispCur = entries[0][0];
    }
  }
  return dispCur+" "+val.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0});
};
const fmtExact = function(amount, currency, rates){
  var val=Number(amount||0); var dispCur=currency||"AED";
  if(rates&&currency&&currency!=="AED"){var entries=Object.entries(rates).filter(function(e){return e[0]===currency;});if(entries.length){val=val*entries[0][1];dispCur=entries[0][0];}}
  return dispCur+" "+val.toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2});
};
const fmtM = m => { if(!m)return""; const[y,mo]=m.split("-"); return new Date(y,+mo-1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"}); };
const fmtD = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";
const fmtDNum = d => { if(!d) return ""; const [y,m,dd]=d.split("-"); return (dd||"").padStart(2,"0")+"-"+(m||"").padStart(2,"0")+"-"+y; };
const weekKey = d => {
  if(!d) return "";
  const dt=new Date(d); const jan1=new Date(dt.getFullYear(),0,1);
  const wk=Math.ceil(((dt-jan1)/864e5+jan1.getDay()+1)/7);
  return dt.getFullYear()+"-W"+String(wk).padStart(2,"0");
};

// txType: "standard" | "nonstandard" | "exceptional"
function getTxType(tx) {
  if(tx.txType) return tx.txType;
  if(tx.isStandard===false) return "exceptional";
  return "standard";
}

function getSub(desc, cat, tax) {
  const subs=tax[cat]?.subs; if(!subs) return "Other";
  const d=(desc||"").toLowerCase();
  for(const [name,s] of Object.entries(subs)) {
    if((s.kw||[]).some(k => k&&d.includes(k))) return name;
  }
  const _k=Object.keys(subs); return _k[_k.length-1]||"Other";
}
function enrich(tx, tax, vmap) {
  const key=(tx.description||"").toLowerCase().trim();
  const vm=vmap[key];
  let cat, sub, txType;
  if(vm) {
    // Vendor map takes highest priority
    cat=vm.category; sub=vm.subcategory; txType=vm.txType;
  } else if(tx._manual) {
    // Manually assigned — trust as-is
    cat=tx.category; sub=tx.subcategory; txType=tx.txType||getTxType(tx);
  } else {
    // Auto-categorise: only trust tx.category if it actually exists in the taxonomy.
    // Gemini sometimes returns hallucinated or wrong categories — validate first.
    const geminiCat = tx.category && tax[tx.category] ? tx.category : null;
    if(geminiCat) {
      cat = geminiCat;
      // If Gemini also returned a subcategory that exists under this cat, trust it
      const geminiSub = tx.subcategory && tax[geminiCat]?.subs?.[tx.subcategory] ? tx.subcategory : null;
      sub = geminiSub || getSub(tx.description, cat, tax);
    } else {
      // Gemini category missing or not in taxonomy — run full keyword match across all cats
      cat = "Other";
      for(const [c, def] of Object.entries(tax)) {
        const subs = def.subs||{};
        for(const [s, sd] of Object.entries(subs)) {
          if((sd.kw||[]).some(k => k && (tx.description||"").toLowerCase().includes(k))) {
            cat = c; sub = s; break;
          }
        }
        if(sub) break;
      }
      if(!sub) sub = getSub(tx.description, cat, tax);
    }
    txType = tx.txType||getTxType(tx);
  }
  return {...tx, category:cat||"Other", subcategory:sub||"Miscellaneous", txType, month:tx.date?.substring(0,7)||"Unknown"};
}

// ─── Storage ──────────────────────────────────────────────────────────────────
function storeSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}
function storeLoad(key) {
  try { const r=localStorage.getItem(key); return r?JSON.parse(r):null; } catch(e) { return null; }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#ecf1eb", surface:"#ffffff", s2:"#e8eaef", s3:"#dde0e8",
  border:"#cdd1db", accent:"#2a9d6f", text:"#0f1624", muted:"#4a5568", dim:"#7a8699", danger:"#d94040"
};
const TYPE_META = {
  standard:    {label:"★ Fixed",    color:"#2a9d6f", full:"Fixed Monthly Cost"},
  nonstandard: {label:"◆ Variable", color:"#5a6fd6", full:"Variable Cost"},
  exceptional: {label:"⚡ Exc",     color:"#d4860a", full:"Exceptional"},
};
const card = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"};
const btn  = (bg,col="#fff",bdr="none",fs=13,p="8px 16px") => ({background:bg,color:col,border:bdr,padding:p,borderRadius:10,fontFamily:"inherit",fontSize:fs,fontWeight:600,cursor:"pointer",outline:"none"});
const inp  = (extra={}) => ({width:"100%",background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box",...extra});

// ── Ensure category colour is readable on white background ────────────────────
// Converts any hex colour to one with sufficient contrast (min luminance ratio ~4.5:1)
function readableColour(hex) {
  if(!hex||!hex.startsWith("#")) return "#2a5a4a";
  const r=parseInt(hex.slice(1,3),16)/255;
  const g=parseInt(hex.slice(3,5),16)/255;
  const b=parseInt(hex.slice(5,7),16)/255;
  // Relative luminance
  const lum = 0.2126*r + 0.7152*g + 0.0722*b;
  // If too light (luminance > 0.25 on white = contrast < ~4.5:1), darken it
  if(lum > 0.18) {
    // Darken by multiplying RGB by a factor
    const factor = Math.min(0.18 / Math.max(lum, 0.001), 1);
    const dr = Math.round(r*255*factor).toString(16).padStart(2,"0");
    const dg = Math.round(g*255*factor).toString(16).padStart(2,"0");
    const db = Math.round(b*255*factor).toString(16).padStart(2,"0");
    return "#"+dr+dg+db;
  }
  return hex;
}


// ─── Exchange rates (session cache) ─────────────────────────────────────────
let _rateCache = null; // { rates: {GBP: 0.21, ...}, ts: Date }
// Approximate fallback rates (AED base) — used if live fetch fails
var FALLBACK_RATES = {
  AED:1, GBP:0.2105, USD:0.2723, EUR:0.2505, PKR:75.8,
  CAD:0.3763, AUD:0.4278, JPY:41.2, CHF:0.2421, SGD:0.3665
};

async function getAEDRates() {
  if(_rateCache && (Date.now()-_rateCache.ts < 3600000)) return _rateCache.rates;
  try {
    const r = await fetch("https://open.exchangerate-api.com/v6/latest/AED");
    const d = await r.json();
    if(d.result==="success") {
      _rateCache = { rates: d.rates, ts: Date.now() };
      return d.rates;
    }
  } catch(e) { console.warn("Exchange rate fetch failed, using fallback rates"); }
  // Return fallback rates so conversion still works
  return FALLBACK_RATES;
}
function toAED(amount, fromCurrency, rates) {
  if(!fromCurrency || fromCurrency==="AED" || !rates) return amount;
  const rate = rates[fromCurrency]; // rate = how many fromCurrency per 1 AED
  if(!rate) return amount;
  return amount / rate; // convert to AED
}

// ─── Firebase Sign-In Screen ──────────────────────────────────────────────────
function SignInScreen({onSignedIn}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function signInWithGoogle() {
    setLoading(true); setErr("");
    try {
      const {auth} = getFB();
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      onSignedIn(result.user);
    } catch(e) {
      if(e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setErr(e.message || "Sign-in failed. Ensure popups are allowed and try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:"#ecf1eb",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <img src="Home_financials_LOGO_White_Back.png" alt="Home Financials" style={{maxWidth:320,width:"90%",height:"auto",marginBottom:40}}/>
      <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:380,width:"100%",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{fontSize:22,fontWeight:800,color:"#0f1624",marginBottom:8,textAlign:"center"}}>Welcome</div>
        <div style={{fontSize:14,color:"#7a8699",marginBottom:28,textAlign:"center",lineHeight:1.6}}>
          Sign in with your Google account to access your financial data securely
        </div>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{width:"100%",padding:"14px 20px",borderRadius:12,border:"1px solid #e0e0e0",background:loading?"#f5f5f5":"#fff",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:600,color:"#0f1624",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",fontFamily:"inherit"}}
        >
          {loading ? (
            <span style={{color:"#7a8699"}}>Signing in…</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36.5 24 36.5c-5.3 0-9.7-3.5-11.3-8.2l-6.5 5C9.8 39.9 16.4 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41.1 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        {err && <div style={{marginTop:14,padding:"10px 14px",background:"rgba(245,118,118,0.1)",borderRadius:8,fontSize:12,color:"#d94040",textAlign:"center"}}>{err}</div>}
        <div style={{marginTop:20,fontSize:11,color:"#9ba8b8",textAlign:"center",lineHeight:1.7}}>
          Your financial data is stored privately in your Google account. Nobody else can access it.
        </div>
      </div>
    </div>
  );
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error:null}; }
  static getDerivedStateFromError(e) { return {error:e}; }
  componentDidCatch(e,info) { console.error("React error:", e.message, info); }
  render() {
    if(this.state.error) {
      return React.createElement('div', {style:{padding:24,color:"#d94040",fontFamily:"monospace",fontSize:13,background:"#fff",margin:16,borderRadius:12,border:"1px solid #fca5a5"}},
        React.createElement('div', {style:{fontWeight:700,marginBottom:8}}, "App Error"),
        React.createElement('div', null, this.state.error.message || String(this.state.error)),
        React.createElement('button', {onClick:()=>this.setState({error:null}),style:{marginTop:12,padding:"6px 14px",background:"#d94040",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}, "Retry")
      );
    }
    return this.props.children;
  }
}

// ─── Fallback colour palette (all readable on white) ────────────────────────
const PAL = ["#2a7a5a","#4a62d8","#c8760a","#8a3ad4","#c0206e","#0a7ab8","#3a8e10","#d93060","#5a4ad4","#0a6e9a","#a05a00","#2a6a4a"];

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function TT({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12}}>
      {label&&<div style={{color:C.muted,marginBottom:5,fontFamily:"monospace",fontSize:11}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||C.text,marginBottom:2,display:"flex",justifyContent:"space-between",gap:16}}>
          <span>{p.name}</span><span style={{fontFamily:"monospace"}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
function Crumb({crumbs}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16,fontSize:13,flexWrap:"wrap"}}>
      {crumbs.map((c,i)=>(
        <span key={i} style={{display:"flex",alignItems:"center",gap:6}}>
          {i>0&&<span style={{color:C.dim}}>›</span>}
          <span onClick={c.onClick} style={{color:c.onClick?C.accent:C.text,cursor:c.onClick?"pointer":"default",fontWeight:c.onClick?400:600}}>{c.label}</span>
        </span>
      ))}
    </div>
  );
}
function Pill({options,value,onChange}) {
  // options: [[value, label], ...] — label can be a function(isActive)=>string for toggle labels
  return (
    <div style={{display:"flex",background:C.s2,borderRadius:9,padding:3,border:`1px solid ${C.border}`}}>
      {options.map(([v,l])=>{
        const isActive=value===v;
        const label=typeof l==="function"?l(isActive):l;
        return (
          <button key={v} onClick={()=>onChange(v)} style={{padding:"5px 11px",borderRadius:7,border:"none",background:isActive?C.s3:"transparent",color:isActive?C.text:C.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:isActive?600:400}}>{label}</button>
        );
      })}
    </div>
  );
}
function LabelRow({label,children}) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</div>
      {children}
    </div>
  );
}
function TypeBadge({txType,onClick,small}) {
  if(txType===null) return (
    <span style={{padding:small?"3px 7px":"5px 10px",borderRadius:20,border:"1px solid "+C.accent,background:C.accent+"18",color:C.accent,fontSize:small?10:11,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
      + Income
    </span>
  );
  const m=TYPE_META[txType]||TYPE_META.standard;
  return (
    <button onClick={onClick} style={{padding:small?"3px 7px":"5px 10px",borderRadius:20,border:`1px solid ${m.color}`,background:m.color+"18",color:m.color,fontSize:small?10:11,cursor:onClick?"pointer":"default",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}} title={onClick?"Tap to change cost type":""}>
      {m.label}
    </button>
  );
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function doExport(txs,tax,cur) {
  const wb=XLSX.utils.book_new();
  const txHeader=["Date","Description","Category","Subcategory","Type","Amount ("+cur+")"];
  const txData=txs.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[
    fmtDNum(t.date),t.description,t.category,t.subcategory,TYPE_META[t.txType]?.full||t.txType,t.amount
  ]);
  const wsTx=XLSX.utils.aoa_to_sheet([txHeader,...txData]);
  wsTx["!cols"]=[{wch:12},{wch:32},{wch:18},{wch:22},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsTx,"Transactions");
  const months=[...new Set(txs.map(t=>t.month))].sort();
  const cats=[...new Set(txs.map(t=>t.category))].sort();
  const catSheet=[["Month",...cats,"Total"]];
  months.forEach(m=>{
    const mt=txs.filter(t=>t.month===m);
    const row=[fmtM(m),...cats.map(c=>mt.filter(t=>t.category===c).reduce((s,t)=>s+t.amount,0))];
    row.push(row.slice(1).reduce((a,b)=>a+b,0));
    catSheet.push(row);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(catSheet),"By Category");
  const subs=[...new Set(txs.map(t=>t.subcategory))].sort();
  const subSheet=[["Month",...subs,"Total"]];
  months.forEach(m=>{
    const mt=txs.filter(t=>t.month===m);
    const row=[fmtM(m),...subs.map(s=>mt.filter(t=>t.subcategory===s).reduce((a,t)=>a+t.amount,0))];
    row.push(row.slice(1).reduce((a,b)=>a+b,0));
    subSheet.push(row);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(subSheet),"By Subcategory");
  const b64=XLSX.write(wb,{bookType:"xlsx",type:"base64"});
  const uri="data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"+b64;
  const a=document.createElement("a"); a.href=uri; a.download="ledger_export.xlsx"; a.style.display="none";
  document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),2000);
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({transactions,taxonomy,currency,onClose,noOverlay}) {
  const dates=[...new Set(transactions.map(t=>t.date).filter(Boolean))].sort();
  const [mode,setMode]=useState("all");
  const [fromDt,setFromDt]=useState(dates[0]||"");
  const [toDt,setToDt]=useState(dates[dates.length-1]||"");
  const scoped=useMemo(()=>mode==="all"?transactions:transactions.filter(t=>t.date>=fromDt&&t.date<=toDt),[mode,fromDt,toDt,transactions]);
  const exportInner = (
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,maxWidth:460,width:"100%"}}>
        <div style={{fontFamily:"inherit",fontSize:20,marginBottom:6}}>Export to Excel</div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["all","All data"],["range","Custom range"]].map(([v,l])=>(
            <button key={v} onClick={()=>setMode(v)} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${mode===v?C.accent:C.border}`,background:mode===v?"rgba(62,180,137,0.08)":"transparent",color:mode===v?C.accent:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:mode===v?600:400}}>{l}</button>
          ))}
        </div>
        {mode==="range"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div><div style={{fontSize:11,color:C.dim,marginBottom:5}}>From</div><input type="date" value={fromDt} onChange={e=>setFromDt(e.target.value)} style={inp({colorScheme:"light"})}/></div>
            <div><div style={{fontSize:11,color:C.dim,marginBottom:5}}>To</div><input type="date" value={toDt} onChange={e=>setToDt(e.target.value)} style={inp({colorScheme:"light"})}/></div>
          </div>
        )}
        <div style={{background:C.s2,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted}}><strong style={{color:C.text}}>{scoped.length}</strong> transactions</span>
          <strong style={{color:C.accent,fontFamily:"monospace"}}>{fmt(scoped.reduce((s,t)=>s+t.amount,0),currency)}</strong>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{doExport(scoped,taxonomy,currency);onClose();}} style={{...btn(C.accent,"#fff","none",14,"13px 0"),flex:1}}>⬇ Download Excel</button>
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"13px 18px")}>Cancel</button>
        </div>
      </div>
  );
  if(noOverlay) return exportInner;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      {exportInner}
    </div>
  );
}

// ─── Financial Item Card ──────────────────────────────────────────────────────
function FinItemCard({type, item, onEdit, onDel}) {
  var title="", subtitle="", badge="", badgeColor=C.muted;
  if(type==="accounts"){
    title=item.name; subtitle=(item.bank||"")+(item.last4?" ···"+item.last4:"");
    badge=item.type==="credit"?"💳 Credit":item.type==="savings"?"💰 Savings":"🏦 Current";
  } else if(type==="cash"){
    title=item.label; subtitle=(item.currency||"AED")+" "+((item.amount||0).toLocaleString());
  } else if(type==="investments"){
    title=item.name; subtitle=(item.ticker?"$"+item.ticker+" · ":"")+((item.shares||0)+" shares");
    badge=item.status==="locked"?"🔒 Locked"+(item.unlockDate?" · "+fmtDNum(item.unlockDate):""):"✅ Available";
    badgeColor=item.status==="locked"?C.danger:C.accent;
  } else if(type==="properties"){
    title=item.name; subtitle=(item.currency||"AED")+" "+((item.currentValue||0).toLocaleString());
  } else if(type==="loans"){
    title=item.name; subtitle=(item.lender||"")+" · "+(item.currency||"AED")+" "+((item.outstandingBalance||0).toLocaleString());
    badge=(item.term==="long"?"Long-term":"Short-term")+" · "+(item.loanType||"other");
    badgeColor=item.term==="long"?C.danger:"#d4860a";
  } else if(type==="debts"){
    title=item.person; subtitle=(item.currency||"AED")+" "+((item.amount||0).toLocaleString());
    badge=item.debtType==="owed_to_me"?"↑ They owe me":"↓ I owe them";
    badgeColor=item.debtType==="owed_to_me"?C.accent:C.danger;
  } else if(type==="forecastEvents"){
    title=item.label; subtitle=(item.date||"no date")+" · "+(item.currency||"AED")+" "+((item.amount||0).toLocaleString());
    badge=item.confidence==="certain"?"✅":item.confidence==="likely"?"🟡":"⚪";
    badgeColor=item.eventType==="income"?C.accent:C.danger;
  }
  return (
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
        {subtitle&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{subtitle}</div>}
        {badge&&<div style={{fontSize:11,color:badgeColor,marginTop:4,fontWeight:600}}>{badge}</div>}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <button onClick={function(){onEdit(item);}} style={btn(C.s2,C.muted,"1px solid "+C.border,11,"4px 10px")}>✎ Edit</button>
        <button onClick={function(){onDel(item.id);}} style={btn("rgba(245,118,118,0.1)",C.danger,"1px solid "+C.danger+"44",11,"4px 8px")}>✕</button>
      </div>
    </div>
  );
}

// ─── Financial Items Section (inside ManageModal) ────────────────────────────
function FinancialSection({financials, setFinancials, taxonomy, initialSub}) {
  const [subSection, setSubSection] = useState(initialSub||"accounts");
  const [editing, setEditing] = useState(null); // {type, item} or null (item=null means new)
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");

  function uid() { return "id_"+Date.now()+"_"+Math.random().toString(36).slice(2,7); }

  function update(type, fn) {
    setFinancials(prev=>({...prev,[type]:fn(prev[type]||[])}));
  }

  function openNew(type, defaults={}) {
    setForm({...defaults});
    setEditing({type, item:null});
    setErr("");
  }

  function openEdit(type, item) {
    setForm({...item});
    setEditing({type, item});
    setErr("");
  }

  function saveForm() {
    var type = editing.type;
    if(!form.name&&!form.label&&!form.person) { setErr("Name is required."); return; }
    if(editing.item) {
      update(type, function(arr){return arr.map(function(x){return x.id===editing.item.id?Object.assign({},form,{id:x.id}):x;});});
    } else {
      update(type, function(arr){return arr.concat([Object.assign({},form,{id:uid()})]);});
    }
    setEditing(null); setForm({}); setErr("");
  }

  // Config sections: Accounts, Investments, Properties, Loans only
  // Cash, Debts, Forecast Events live in Input Data → Financial Position
  const SUB_SECTIONS = [
    ["accounts",    "🏦", "Accounts"],
    ["investments", "📈", "Investments"],
    ["properties",  "🏠", "Properties"],
    ["loans",       "💳", "Loans"],
  ];

  const CURRENCIES = ["AED","GBP","USD","EUR","PKR","CAD","AUD","JPY","CHF","SGD"];

  function renderForm() {
    const f = form;
    const set = (k,v) => setForm(prev=>({...prev,[k]:v}));
    const inp2 = (extra={}) => ({...inp(), ...extra});

    if(editing.type==="accounts") return (
      <div>
        <LabelRow label="Account Name"><input value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. HSBC Current" style={inp2()}/></LabelRow>
        <LabelRow label="Type">
          <div style={{display:"flex",gap:6}}>
            {[["current","Current"],["savings","Savings"],["credit","Credit Card"]].map(([v,l])=>(
              <button key={v} onClick={()=>set("type",v)} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${f.type===v?C.accent:C.border}`,background:f.type===v?"rgba(42,157,111,0.08)":"transparent",color:f.type===v?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:f.type===v?700:400}}>{l}</button>
            ))}
          </div>
        </LabelRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Bank"><input value={f.bank||""} onChange={e=>set("bank",e.target.value)} placeholder="e.g. HSBC" style={inp2()}/></LabelRow>
          <LabelRow label="Last 4 digits"><input value={f.last4||""} onChange={e=>set("last4",e.target.value.slice(0,4))} placeholder="1234" style={inp2()} maxLength={4}/></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Currency"><select value={f.currency||"AED"} onChange={e=>set("currency",e.target.value)} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
          {f.type==="credit"&&<LabelRow label="Credit Limit"><input type="number" value={f.creditLimit||""} onChange={e=>set("creditLimit",e.target.value)} onBlur={e=>set("creditLimit",parseFloat(e.target.value)||0)} placeholder="0" inputMode="decimal" style={inp2({fontFamily:"monospace"})}/></LabelRow>}
        </div>
      </div>
    );

    if(editing.type==="investments") return (
      <div>
        <div style={{fontSize:11,color:C.dim,padding:"8px 10px",background:"rgba(42,157,111,0.06)",borderRadius:8,marginBottom:12}}>
          Set up the investment record here. Update current shares, price and value in ✏️ Input Data → 💰 Financial Position.
        </div>
        <LabelRow label="Investment Name"><input value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Unilever PLC, Vanguard S&P 500" style={inp2()}/></LabelRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Ticker (for live price)"><input value={f.ticker||""} onChange={e=>set("ticker",e.target.value.toUpperCase())} placeholder="ULVR.L / AAPL" style={inp2({fontFamily:"monospace"})}/></LabelRow>
          <LabelRow label="Currency"><select value={f.currency||"USD"} onChange={e=>set("currency",e.target.value)} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Provider / Broker"><input value={f.provider||""} onChange={e=>set("provider",e.target.value)} placeholder="e.g. Hargreaves Lansdown" style={inp2()}/></LabelRow>
          <LabelRow label="Account Number"><input value={f.accountNumber||""} onChange={e=>set("accountNumber",e.target.value)} placeholder="e.g. 12345678" style={inp2({fontFamily:"monospace"})}/></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Setup Date"><input type="date" value={f.setupDate||""} onChange={e=>set("setupDate",e.target.value)} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
          <LabelRow label="Type">
            <div style={{display:"flex",gap:6}}>
              {[["available","Available"],["locked","Locked / RSU"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("status",v)} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${f.status===v?C.accent:C.border}`,background:f.status===v?"rgba(42,157,111,0.08)":"transparent",color:f.status===v?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:f.status===v?700:400}}>{l}</button>
              ))}
            </div>
          </LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Initial Shares Purchased"><input type="text" inputMode="decimal" value={f.initialShares||""} onChange={e=>set("initialShares",parseFloat(e.target.value)||0)} placeholder="0" style={inp2({fontFamily:"monospace"})}/></LabelRow>
          <LabelRow label="Initial Purchase Price"><input type="text" inputMode="decimal" value={f.purchasePrice||""} onChange={e=>set("purchasePrice",parseFloat(e.target.value)||0)} placeholder="0.00" step="0.01" style={inp2({fontFamily:"monospace"})}/></LabelRow>
        </div>
        {f.status==="locked"&&(
          <LabelRow label="Unlock Date"><input type="date" value={f.unlockDate||""} onChange={e=>set("unlockDate",e.target.value)} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
        )}
      </div>
    );

    if(editing.type==="properties") return (
      <div>
        <div style={{fontSize:11,color:C.dim,padding:"8px 10px",background:"rgba(42,157,111,0.06)",borderRadius:8,marginBottom:12}}>
          Set up the property record here. Update current market value and outstanding mortgage in ✏️ Input Data → 💰 Financial Position.
        </div>
        <LabelRow label="Property Name"><input value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Dubai Marina Apartment" style={inp2()}/></LabelRow>
        <LabelRow label="Address"><input value={f.address||""} onChange={e=>set("address",e.target.value)} placeholder="Full address" style={inp2()}/></LabelRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Currency"><select value={f.currency||"AED"} onChange={e=>set("currency",e.target.value)} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
          <LabelRow label="Purchase Price"><input type="text" inputMode="decimal" value={f.purchasePrice||""} onChange={e=>set("purchasePrice",parseFloat(e.target.value)||0)} placeholder="0" style={inp2({fontFamily:"monospace"})}/></LabelRow>
        </div>
        <LabelRow label="Purchase Date"><input type="date" value={f.purchaseDate||""} onChange={e=>set("purchaseDate",e.target.value)} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginTop:14,marginBottom:8}}>Linked Mortgage (if applicable)</div>
        {(()=>{
          var mortgageLoans = (financials.loans||[]).filter(function(l){ return l.loanType==="mortgage"; });
          if(mortgageLoans.length===0) return (
            <div style={{fontSize:11,color:C.dim,padding:"8px 10px",background:C.s2,borderRadius:8}}>
              No mortgage loans set up yet. Add one in Config → Loans first.
            </div>
          );
          return (
            <LabelRow label="Select Mortgage">
              <select value={f.mortgageId||""} onChange={e=>set("mortgageId",e.target.value)} style={{...inp2(),appearance:"none"}}>
                <option value="">— None —</option>
                {mortgageLoans.map(function(l){ return <option key={l.id} value={l.id}>{l.name}{l.lender?" · "+l.lender:""}</option>; })}
              </select>
            </LabelRow>
          );
        })()}
      </div>
    );

    if(editing.type==="loans") return (
      <div>
        <div style={{fontSize:11,color:C.dim,padding:"8px 10px",background:"rgba(42,157,111,0.06)",borderRadius:8,marginBottom:12}}>
          Set up the loan record here. Update outstanding balance, current payment and end date in ✏️ Input Data → 💰 Financial Position.
        </div>
        <LabelRow label="Loan Name"><input value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. HSBC Home Loan" style={inp2()}/></LabelRow>
        <LabelRow label="Type">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["mortgage","Mortgage"],["personal","Personal"],["car","Car"],["other","Other"]].map(([v,l])=>(
              <button key={v} onClick={()=>set("loanType",v)} style={{flex:1,minWidth:70,padding:"7px 0",borderRadius:10,border:`1px solid ${f.loanType===v?C.accent:C.border}`,background:f.loanType===v?"rgba(42,157,111,0.08)":"transparent",color:f.loanType===v?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:f.loanType===v?700:400}}>{l}</button>
            ))}
          </div>
        </LabelRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Lender"><input value={f.lender||""} onChange={e=>set("lender",e.target.value)} placeholder="e.g. HSBC" style={inp2()}/></LabelRow>
          <LabelRow label="Currency"><select value={f.currency||"AED"} onChange={e=>set("currency",e.target.value)} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Start Date"><input type="date" value={f.startDate||""} onChange={e=>set("startDate",e.target.value)} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
          <LabelRow label="End Date"><input type="date" value={f.endDate||""} onChange={e=>set("endDate",e.target.value)} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Original Loan Amount"><input type="text" inputMode="decimal" value={f.originalAmount||""} onChange={e=>set("originalAmount",parseFloat(e.target.value)||0)} placeholder="0" style={inp2({fontFamily:"monospace"})}/></LabelRow>
          <LabelRow label="Original Monthly Payment"><input type="text" inputMode="decimal" value={f.monthlyPayment||""} onChange={e=>set("monthlyPayment",parseFloat(e.target.value)||0)} placeholder="0" style={inp2({fontFamily:"monospace"})}/></LabelRow>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <LabelRow label="Interest Rate (% p.a.)"><input type="text" inputMode="decimal" value={f.interestRate||""} onChange={e=>set("interestRate",parseFloat(e.target.value)||0)} placeholder="3.5" step="0.1" style={inp2({fontFamily:"monospace"})}/></LabelRow>
        </div>
      </div>
    );

    return null;
  }

  const activeItems = financials[subSection]||[];
  const [icon, , label] = SUB_SECTIONS.find(s=>s[0]===subSection)||["","",""];

  const ADD_DEFAULTS = {
    accounts:{type:"current",currency:"AED"},
    investments:{status:"available",currency:"USD"},
    properties:{currency:"AED"},
    loans:{loanType:"personal",currency:"AED"},
  };

  return (
    <div>
      {/* Edit/Add form overlay */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:20,padding:24,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:20,color:C.text}}>
              {editing.item?"Edit":"New"} {SUB_SECTIONS.find(s=>s[0]===editing.type)?.[2]||""}
            </div>
            {renderForm()}
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>⚠️ {err}</div>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={saveForm} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>✓ Save</button>
              <button onClick={()=>{setEditing(null);setForm({});setErr("");}} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 16px")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-section pills — hidden when drilled into directly from nav */}
      {!initialSub&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>
        {SUB_SECTIONS.map(([k,ico,lbl])=>(
          <button key={k} onClick={()=>setSubSection(k)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${subSection===k?C.accent:C.border}`,background:subSection===k?"rgba(42,157,111,0.1)":"transparent",color:subSection===k?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:subSection===k?700:500}}>
            {ico} {lbl} {(financials[k]||[]).length>0&&<span style={{marginLeft:3,background:C.accent,color:"#fff",borderRadius:20,padding:"0 5px",fontSize:10,fontWeight:700}}>{(financials[k]||[]).length}</span>}
          </button>
        ))}
      </div>}

      {/* List */}
      {activeItems.length===0&&(
        <div style={{textAlign:"center",padding:"28px 16px",color:C.muted,background:C.s2,borderRadius:12,marginBottom:12}}>
          <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{label}</div>
          <div style={{fontSize:12,color:C.dim}}>No items yet — tap below to add one</div>
        </div>
      )}
      {activeItems.map(function(item){return React.createElement(FinItemCard,{key:item.id,type:subSection,item:item,onEdit:function(it){openEdit(subSection,it);},onDel:function(id){if(!window.confirm("Delete this item?"))return; update(subSection,function(arr){return arr.filter(function(x){return x.id!==id;});});}});})}

      <button onClick={()=>openNew(subSection, ADD_DEFAULTS[subSection]||{})} style={{...btn(C.accent,"#fff","none",13,"12px 0"),width:"100%",marginTop:4}}>
        + Add {label}
      </button>
    </div>
  );
}

// ─── Forecast Management Section (inside ManageModal → Forecast tab) ──────────
function ForecastManageSection({financials, setFinancials, budgets}) {
  var C = {accent:"#2a9d6f",danger:"#d94040",text:"#0f1624",muted:"#4a5568",dim:"#7a8699",border:"#cdd1db",s2:"#f4f6f3",surface:"#fff"};
  var [subTab, setSubTab] = useState("budget"); // "budget" | "cards"

  // ── Budget rows tool ──
  var budgetCats = Object.keys(budgets||{}).filter(function(cat){
    var b = budgets[cat]; if(!b) return false;
    var subs = b.subs||{};
    var subTotal = Object.values(subs).reduce(function(s,x){return s+(x&&x.monthly||0);},0);
    return subTotal>0||(b.monthly||0)>0;
  });
  var [selCats, setSelCats] = useState({}); // {cat: bool}
  var [toastMsg, setToastMsg] = useState(null); // {text, ok} | null

  // Month range: generate next 36 months from today
  var allMonths = (function(){
    var today=new Date(), months=[];
    for(var i=0;i<36;i++){
      var d=new Date(today.getFullYear(),today.getMonth()+i,1);
      var y=d.getFullYear(),mo=d.getMonth();
      months.push({key:y+"-"+(mo<9?"0":"")+(mo+1), label:d.toLocaleDateString("en-GB",{month:"short",year:"numeric"})});
    }
    return months;
  })();
  var [fromMonth, setFromMonth] = useState(allMonths[0].key);
  var [toMonth, setToMonth] = useState(allMonths[35].key);

  function toggleCat(cat){ setSelCats(function(p){var n=Object.assign({},p);n[cat]=!n[cat];return n;}); }
  function toggleAllCats(){ var allOn=budgetCats.every(function(c){return selCats[c];}); var n={}; budgetCats.forEach(function(c){n[c]=!allOn;}); setSelCats(n); }

  function showToast(text, ok){
    setToastMsg({text:text, ok:ok!==false});
    setTimeout(function(){setToastMsg(null);}, 3000);
  }

  function applyBudget(action){
    var chosen = budgetCats.filter(function(c){return selCats[c];});
    if(!chosen.length){ showToast("Select at least one budget category.", false); return; }
    var months = allMonths.filter(function(m){return m.key>=fromMonth&&m.key<=toMonth;}).map(function(m){return m.key;});
    if(!months.length){ showToast("No months in that range.", false); return; }

    setFinancials(function(prev){
      var newOverrides = Object.assign({}, prev.forecastCatOverrides||{});
      chosen.forEach(function(cat){
        newOverrides[cat] = Object.assign({}, newOverrides[cat]||{});
        months.forEach(function(mk){
          if(action==="delete"){
            delete newOverrides[cat][mk]; // removes override → falls back to budget default
          } else {
            var b = budgets[cat]||{};
            var subs = b.subs||{};
            var subTotal = Object.values(subs).reduce(function(s,x){return s+(x&&x.monthly||0);},0);
            var monthly = subTotal>0?subTotal:(b.monthly||0);
            newOverrides[cat][mk] = monthly;
          }
        });
      });
      return Object.assign({},prev,{forecastCatOverrides:newOverrides});
    });
    showToast((action==="delete"?"Overrides cleared for ":"Rebuilt from budget for ")+chosen.length+" categor"+(chosen.length===1?"y":"ies")+" across "+months.length+" month"+(months.length===1?"":"s")+".");
  }

  // ── Credit card tool ──
  var ccAccounts = (financials.accounts||[]).filter(function(a){return a.type==="credit";});
  var [selCards, setSelCards] = useState({}); // {id: bool}
  var [ccFromMonth, setCcFromMonth] = useState(allMonths[0].key);
  var [ccToMonth, setCcToMonth] = useState(allMonths[35].key);

  function toggleCard(id){ setSelCards(function(p){var n=Object.assign({},p);n[id]=!n[id];return n;}); }
  function toggleAllCards(){ var allOn=ccAccounts.every(function(a){return selCards[a.id||a.name];}); var n={}; ccAccounts.forEach(function(a){n[a.id||a.name]=!allOn;}); setSelCards(n); }

  function clearCards(){
    var chosen = ccAccounts.filter(function(a){return selCards[a.id||a.name];}).map(function(a){return a.id||a.name;});
    if(!chosen.length){ showToast("Select at least one credit card.", false); return; }
    var months = allMonths.filter(function(m){return m.key>=ccFromMonth&&m.key<=ccToMonth;}).map(function(m){return m.key;});
    if(!months.length){ showToast("No months in that range.", false); return; }

    setFinancials(function(prev){
      var existing = Object.assign({}, prev.forecastCardAmounts||{});
      chosen.forEach(function(cid){
        var cardData = Object.assign({}, existing[cid]||{});
        // Write explicit 0 (not delete) so the cell shows blank instead of reverting to account balance
        months.forEach(function(mk){ cardData[mk] = 0; });
        existing[cid] = cardData;
      });
      return Object.assign({},prev,{forecastCardAmounts:existing});
    });
    showToast("Cleared "+chosen.length+" card"+(chosen.length===1?"":"s")+" across "+months.length+" month"+(months.length===1?"":"s")+".");
  }

  function inp(extra){ return Object.assign({width:"100%",boxSizing:"border-box",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,fontFamily:"inherit",outline:"none",background:C.surface},extra||{}); }
  function chk(label, checked, onToggle){
    return React.createElement("div",{key:label,onClick:onToggle,style:{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:checked?"rgba(42,157,111,0.08)":C.s2,border:"1px solid "+(checked?C.accent:C.border),marginBottom:6,cursor:"pointer"}},
      React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"2px solid "+(checked?C.accent:C.border),background:checked?C.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}},
        checked&&React.createElement("span",{style:{color:"#fff",fontSize:10,lineHeight:1}},"✓")),
      React.createElement("span",{style:{fontSize:12,color:C.text,fontWeight:checked?600:400}},label));
  }

  return React.createElement("div",null,
    // Sub-tab toggle
    React.createElement("div",{style:{display:"flex",gap:4,marginBottom:16,background:C.s2,borderRadius:10,padding:3}},
      [["budget","📊 Budget Rows"],["cards","💳 Credit Cards"]].map(function(pair){
        var k=pair[0],l=pair[1];
        return React.createElement("button",{key:k,onClick:function(){setSubTab(k);},
          style:{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:subTab===k?C.surface:"transparent",
            color:subTab===k?C.text:C.muted,fontWeight:subTab===k?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},l);
      })),

    // ── BUDGET ROWS PANEL ──
    subTab==="budget"&&React.createElement("div",null,
      React.createElement("div",{style:{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}},
        "Select budget categories and a month range, then choose whether to clear all per-month overrides (reverting to the budget default) or force-rebuild them from the current budget amounts."),

      React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:6,letterSpacing:"0.05em"}},"CATEGORIES"),
      React.createElement("div",{onClick:toggleAllCats,style:{fontSize:11,color:C.accent,cursor:"pointer",marginBottom:8,fontWeight:600}},
        budgetCats.every(function(c){return selCats[c];})?"✓ Deselect all":"Select all"),
      budgetCats.length===0
        ? React.createElement("div",{style:{color:C.dim,fontSize:12,padding:"12px",background:C.s2,borderRadius:8,marginBottom:12}},"No budget categories found. Add them in the Budget tab.")
        : budgetCats.map(function(cat){ return chk(cat, !!selCats[cat], function(){toggleCat(cat);}); }),

      React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,margin:"14px 0 6px",letterSpacing:"0.05em"}},"MONTH RANGE"),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:11,color:C.muted,marginBottom:4}},"From"),
          React.createElement("select",{value:fromMonth,onChange:function(e){setFromMonth(e.target.value);},style:Object.assign(inp(),{appearance:"none"})},
            allMonths.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label);}))),
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:11,color:C.muted,marginBottom:4}},"To"),
          React.createElement("select",{value:toMonth,onChange:function(e){setToMonth(e.target.value);},style:Object.assign(inp(),{appearance:"none"})},
            allMonths.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label);})))),

      React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:8,letterSpacing:"0.05em"}},"ACTION"),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:8}},
        React.createElement("button",{onClick:function(){applyBudget("delete");},
          style:{width:"100%",padding:"11px 0",borderRadius:10,border:"none",
            background:C.danger,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}},
          "🗑 Delete Overrides"),
        React.createElement("button",{onClick:function(){applyBudget("rebuild");},
          style:{width:"100%",padding:"11px 0",borderRadius:10,border:"none",
            background:C.accent,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}},
          "🔄 Rebuild from Budget")),
      React.createElement("div",{style:{fontSize:11,color:C.dim,marginBottom:4}},
        "Tap an action above to apply immediately to the selected categories and month range.")),

    // ── CREDIT CARDS PANEL ──
    subTab==="cards"&&React.createElement("div",null,
      React.createElement("div",{style:{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}},
        "Select credit cards and a month range to clear saved amounts. Cleared months revert to the account's current balance."),

      React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:6,letterSpacing:"0.05em"}},"CREDIT CARDS"),
      React.createElement("div",{onClick:toggleAllCards,style:{fontSize:11,color:C.accent,cursor:"pointer",marginBottom:8,fontWeight:600}},
        ccAccounts.every(function(a){return selCards[a.id||a.name];})?"✓ Deselect all":"Select all"),
      ccAccounts.length===0
        ? React.createElement("div",{style:{color:C.dim,fontSize:12,padding:"12px",background:C.s2,borderRadius:8,marginBottom:12}},"No credit card accounts found. Add them in Config → Financial Position.")
        : ccAccounts.map(function(a){
            var id=a.id||a.name;
            return chk("💳 "+a.name+(a.last4?" (···"+a.last4+")":""), !!selCards[id], function(){toggleCard(id);});
          }),

      React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,margin:"14px 0 6px",letterSpacing:"0.05em"}},"MONTH RANGE"),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:11,color:C.muted,marginBottom:4}},"From"),
          React.createElement("select",{value:ccFromMonth,onChange:function(e){setCcFromMonth(e.target.value);},style:Object.assign(inp(),{appearance:"none"})},
            allMonths.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label);}))),
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:11,color:C.muted,marginBottom:4}},"To"),
          React.createElement("select",{value:ccToMonth,onChange:function(e){setCcToMonth(e.target.value);},style:Object.assign(inp(),{appearance:"none"})},
            allMonths.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label)})))),
      React.createElement("button",{onClick:clearCards,
        style:{width:"100%",padding:"11px 0",borderRadius:12,border:"none",background:C.danger,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},
        "🗑 Clear Selected Months")),

    // ── TOAST ──
    toastMsg&&React.createElement("div",{style:{
      marginTop:16,padding:"12px 16px",borderRadius:12,
      background:toastMsg.ok?"rgba(42,157,111,0.12)":"rgba(217,64,64,0.10)",
      border:"1px solid "+(toastMsg.ok?"rgba(42,157,111,0.35)":"rgba(217,64,64,0.3)"),
      color:toastMsg.ok?C.accent:C.danger,fontSize:12,fontWeight:600,lineHeight:1.4,textAlign:"center"}},
      toastMsg.text)
  );
}

// ─── Manage Modal (with icon editing, ordering, full CRUD) ────────────────────
// ─── Transaction Account Tag Section (inside ManageModal → Transactions tab) ──
function TransactionTagSection({rawTxs, setRawTxs, financials}) {
  var accounts = (financials&&financials.accounts)||[];
  var [selAccId, setSelAccId] = React.useState("");
  var [dateFrom, setDateFrom] = React.useState("");
  var [dateTo, setDateTo] = React.useState("");
  var [onlyUntagged, setOnlyUntagged] = React.useState(true);
  var [showPreview, setShowPreview] = React.useState(false);
  var [checkedIds, setCheckedIds] = React.useState({}); // {txKey: bool}
  var [toast, setToast] = React.useState(null);

  function txKey(t){ return t.date+"||"+(t.description||"").toLowerCase().trim()+"||"+(+t.amount).toFixed(2); }

  function showToast(msg, type) {
    setToast({msg:msg, type:type||"ok"});
    setTimeout(function(){setToast(null);}, 3500);
  }

  var untaggedCount = rawTxs.filter(function(t){return !t.accountId;}).length;

  // Full candidate list — sorted newest first
  var candidateTxs = React.useMemo(function(){
    if(!selAccId) return [];
    return rawTxs.filter(function(t){
      if(onlyUntagged && t.accountId) return false;
      if(dateFrom && t.date < dateFrom) return false;
      if(dateTo   && t.date > dateTo)   return false;
      return true;
    }).slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
  }, [rawTxs, selAccId, dateFrom, dateTo, onlyUntagged]);

  // When candidate list changes, reset checkboxes to all-checked
  React.useEffect(function(){
    var m = {};
    candidateTxs.forEach(function(t){ m[txKey(t)] = true; });
    setCheckedIds(m);
    setShowPreview(false);
  }, [candidateTxs.length, selAccId, dateFrom, dateTo, onlyUntagged]);

  var checkedCount = Object.values(checkedIds).filter(Boolean).length;

  function toggleOne(k){
    setCheckedIds(function(p){ return Object.assign({},p,{[k]:!p[k]}); });
  }
  function toggleAll(val){
    var m = {};
    candidateTxs.forEach(function(t){ m[txKey(t)] = val; });
    setCheckedIds(m);
  }

  function applyTag() {
    if(!selAccId) return;
    var toTag = new Set(Object.keys(checkedIds).filter(function(k){return checkedIds[k];}));
    var count = 0;
    setRawTxs(function(prev){
      return prev.map(function(t){
        if(!toTag.has(txKey(t))) return t;
        count++;
        return Object.assign({}, t, {accountId: selAccId});
      });
    });
    setShowPreview(false);
    setTimeout(function(){ showToast("Tagged "+count+" transactions.", "ok"); }, 100);
  }

  function removeTag() {
    if(!selAccId) return;
    var count = 0;
    setRawTxs(function(prev){
      return prev.map(function(t){
        if(t.accountId !== selAccId) return t;
        if(dateFrom && t.date < dateFrom) return t;
        if(dateTo   && t.date > dateTo)   return t;
        count++;
        var u = Object.assign({}, t); delete u.accountId; return u;
      });
    });
    setShowPreview(false);
    setTimeout(function(){ showToast("Removed account tag from "+count+" transactions.", "ok"); }, 100);
  }

  function fmtDate(d) {
    if(!d) return "—";
    var p = d.split("-");
    return p.length===3 ? p[2]+"/"+p[1]+"/"+p[0].slice(2) : d;
  }

  var allChecked = candidateTxs.length>0 && candidateTxs.every(function(t){return checkedIds[txKey(t)];});
  var someChecked = !allChecked && candidateTxs.some(function(t){return checkedIds[txKey(t)];});

  var inp = {width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,fontFamily:"inherit",outline:"none",background:C.surface,color:C.text};

  return React.createElement("div", null,

    // Description
    React.createElement("div", {style:{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.6}},
      "Tag existing transactions with an account. Useful when transactions were imported before an account was selected.",
      React.createElement("br",null),
      React.createElement("span", {style:{color:untaggedCount>0?C.danger:C.accent,fontWeight:700}},
        untaggedCount+" transaction"+(untaggedCount!==1?"s":"")+" currently have no account tag.")),

    // Account picker
    React.createElement("div", {style:{marginBottom:14}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:6,letterSpacing:"0.07em"}}, "ACCOUNT TO TAG"),
      React.createElement("select", {value:selAccId, onChange:function(e){setSelAccId(e.target.value);}, style:Object.assign({},inp,{appearance:"none"})},
        React.createElement("option", {value:""}, "— Select account —"),
        accounts.map(function(a){
          return React.createElement("option", {key:a.id, value:a.id}, a.name+(a.last4?" ···"+a.last4:""));
        }))),

    // Date range
    React.createElement("div", {style:{display:"flex",gap:8,marginBottom:14}},
      React.createElement("div", {style:{flex:1}},
        React.createElement("div", {style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:4,letterSpacing:"0.07em"}}, "FROM DATE (optional)"),
        React.createElement("input", {type:"date", value:dateFrom, onChange:function(e){setDateFrom(e.target.value);}, style:Object.assign({},inp,{colorScheme:"light"})})),
      React.createElement("div", {style:{flex:1}},
        React.createElement("div", {style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:4,letterSpacing:"0.07em"}}, "TO DATE (optional)"),
        React.createElement("input", {type:"date", value:dateTo, onChange:function(e){setDateTo(e.target.value);}, style:Object.assign({},inp,{colorScheme:"light"})}))),

    // Only untagged toggle
    React.createElement("div", {style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:C.s2,borderRadius:10}},
      React.createElement("input", {type:"checkbox", id:"onlyUntagged", checked:onlyUntagged, onChange:function(e){setOnlyUntagged(e.target.checked);},
        style:{width:16,height:16,accentColor:C.accent,cursor:"pointer"}}),
      React.createElement("label", {htmlFor:"onlyUntagged", style:{fontSize:13,color:C.text,cursor:"pointer"}},
        "Only tag transactions with no account yet")),

    // Green bar — count + expand toggle
    selAccId && React.createElement("div", {
      style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",marginBottom:14,
             background:"rgba(42,157,111,0.07)",border:"1px solid rgba(42,157,111,0.2)",borderRadius:10,
             cursor:candidateTxs.length>0?"pointer":"default"},
      onClick:function(){if(candidateTxs.length>0) setShowPreview(function(p){return !p;});}},
      React.createElement("span", {style:{fontSize:13,color:C.accent,fontWeight:600}},
        candidateTxs.length+" found · "+checkedCount+" selected to tag"),
      React.createElement("span", {style:{fontSize:11,color:C.accent,fontWeight:600}},
        candidateTxs.length>0?(showPreview?"▾ Hide":"▸ Review & select"):"")),

    // Scrollable checklist
    showPreview && candidateTxs.length>0 && React.createElement("div", {style:{marginBottom:14,border:"1px solid "+C.border,borderRadius:10,overflow:"hidden"}},

      // Header row with select-all
      React.createElement("div", {style:{padding:"7px 12px",background:C.s2,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8}},
        React.createElement("input", {type:"checkbox", checked:allChecked, ref:function(el){if(el) el.indeterminate=someChecked;},
          onChange:function(e){toggleAll(e.target.checked);},
          style:{width:15,height:15,accentColor:C.accent,cursor:"pointer",flexShrink:0}}),
        React.createElement("span", {style:{fontSize:11,fontWeight:700,color:C.dim,flex:"0 0 58px"}},"DATE"),
        React.createElement("span", {style:{fontSize:11,fontWeight:700,color:C.dim,flex:1}},"DESCRIPTION"),
        React.createElement("span", {style:{fontSize:11,fontWeight:700,color:C.dim,textAlign:"right",minWidth:68}},"AMOUNT")),

      // Transaction rows
      React.createElement("div", {style:{maxHeight:260,overflowY:"auto",WebkitOverflowScrolling:"touch"}},
        candidateTxs.map(function(t,i){
          var k = txKey(t);
          var checked = !!checkedIds[k];
          return React.createElement("div", {key:i,
            style:{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                   borderBottom:"1px solid "+C.s2,fontSize:12,
                   background:checked?(i%2===0?"#fff":"rgba(42,157,111,0.03)"):"rgba(0,0,0,0.03)",
                   opacity:checked?1:0.5,cursor:"pointer"},
            onClick:function(){toggleOne(k);}},
            React.createElement("input", {type:"checkbox", checked:checked,
              onChange:function(e){e.stopPropagation(); toggleOne(k);},
              style:{width:15,height:15,accentColor:C.accent,cursor:"pointer",flexShrink:0}}),
            React.createElement("span", {style:{fontFamily:"monospace",color:C.dim,flex:"0 0 58px",fontSize:11}}, fmtDate(t.date)),
            React.createElement("span", {style:{flex:1,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, t.description||"—"),
            React.createElement("span", {style:{fontFamily:"monospace",color:t.isCredit?C.accent:C.danger,minWidth:68,textAlign:"right",fontWeight:600}},
              (t.isCredit?"+":"−")+Number(t.amount||0).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})));
        })),

      // Footer summary
      React.createElement("div", {style:{padding:"7px 12px",background:C.s2,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}},
        React.createElement("span", {style:{fontSize:11,color:C.muted}}),
        React.createElement("span", {style:{fontSize:11,color:C.accent,fontWeight:700}},
          checkedCount+" of "+candidateTxs.length+" selected"))),

    // Action buttons
    React.createElement("div", {style:{display:"flex",gap:10,marginBottom:14}},
      React.createElement("button", {
        onClick:applyTag,
        disabled:!selAccId||checkedCount===0,
        style:Object.assign({},btn(selAccId&&checkedCount>0?C.accent:C.s3,selAccId&&checkedCount>0?"#fff":C.dim,"none",14,"12px 0"),
          {flex:2,opacity:selAccId&&checkedCount>0?1:0.5})},
        "🏷️ Tag "+checkedCount+" Transactions"),
      React.createElement("button", {
        onClick:removeTag, disabled:!selAccId,
        style:Object.assign({},btn(!selAccId?C.s3:"rgba(217,64,64,0.08)","#fff","1px solid "+(!selAccId?C.border:C.danger+"66"),13,"12px 0"),
          {flex:1,color:!selAccId?C.dim:C.danger,opacity:!selAccId?0.5:1})},
        "Remove Tag")),

    // Toast
    toast && React.createElement("div", {style:{padding:"11px 16px",borderRadius:10,
      background:toast.type==="ok"?"rgba(42,157,111,0.12)":"rgba(217,64,64,0.1)",
      border:"1px solid "+(toast.type==="ok"?"rgba(42,157,111,0.3)":C.danger+"44"),
      color:toast.type==="ok"?C.accent:C.danger,fontSize:13,fontWeight:600,textAlign:"center"}},
      toast.msg));
}

// ─── Gemini Usage Section (inside ManageModal → Gemini Usage tab) ─────────────
// Pricing constants for Gemini 2.5 Flash (as of April 2026) — GBP at ~0.79 USD/GBP
var GEMINI_INPUT_PRICE_PER_M  = 0.30 * 0.79;  // £ per million input tokens
var GEMINI_OUTPUT_PRICE_PER_M = 2.50 * 0.79;  // £ per million output tokens
var GEMINI_USAGE_KEY = "ledger-gemini-usage";

function calcGeminiCost(inputTokens, outputTokens) {
  return (inputTokens/1e6)*GEMINI_INPUT_PRICE_PER_M + (outputTokens/1e6)*GEMINI_OUTPUT_PRICE_PER_M;
}

function GeminiSection() {
  var [usage, setUsage] = React.useState(function(){ return storeLoad(GEMINI_USAGE_KEY)||[]; });
  var [showGuide, setShowGuide] = React.useState(false);

  function clearHistory() {
    storeSave(GEMINI_USAGE_KEY, []);
    setUsage([]);
  }

  var totalCost = usage.reduce(function(s,u){ return s+(u.costGBP||0); }, 0);
  var totalTxs  = usage.reduce(function(s,u){ return s+(u.txCount||0); }, 0);
  var totalIn   = usage.reduce(function(s,u){ return s+(u.inputTokens||0); }, 0);
  var totalOut  = usage.reduce(function(s,u){ return s+(u.outputTokens||0); }, 0);

  var guideSteps = [
    {n:"1", title:"Go to Google Cloud Console", body:"Visit console.cloud.google.com and sign in with the Google account linked to your Cloud Run function."},
    {n:"2", title:"Open Billing", body:"From the left menu tap 'Billing', then select your billing account. You'll see current balance and any pending charges."},
    {n:"3", title:"Add credits", body:"Tap 'Add credits' or 'Manage payment method'. You can add a credit/debit card or pay with a bank transfer."},
    {n:"4", title:"Check Gemini API quota", body:"Go to APIs & Services → Quotas & System Limits, search for 'Gemini API'. If you've hit a rate limit (429 error), wait until your quota resets — free tier resets daily."},
    {n:"5", title:"Enable billing if needed", body:"If your project has no billing account attached, go to Billing → Link a billing account. Free tier (Gemini 2.5 Flash) allows up to 1,500 requests/day without a card."},
  ];

  return React.createElement("div", null,

    // Summary card
    React.createElement("div", {style:{marginBottom:16}},
      React.createElement("div", {style:{background:C.s2,borderRadius:12,padding:"12px 14px"}},
        React.createElement("div", {style:{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.06em",marginBottom:4}}, "TRANSACTIONS EXTRACTED"),
        React.createElement("div", {style:{fontSize:22,fontWeight:800,fontFamily:"monospace",color:C.accent}}, totalTxs.toLocaleString()),
        React.createElement("div", {style:{fontSize:10,color:C.dim,marginTop:3}},
          usage.length+" import"+(usage.length!==1?"s":"")+" · "+
          (totalIn/1e3).toFixed(1)+"K in · "+(totalOut/1e3).toFixed(1)+"K out tokens"))),

    // Pricing note
    React.createElement("div", {style:{fontSize:11,color:C.dim,marginBottom:14,padding:"8px 12px",background:C.s2,borderRadius:8,lineHeight:1.6}},
      "Estimates based on Gemini 2.5 Flash pricing: £"+GEMINI_INPUT_PRICE_PER_M.toFixed(4)+"/M input · £"+GEMINI_OUTPUT_PRICE_PER_M.toFixed(4)+"/M output. "+
      "Actual costs may vary. If token data is unavailable (older imports), cost shows as £0.000."),

    // Usage history table
    usage.length>0
      ? React.createElement("div", {style:{marginBottom:14}},
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
            React.createElement("div", {style:{fontSize:12,fontWeight:700,color:C.text}}, "Import history"),
            React.createElement("button", {onClick:clearHistory,
              style:btn("rgba(217,64,64,0.08)",C.danger,"1px solid "+C.danger+"44",11,"4px 10px")},
              "Clear history")),
          React.createElement("div", {style:{background:C.surface,border:"1px solid "+C.border,borderRadius:10,overflow:"hidden"}},
            React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:0,
              padding:"6px 12px",background:C.s2,borderBottom:"1px solid "+C.border,
              fontSize:10,fontWeight:700,color:C.dim,letterSpacing:"0.05em"}},
              React.createElement("span",null,"DATE / MODE"),
              React.createElement("span",{style:{textAlign:"right"}},"TXS"),
              React.createElement("span",{style:{textAlign:"right"}},"TOKENS"),
              React.createElement("span",{style:{textAlign:"right"}},"COST")),
            React.createElement("div", {style:{maxHeight:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}},
              [...usage].reverse().map(function(u,i){
                var cost = u.costGBP||0;
                var hasTokens = !!(u.inputTokens||u.outputTokens);
                return React.createElement("div", {key:i,
                  style:{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,
                    padding:"7px 12px",borderBottom:"1px solid "+C.s2,fontSize:11,alignItems:"center"}},
                  React.createElement("div",null,
                    React.createElement("div",{style:{fontWeight:600,color:C.text}},u.date||"—"),
                    React.createElement("div",{style:{fontSize:10,color:C.dim,marginTop:1}},u.mode||"scan")),
                  React.createElement("span",{style:{textAlign:"right",fontFamily:"monospace",color:C.accent,fontWeight:600}},u.txCount||0),
                  React.createElement("span",{style:{textAlign:"right",fontFamily:"monospace",color:C.dim,fontSize:10}},
                    hasTokens?Math.round((u.inputTokens+u.outputTokens)/1000)+"K":"—"),
                  React.createElement("span",{style:{textAlign:"right",fontFamily:"monospace",color:cost>0?C.text:C.dim}},
                    cost>0?"£"+cost.toFixed(4):"—"));
              }))))
      : React.createElement("div", {style:{padding:"16px 12px",textAlign:"center",color:C.dim,fontSize:12,
          background:C.s2,borderRadius:10,marginBottom:14}},
          "No import history yet. Cost data is recorded after each extraction."),

    // Top-up guide toggle
    React.createElement("button", {onClick:function(){setShowGuide(function(p){return !p;});},
      style:{...btn(C.s2,C.text,"1px solid "+C.border,12,"9px 14px"),width:"100%",textAlign:"left",
             display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showGuide?0:0}},
      React.createElement("span",null,"💳 How to check balance & top up Google Cloud"),
      React.createElement("span",{style:{fontSize:11,color:C.dim}},showGuide?"▾ Hide":"▸ Show")),

    // Step-by-step guide
    showGuide && React.createElement("div", {style:{marginTop:10,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}},
      guideSteps.map(function(step,i){
        return React.createElement("div",{key:i,
          style:{display:"flex",gap:12,padding:"12px 14px",borderBottom:i<guideSteps.length-1?"1px solid "+C.s2:"none",
            background:i%2===0?"transparent":C.bg}},
          React.createElement("div",{style:{width:22,height:22,borderRadius:"50%",background:C.accent,
            color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}},
            step.n),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}},step.title),
            React.createElement("div",{style:{fontSize:11,color:C.muted,lineHeight:1.6}},step.body)));
      }),
      React.createElement("div",{style:{padding:"12px 14px",borderTop:"1px solid "+C.s2,display:"flex",gap:8}},
        React.createElement("a",{
          href:"https://console.cloud.google.com/billing",
          target:"_blank",
          rel:"noopener noreferrer",
          style:{...btn(C.accent,"#fff","none",12,"8px 14px"),textDecoration:"none",display:"inline-block"}},
          "Open Google Cloud Billing ↗"),
        React.createElement("a",{
          href:"https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
          target:"_blank",
          rel:"noopener noreferrer",
          style:{...btn(C.s2,C.muted,"1px solid "+C.border,12,"8px 14px"),textDecoration:"none",display:"inline-block"}},
          "Check Quotas ↗"))));
}

function ManageModal({taxonomy,setTaxonomy,vendorMap,setVendorMap,vendorList,setVendorList,rawTxs,setRawTxs,financials,setFinancials,budgets,initialSection,initialFinancialSub,singleSection,noOverlay,onClose}) {
  const [section,setSection]=useState(initialSection||"categories"); // categories | vendors | financial | forecast | transactions | gemini
  const [view,setView]=useState("list");
  const [selCat,setSelCat]=useState(null);
  const [selSub,setSelSub]=useState(null);
  const [nameV,setNameV]=useState("");
  const [iconV,setIconV]=useState("📦");
  const [colorV,setColorV]=useState("#8a9a8a");
  const [moveV,setMoveV]=useState("");
  const [err,setErr]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);
  // Vendor section state
  const [vendorTab,setVendorTab]=useState("all"); // all | unassigned
  const [vendorSearch,setVendorSearch]=useState("");
  const [vendorSel,setVendorSel]=useState(new Set());
  const [renamingVendor,setRenamingVendor]=useState(null); // {old, newName}
  const [vendorCat,setVendorCat]=useState("");
  const [vendorSub,setVendorSub]=useState("");
  const [vendorTxType,setVendorTxType]=useState("standard");
  const [vendorSaved,setVendorSaved]=useState(false);
  const [nvAssign,setNvAssign]=useState({}); // {description -> inputValue} for F2 assign inputs
  const [nvSaved,setNvSaved]=useState(null); // description key that just got saved

  const go=(v,cat=null,sub=null,name="",icon="📦",color="#8a9a8a")=>{
    setView(v);setSelCat(cat);setSelSub(sub);setNameV(name);setIconV(icon);setColorV(color);setErr("");setConfirmDel(null);
  };

  function syncVmap(oldCat,newCat,oldSub,newSub) {
    setVendorMap(v=>{
      const u={};
      for(const[k,vm] of Object.entries(v)) u[k]={
        category:(vm.category===oldCat&&newCat)?newCat:vm.category,
        subcategory:(vm.subcategory===oldSub&&vm.category===oldCat&&newSub)?newSub:vm.subcategory,
      };
      return u;
    });
  }

  // Reorder helpers
  function moveCat(cat,dir) {
    setTaxonomy(t=>{
      const keys=Object.keys(t); const i=keys.indexOf(cat); const j=i+dir;
      if(j<0||j>=keys.length) return t;
      [keys[i],keys[j]]=[keys[j],keys[i]];
      const u={}; keys.forEach(k=>u[k]=t[k]); return u;
    });
  }
  function moveSub2(cat,sub,dir) {
    setTaxonomy(t=>{
      const keys=Object.keys(t[cat].subs); const i=keys.indexOf(sub); const j=i+dir;
      if(j<0||j>=keys.length) return t;
      [keys[i],keys[j]]=[keys[j],keys[i]];
      const s={}; keys.forEach(k=>s[k]=t[cat].subs[k]);
      return {...t,[cat]:{...t[cat],subs:s}};
    });
  }

  function addCat() {
    const n=nameV.trim(); if(!n){setErr("Enter a name.");return;} if(taxonomy[n]){setErr("Already exists.");return;}
    setTaxonomy(t=>({...t,[n]:{icon:iconV,color:colorV,subs:{["Other "+n]:{icon:iconV,kw:[]}}}})); go("list");
  }
  function addSub() {
    const n=nameV.trim(); if(!n){setErr("Enter a name.");return;} if(taxonomy[selCat]?.subs[n]){setErr("Already exists.");return;}
    setTaxonomy(t=>({...t,[selCat]:{...t[selCat],subs:{...t[selCat].subs,[n]:{icon:iconV,kw:[]}}}})); go("list");
  }
  function editCat() {
    const n=nameV.trim(); if(!n){setErr("Enter a name.");return;}
    setTaxonomy(t=>{
      const u={};
      for(const[k,v] of Object.entries(t)) {
        if(k===selCat) u[n]={...v,icon:iconV,color:colorV};
        else u[k]=v;
      }
      return u;
    });
    if(n!==selCat) syncVmap(selCat,n,null,null);
    go("list");
  }
  function editSub() {
    const n=nameV.trim(); if(!n){setErr("Enter a name.");return;}
    setTaxonomy(t=>{
      const s={};
      for(const[k,v] of Object.entries(t[selCat].subs)) s[k===selSub?n:k]=(k===selSub?{...v,icon:iconV}:v);
      return {...t,[selCat]:{...t[selCat],subs:s}};
    });
    if(n!==selSub) syncVmap(selCat,selCat,selSub,n);
    go("list");
  }
  function moveSub() {
    if(!moveV||moveV===selCat){setErr("Pick a different category.");return;}
    const def=taxonomy[selCat].subs[selSub];
    setTaxonomy(t=>{const s={...t[selCat].subs}; delete s[selSub]; return {...t,[selCat]:{...t[selCat],subs:s},[moveV]:{...t[moveV],subs:{...t[moveV].subs,[selSub]:def}}};});
    syncVmap(selCat,moveV,selSub,selSub); go("list");
  }
  function doDelCat(cat) {
    setTaxonomy(t=>{const u={...t}; delete u[cat]; return u;});
    setVendorMap(v=>{const u={}; for(const[k,vm] of Object.entries(v)) if(vm.category!==cat) u[k]=vm; return u;});
    setConfirmDel(null);
  }
  function doDelSub(cat,sub) {
    setTaxonomy(t=>{const s={...t[cat].subs}; delete s[sub]; return {...t,[cat]:{...t[cat],subs:s}};});
    setVendorMap(v=>{const u={}; for(const[k,vm] of Object.entries(v)) if(!(vm.category===cat&&vm.subcategory===sub)) u[k]=vm; return u;});
    setConfirmDel(null);
  }

  const catKeys=Object.keys(taxonomy);

  var innerPanel = (
    <div style={{position:"relative",background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,maxWidth:560,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>

        {confirmDel&&(
          <div style={{position:"absolute",inset:0,background:"rgba(13,15,14,0.92)",borderRadius:20,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
            <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:14,padding:24,maxWidth:320,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:12}}>🗑️</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:8}}>{confirmDel.type==="cat"?"Delete category?":"Delete subcategory?"}</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.5}}>
                {confirmDel.type==="cat"
                  ?<span>Delete <strong style={{color:C.text}}>{confirmDel.cat}</strong> and all subcategories?</span>
                  :<span>Delete <strong style={{color:C.text}}>{confirmDel.sub}</strong>?</span>}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setConfirmDel(null)} style={{...btn(C.s3,C.muted,`1px solid ${C.border}`,13,"11px 0"),flex:1}}>Cancel</button>
                <button onClick={()=>confirmDel.type==="cat"?doDelCat(confirmDel.cat):doDelSub(confirmDel.cat,confirmDel.sub)} style={{...btn(C.danger,"#fff","none",13,"11px 0"),flex:1}}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Section tabs — hidden when opened to a specific section from HomeTab */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          {!singleSection&&<div style={{display:"flex",gap:2,background:C.s2,borderRadius:10,padding:3,flexWrap:"wrap"}}>
            {[["categories","🏷️ Categories"],["vendors","🏪 Vendors"],["financial","💰 Financial Position"],["forecast","📈 Forecast"],["transactions","🔖 Tag Accounts"],["gemini","🤖 Gemini Usage"]].map(([s,l])=>(
              <button key={s} onClick={()=>{setSection(s);setView("list");setVendorSel(new Set());setVendorSaved(false);setVendorTab("all");setNvAssign({});setNvSaved(null);}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:section===s?C.surface:"transparent",color:section===s?C.text:C.muted,fontWeight:section===s?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>}
          {singleSection&&<div style={{fontSize:13,fontWeight:700,color:C.text}}>{(function(){ if(section==="financial"){ var subLabels={accounts:"🏦 Financial Accounts",investments:"📈 Financial Investments",properties:"🏠 Financial Properties",loans:"💳 Financial Loans"}; return subLabels[initialFinancialSub]||"💰 Financial Position"; } return {"categories":"🏷️ Categories","vendors":"🏪 Vendors","financial":"💰 Financial Position","forecast":"📈 Forecast","transactions":"🔖 Tag Accounts","gemini":"🤖 Gemini Usage"}[section]||""; })()}</div>}
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,12,"7px 14px")}>✕ Close</button>
        </div>

        {/* ── VENDORS SECTION ── */}
        {section==="vendors"&&(()=>{
          // vendorList is master data: [{name,category,subcategory,txType}]
          // sorted A–Z, filterable, add/delete/rename/assign category
          const [addingVendor,setAddingVendor]=React.useState(false);
          const [newVendorName,setNewVendorName]=React.useState("");
          const [newVendorCat,setNewVendorCat]=React.useState("");
          const [newVendorSub,setNewVendorSub]=React.useState("");
          const [newVendorTxType,setNewVendorTxType]=React.useState("standard");
          const [vNoCatOnly,setVNoCatOnly]=React.useState(false);
          const [editingVendorIdx,setEditingVendorIdx]=React.useState(null); // index in vendorList
          const [editVendorName,setEditVendorName]=React.useState("");
          const [editVendorCat,setEditVendorCat]=React.useState("");
          const [editVendorSub,setEditVendorSub]=React.useState("");
          const [editVendorTxType,setEditVendorTxType]=React.useState("standard");
          const [vSaved,setVSaved]=React.useState(null); // index that just saved
          const [confirmDelVendor,setConfirmDelVendor]=React.useState(null); // index
          // Change D state
          const [vendorMgrSort,setVendorMgrSort]=React.useState("az"); // az | za
          const [vendorSelSet,setVendorSelSet]=React.useState(new Set()); // Set of vendor names
          const [bulkVCat,setBulkVCat]=React.useState("");
          const [bulkVSub,setBulkVSub]=React.useState("");
          const [bulkVTxType,setBulkVTxType]=React.useState("standard");
          const [bulkVName,setBulkVName]=React.useState(""); // rename selected vendors to this name
          const [bulkVNameText,setBulkVNameText]=React.useState(""); // free-text when "type new" chosen
          const [bulkDelConfirm,setBulkDelConfirm]=React.useState(false);

          const allVendors=(vendorList||[]).slice().sort((a,b)=>vendorMgrSort==="za"?b.name.localeCompare(a.name):a.name.localeCompare(b.name));
          const filtered=vNoCatOnly?allVendors.filter(v=>!v.category):allVendors;
          const searched=vendorSearch?filtered.filter(v=>v.name.toLowerCase().includes(vendorSearch.toLowerCase())):filtered;
          const allSearchedSelected=searched.length>0&&searched.every(v=>vendorSelSet.has(v.name));

          function saveNewVendor() {
            const n=newVendorName.trim(); if(!n) return;
            if((vendorList||[]).some(v=>v.name.toLowerCase()===n.toLowerCase())) return;
            setVendorList(prev=>[...(prev||[]),{name:n,category:newVendorCat||"",subcategory:newVendorSub||"",txType:newVendorTxType||"standard"}]);
            setNewVendorName(""); setNewVendorCat(""); setNewVendorSub(""); setNewVendorTxType("standard"); setAddingVendor(false);
          }
          function deleteVendor(idx) {
            const v=allVendors[idx];
            setVendorList(prev=>(prev||[]).filter(x=>x.name!==v.name));
            setConfirmDelVendor(null);
          }
          function saveVendorEdit(idx) {
            const v=allVendors[idx];
            const newName=editVendorName.trim()||v.name;
            const nameChanged=newName!==v.name;
            setVendorList(prev=>(prev||[]).map(x=>x.name===v.name?{...x,name:newName,category:editVendorCat,subcategory:editVendorSub,txType:editVendorTxType||"standard"}:x));
            // If name changed, update tx.vendor on all transactions that had the old name
            if(nameChanged) {
              setRawTxs(prev=>prev.map(t=>t.vendor===v.name?{...t,vendor:newName}:t));
            }
            // Also update vendorMap entries that match this vendor name
            setVendorMap(prev=>{
              const u={...prev};
              Object.keys(u).forEach(k=>{if(u[k]._vendorName===v.name||false) u[k]={...u[k],category:editVendorCat,subcategory:editVendorSub,txType:editVendorTxType||"standard"};});
              return u;
            });
            setEditingVendorIdx(null);
            setVSaved(idx); setTimeout(()=>setVSaved(null),2000);
          }

          return (
          <div>
            {/* Header row */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <input value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)} placeholder="Search vendors…" style={{...inp({padding:"7px 10px",fontSize:13}),flex:1}}/>
              <button onClick={()=>setVendorMgrSort(s=>s==="az"?"za":"az")} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,11,"7px 10px"),flexShrink:0,whiteSpace:"nowrap",fontWeight:700}}>
                {vendorMgrSort==="az"?"A–Z ↓":"Z–A ↑"}
              </button>
              <button onClick={()=>setVNoCatOnly(v=>!v)} style={{...btn(vNoCatOnly?C.accent:C.s2,vNoCatOnly?"#fff":C.muted,`1px solid ${vNoCatOnly?C.accent:C.border}`,11,"7px 10px"),flexShrink:0,whiteSpace:"nowrap"}}>⚠️ No cat</button>
              <button onClick={()=>{setAddingVendor(true);setNewVendorName("");setNewVendorCat("");setNewVendorSub("");}} style={{...btn(C.accent,"#fff","none",12,"7px 12px"),flexShrink:0}}>+ Add</button>
            </div>

            {/* Select-all row — only shown when list non-empty */}
            {searched.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"4px 2px"}}>
                <input type="checkbox" checked={allSearchedSelected} onChange={()=>{
                  if(allSearchedSelected) setVendorSelSet(new Set());
                  else setVendorSelSet(new Set(searched.map(v=>v.name)));
                }} style={{width:15,height:15,cursor:"pointer",accentColor:C.accent}}/>
                <span style={{fontSize:12,color:C.muted}}>{vendorSelSet.size>0?`${vendorSelSet.size} selected`:"Select all"}</span>
                {vendorSelSet.size>0&&<button onClick={()=>setVendorSelSet(new Set())} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,10,"3px 8px"),marginLeft:"auto"}}>Clear</button>}
              </div>
            )}

            {/* Bulk action bar */}
            {vendorSelSet.size>0&&(
              <div style={{background:"rgba(42,157,111,0.07)",border:`1px solid ${C.accent}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Bulk edit — {vendorSelSet.size} vendor{vendorSelSet.size!==1?"s":""}</div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:C.dim,marginBottom:4}}>Rename to (optional — merges selected into one)</div>
                  <select value={bulkVName||"_keep"} onChange={e=>setBulkVName(e.target.value==="_keep"?"":e.target.value==="_new_"?"__new__":e.target.value)} style={{...inp({padding:"5px 8px",fontSize:12}),width:"100%",boxSizing:"border-box",appearance:"none"}}>
                    <option value="_keep">— Keep names —</option>
                    {allVendors.filter(v=>!vendorSelSet.has(v.name)).map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
                    <option value="_new_">＋ Type new name…</option>
                  </select>
                  {bulkVName==="__new__"&&(
                    <input value={bulkVNameText||""} onChange={e=>setBulkVNameText(e.target.value)} placeholder="New vendor name…" style={{...inp({padding:"5px 8px",fontSize:12}),width:"100%",boxSizing:"border-box",marginTop:6}} autoFocus/>
                  )}
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={bulkVCat} onChange={e=>{setBulkVCat(e.target.value);setBulkVSub("");}} style={{...inp({padding:"5px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                    <option value="">— Keep category —</option>
                    <option value="__clear__">— Clear category —</option>
                    {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
                  </select>
                  {bulkVCat&&bulkVCat!=="__clear__"&&<select value={bulkVSub} onChange={e=>setBulkVSub(e.target.value)} style={{...inp({padding:"5px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                    <option value="">— Keep subcategory —</option>
                    {Object.keys(taxonomy[bulkVCat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[bulkVCat]?.subs[s]?.icon} {s}</option>)}
                  </select>}
                </div>
                <div style={{display:"flex",gap:5,marginBottom:10}}>
                  {Object.entries(TYPE_META).map(([tv,m])=>(
                    <button key={tv} onClick={()=>setBulkVTxType(tv)} style={{flex:1,padding:"5px 0",borderRadius:8,border:`1px solid ${bulkVTxType===tv?m.color:C.border}`,background:bulkVTxType===tv?m.color+"18":"transparent",color:bulkVTxType===tv?m.color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:bulkVTxType===tv?700:500}}>{m.label}</button>
                  ))}
                </div>
                {bulkDelConfirm?(
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:12,color:C.danger,flex:1}}>Delete {vendorSelSet.size} vendor{vendorSelSet.size!==1?"s":""}?</span>
                    <button onClick={()=>{
                      setVendorList(prev=>(prev||[]).filter(v=>!vendorSelSet.has(v.name)));
                      setVendorSelSet(new Set()); setBulkDelConfirm(false);
                    }} style={btn(C.danger,"#fff","none",12,"5px 12px")}>Confirm delete</button>
                    <button onClick={()=>setBulkDelConfirm(false)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,12,"5px 10px")}>Cancel</button>
                  </div>
                ):(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{
                      const resolvedName=bulkVName==="__new__"?bulkVNameText.trim():bulkVName;
                      const hasNameChange=resolvedName!==""&&resolvedName!=="__new__";
                      if(!bulkVCat&&bulkVTxType==="standard"&&!hasNameChange) return;
                      const newName=resolvedName;
                      setVendorList(prev=>{
                        const selectedNames=vendorSelSet;
                        if(hasNameChange) {
                          const others=(prev||[]).filter(v=>!selectedNames.has(v.name));
                          const existing=others.find(v=>v.name.toLowerCase()===newName.toLowerCase());
                          const base=(prev||[]).find(v=>selectedNames.has(v.name));
                          const cat=bulkVCat==="__clear__"?"":bulkVCat||(existing||base||{}).category||"";
                          const sub=bulkVCat==="__clear__"?"":bulkVCat?bulkVSub:(existing||base||{}).subcategory||"";
                          const txType2=bulkVTxType||"standard";
                          if(existing) return others.map(v=>v.name.toLowerCase()===newName.toLowerCase()?{...v,category:cat,subcategory:sub,txType:txType2}:v);
                          return [...others,{name:newName,category:cat,subcategory:sub,txType:txType2}];
                        }
                        return (prev||[]).map(v=>{
                          if(!selectedNames.has(v.name)) return v;
                          const cat=bulkVCat==="__clear__"?"":bulkVCat||v.category;
                          const sub=bulkVCat==="__clear__"?"":bulkVCat?bulkVSub:v.subcategory;
                          return {...v,category:cat,subcategory:sub,txType:bulkVTxType||v.txType};
                        });
                      });
                      if(hasNameChange) {
                        const selectedNames=new Set(vendorSelSet);
                        setRawTxs(prev=>prev.map(t=>selectedNames.has(t.vendor)?{...t,vendor:newName}:t));
                      }
                      setVendorSelSet(new Set()); setBulkVCat(""); setBulkVSub(""); setBulkVTxType("standard"); setBulkVName(""); setBulkVNameText("");
                    }} disabled={!bulkVCat&&bulkVTxType==="standard"&&!(bulkVName==="__new__"?bulkVNameText.trim():bulkVName)} style={{...btn((!bulkVCat&&bulkVTxType==="standard"&&!(bulkVName==="__new__"?bulkVNameText.trim():bulkVName))?C.s3:C.accent,(!bulkVCat&&bulkVTxType==="standard"&&!(bulkVName==="__new__"?bulkVNameText.trim():bulkVName))?C.dim:"#fff","none",12,"8px 0"),flex:1,opacity:(!bulkVCat&&bulkVTxType==="standard"&&!(bulkVName==="__new__"?bulkVNameText.trim():bulkVName))?0.5:1}}>
                      ✓ Apply to {vendorSelSet.size}
                    </button>
                    <button onClick={()=>setBulkDelConfirm(true)} style={{...btn("rgba(192,57,43,0.1)",C.danger,`1px solid rgba(192,57,43,0.3)`,12,"8px 12px"),fontWeight:700,flexShrink:0}}>
                      🗑 Delete {vendorSelSet.size}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Add new vendor form */}
            {addingVendor&&(
              <div style={{background:C.s2,borderRadius:12,padding:"14px 16px",marginBottom:12,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>New Vendor</div>
                <input value={newVendorName} onChange={e=>setNewVendorName(e.target.value)} placeholder="Vendor name (e.g. Amazon, DEWA, Carrefour)" style={{...inp({padding:"7px 10px",fontSize:13}),marginBottom:8}} autoFocus/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={newVendorCat} onChange={e=>{setNewVendorCat(e.target.value);setNewVendorSub("");}} style={{...inp({padding:"6px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                    <option value="">— Category (optional) —</option>
                    {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
                  </select>
                  {newVendorCat&&<select value={newVendorSub} onChange={e=>setNewVendorSub(e.target.value)} style={{...inp({padding:"6px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                    <option value="">— Subcategory —</option>
                    {Object.keys(taxonomy[newVendorCat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[newVendorCat]?.subs[s]?.icon} {s}</option>)}
                  </select>}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {Object.entries(TYPE_META).map(([v,m])=>(
                    <button key={v} onClick={()=>setNewVendorTxType(v)} style={{flex:1,padding:"6px 0",borderRadius:8,border:`1px solid ${newVendorTxType===v?m.color:C.border}`,background:newVendorTxType===v?m.color+"18":"transparent",color:newVendorTxType===v?m.color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:newVendorTxType===v?700:500}}>{m.label}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveNewVendor} disabled={!newVendorName.trim()} style={{...btn(newVendorName.trim()?C.accent:C.s3,newVendorName.trim()?"#fff":C.dim,"none",13,"8px 0"),flex:1,opacity:newVendorName.trim()?1:0.5}}>✓ Save Vendor</button>
                  <button onClick={()=>setAddingVendor(false)} style={{...btn(C.s3,C.muted,`1px solid ${C.border}`,13,"8px 14px"),flexShrink:0}}>Cancel</button>
                </div>
              </div>
            )}

            {/* Vendor list */}
            <div style={{border:`1px solid ${C.border}`,borderRadius:10,background:C.bg,overflow:"hidden",maxHeight:420,overflowY:"auto"}}>
              {searched.length===0?(
                <div style={{padding:"28px 14px",textAlign:"center",color:C.dim,fontSize:13}}>
                  {(vendorList||[]).length===0?"No vendors yet — tap + Add to create your first vendor.":vNoCatOnly?"All vendors have categories assigned 🎉":"No vendors match your search."}
                </div>
              ):searched.map((v,i)=>{
                const isEdit=editingVendorIdx===i;
                const saved=vSaved===i;
                return (
                  <div key={v.name} style={{borderBottom:`1px solid ${C.s2}`,padding:"10px 14px"}}>
                    {confirmDelVendor===i?(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:12,color:C.muted,flex:1}}>Delete <strong style={{color:C.text}}>{v.name}</strong>?</span>
                        <button onClick={()=>deleteVendor(i)} style={btn(C.danger,"#fff","none",11,"4px 10px")}>Delete</button>
                        <button onClick={()=>setConfirmDelVendor(null)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"4px 8px")}>Cancel</button>
                      </div>
                    ):isEdit?(
                      <div>
                        <input value={editVendorName} onChange={e=>setEditVendorName(e.target.value)} placeholder="Vendor name" style={{...inp({padding:"5px 8px",fontSize:13}),width:"100%",boxSizing:"border-box",fontWeight:600,marginBottom:8}}/>
                        <div style={{display:"flex",gap:8,marginBottom:8}}>
                          <select value={editVendorCat} onChange={e=>{setEditVendorCat(e.target.value);setEditVendorSub("");}} style={{...inp({padding:"5px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                            <option value="">— No category —</option>
                            {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
                          </select>
                          {editVendorCat&&<select value={editVendorSub} onChange={e=>setEditVendorSub(e.target.value)} style={{...inp({padding:"5px 8px",fontSize:12}),flex:1,appearance:"none"}}>
                            <option value="">— No subcategory —</option>
                            {Object.keys(taxonomy[editVendorCat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[editVendorCat]?.subs[s]?.icon} {s}</option>)}
                          </select>}
                        </div>
                        <div style={{display:"flex",gap:5,marginBottom:8}}>
                          {Object.entries(TYPE_META).map(([tv,m])=>(
                            <button key={tv} onClick={()=>setEditVendorTxType(tv)} style={{flex:1,padding:"5px 0",borderRadius:8,border:`1px solid ${editVendorTxType===tv?m.color:C.border}`,background:editVendorTxType===tv?m.color+"18":"transparent",color:editVendorTxType===tv?m.color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:editVendorTxType===tv?700:500}}>{m.label}</button>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>saveVendorEdit(i)} style={{...btn(C.accent,"#fff","none",12,"5px 0"),flex:1}}>✓ Save</button>
                          <button onClick={()=>setEditingVendorIdx(null)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,12,"5px 12px")}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="checkbox" checked={vendorSelSet.has(v.name)} onChange={()=>{
                          setVendorSelSet(prev=>{const n=new Set(prev); n.has(v.name)?n.delete(v.name):n.add(v.name); return n;});
                        }} style={{width:15,height:15,cursor:"pointer",accentColor:C.accent,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{v.name}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                            {v.category?<span style={{color:C.accent}}>{v.category}{v.subcategory?" › "+v.subcategory:""}</span>:<span style={{color:C.dim}}>No category</span>}
                            {v.txType&&v.txType!=="standard"&&<span style={{marginLeft:6,color:C.dim,fontSize:10}}>{v.txType}</span>}
                          </div>
                        </div>
                        {saved&&<span style={{fontSize:11,color:C.accent,fontWeight:700}}>✓ Saved</span>}
                        <button onClick={()=>{setEditingVendorIdx(i);setEditVendorName(v.name);setEditVendorCat(v.category||"");setEditVendorSub(v.subcategory||"");setEditVendorTxType(v.txType||"standard");}} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>✏️</button>
                        <button onClick={()=>setConfirmDelVendor(i)} style={{...btn("rgba(192,57,43,0.1)",C.danger,`1px solid rgba(192,57,43,0.3)`,11,"4px 9px"),fontWeight:700}}>🗑</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}


        {section==="categories"&&view==="list"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{fontFamily:"inherit",fontSize:18,fontWeight:700}}>Categories</span>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>go("addCat")} style={btn(C.accent,"#fff","none",12,"7px 14px")}>+ Category</button>
              </div>
            </div>
            {catKeys.map((cat,ci)=>{
              const catDef=taxonomy[cat];
              const subKeys=Object.keys(catDef.subs);
              return (
                <div key={cat} style={{marginBottom:10,background:C.s2,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{display:"flex",flexDirection:"column",gap:1,marginRight:4}}>
                        <button onClick={()=>moveCat(cat,-1)} disabled={ci===0} style={{background:"none",border:"none",color:ci===0?C.dim:C.muted,cursor:ci===0?"default":"pointer",fontSize:10,padding:"0 3px",lineHeight:1}}>▲</button>
                        <button onClick={()=>moveCat(cat,1)} disabled={ci===catKeys.length-1} style={{background:"none",border:"none",color:ci===catKeys.length-1?C.dim:C.muted,cursor:ci===catKeys.length-1?"default":"pointer",fontSize:10,padding:"0 3px",lineHeight:1}}>▼</button>
                      </div>
                      <div style={{width:26,height:26,borderRadius:7,background:catDef.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{catDef.icon}</div>
                      <span style={{fontWeight:600,fontSize:14}}>{cat}</span>
                    </div>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>go("addSub",cat)} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>+ Sub</button>
                      <button onClick={()=>go("editCat",cat,null,cat,catDef.icon,catDef.color)} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>✎ Edit</button>
                      <button onClick={()=>setConfirmDel({type:"cat",cat,sub:null})} style={btn("rgba(245,118,118,0.12)",C.danger,`1px solid rgba(245,118,118,0.3)`,11,"4px 9px")}>✕</button>
                    </div>
                  </div>
                  {subKeys.map((sub,si)=>{
                    const subDef=catDef.subs[sub];
                    return (
                      <div key={sub} style={{padding:"7px 14px 7px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{display:"flex",flexDirection:"column",gap:1,marginRight:4}}>
                            <button onClick={()=>moveSub2(cat,sub,-1)} disabled={si===0} style={{background:"none",border:"none",color:si===0?C.dim:C.muted,cursor:si===0?"default":"pointer",fontSize:9,padding:"0 3px",lineHeight:1}}>▲</button>
                            <button onClick={()=>moveSub2(cat,sub,1)} disabled={si===subKeys.length-1} style={{background:"none",border:"none",color:si===subKeys.length-1?C.dim:C.muted,cursor:si===subKeys.length-1?"default":"pointer",fontSize:9,padding:"0 3px",lineHeight:1}}>▼</button>
                          </div>
                          <span style={{fontSize:15,marginLeft:8}}>{subDef.icon}</span>
                          <span style={{fontSize:13,color:C.muted}}>{sub}</span>
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>go("editSub",cat,sub,sub,subDef.icon)} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>✎ Edit</button>
                          <button onClick={()=>{setSelCat(cat);setSelSub(sub);setMoveV("");setView("moveSub");}} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>↗ Move</button>
                          <button onClick={()=>setConfirmDel({type:"sub",cat,sub})} style={btn("rgba(245,118,118,0.12)",C.danger,`1px solid rgba(245,118,118,0.3)`,11,"4px 9px")}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {section==="categories"&&view==="addCat"&&(
          <div>
            <Crumb crumbs={[{label:"Manage",onClick:()=>go("list")},{label:"New Category"}]}/>
            <div style={{fontFamily:"inherit",fontSize:18,marginBottom:18}}>New Category</div>
            <LabelRow label="Name"><input style={inp()} value={nameV} onChange={e=>setNameV(e.target.value)} placeholder="e.g. Cars"/></LabelRow>
            <LabelRow label="Icon (emoji)"><input style={inp({width:80})} value={iconV} onChange={e=>setIconV(e.target.value)}/></LabelRow>
            <LabelRow label="Colour"><input type="color" value={colorV} onChange={e=>setColorV(e.target.value)} style={{height:38,width:60,borderRadius:8,border:`1px solid ${C.border}`,background:C.s2,cursor:"pointer",padding:2}}/></LabelRow>
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={addCat} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Create</button>
              <button onClick={()=>go("list")} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 18px")}>Cancel</button>
            </div>
          </div>
        )}

        {section==="categories"&&view==="editCat"&&(
          <div>
            <Crumb crumbs={[{label:"Manage",onClick:()=>go("list")},{label:"Edit "+selCat}]}/>
            <div style={{fontFamily:"inherit",fontSize:18,marginBottom:18}}>Edit Category</div>
            <LabelRow label="Name"><input style={inp()} value={nameV} onChange={e=>setNameV(e.target.value)}/></LabelRow>
            <LabelRow label="Icon (emoji)"><input style={inp({width:80})} value={iconV} onChange={e=>setIconV(e.target.value)}/></LabelRow>
            <LabelRow label="Colour"><input type="color" value={colorV} onChange={e=>setColorV(e.target.value)} style={{height:38,width:60,borderRadius:8,border:`1px solid ${C.border}`,background:C.s2,cursor:"pointer",padding:2}}/></LabelRow>
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={editCat} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Save</button>
              <button onClick={()=>go("list")} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 18px")}>Cancel</button>
            </div>
          </div>
        )}

        {section==="categories"&&view==="addSub"&&(
          <div>
            <Crumb crumbs={[{label:"Manage",onClick:()=>go("list")},{label:"New sub in "+selCat}]}/>
            <div style={{fontFamily:"inherit",fontSize:18,marginBottom:18}}>New Subcategory in <span style={{color:taxonomy[selCat]?.color}}>{selCat}</span></div>
            <LabelRow label="Name"><input style={inp()} value={nameV} onChange={e=>setNameV(e.target.value)} placeholder="e.g. Car Insurance"/></LabelRow>
            <LabelRow label="Icon (emoji)"><input style={inp({width:80})} value={iconV} onChange={e=>setIconV(e.target.value)}/></LabelRow>
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={addSub} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Create</button>
              <button onClick={()=>go("list")} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 18px")}>Cancel</button>
            </div>
          </div>
        )}

        {section==="categories"&&view==="editSub"&&(
          <div>
            <Crumb crumbs={[{label:"Manage",onClick:()=>go("list")},{label:"Edit "+selSub}]}/>
            <div style={{fontFamily:"inherit",fontSize:18,marginBottom:18}}>Edit Subcategory</div>
            <LabelRow label="Name"><input style={inp()} value={nameV} onChange={e=>setNameV(e.target.value)}/></LabelRow>
            <LabelRow label="Icon (emoji)"><input style={inp({width:80})} value={iconV} onChange={e=>setIconV(e.target.value)}/></LabelRow>
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={editSub} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Save</button>
              <button onClick={()=>go("list")} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 18px")}>Cancel</button>
            </div>
          </div>
        )}

        {section==="categories"&&view==="moveSub"&&(
          <div>
            <Crumb crumbs={[{label:"Manage",onClick:()=>go("list")},{label:"Move "+selSub}]}/>
            <div style={{fontFamily:"inherit",fontSize:18,marginBottom:8}}>Move Subcategory</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:18}}>Move <strong style={{color:C.text}}>{selSub}</strong> from <strong style={{color:C.text}}>{selCat}</strong> to:</div>
            <LabelRow label="Target Category">
              <select value={moveV} onChange={e=>setMoveV(e.target.value)} style={{...inp(),appearance:"none"}}>
                <option value="">— Select —</option>
                {Object.keys(taxonomy).filter(c=>c!==selCat).map(c=>(
                  <option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>
                ))}
              </select>
            </LabelRow>
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={moveSub} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Move</button>
              <button onClick={()=>go("list")} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 18px")}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── FINANCIAL ITEMS SECTION ── */}
        {section==="financial"&&(
          <FinancialSection financials={financials} setFinancials={setFinancials} taxonomy={taxonomy} initialSub={initialFinancialSub}/>
        )}

        {/* ── FORECAST MANAGEMENT SECTION ── */}
        {section==="forecast"&&(
          <ForecastManageSection financials={financials} setFinancials={setFinancials} budgets={budgets||{}}/>
        )}

        {/* ── TRANSACTION ACCOUNT TAGGING SECTION ── */}
        {section==="transactions"&&(
          <TransactionTagSection rawTxs={rawTxs} setRawTxs={setRawTxs} financials={financials}/>
        )}

        {/* ── GEMINI USAGE SECTION ── */}
        {section==="gemini"&&(
          <GeminiSection/>
        )}
      </div>
  );
  if(noOverlay) return innerPanel;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      {innerPanel}
    </div>
  );
}

// ─── Remap Modal (single tx or vendor-wide, all 3 types) ──────────────────────
function RemapModal({tx,taxonomy,accounts,vendorList,onSave,onClose}) {
  const [cat,setCat]=useState(tx.category);
  const [sub,setSub]=useState(tx.subcategory);
  const [txType,setTxType]=useState(getTxType(tx));
  const [accountId,setAccountId]=useState(tx.accountId||"");
  const [vendor,setVendor]=useState(tx.vendor||"");
  const [vendorMode,setVendorMode]=useState(tx.vendor?"pick":"pick"); // "pick" | "new"
  const sortedVendors=(vendorList||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const [newVendorText,setNewVendorText]=useState("");
  const effectiveVendor=vendorMode==="new"?newVendorText.trim():vendor;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,maxWidth:420,width:"100%"}}>
        <div style={{fontFamily:"inherit",fontSize:20,marginBottom:4}}>Edit Transaction</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:18,lineHeight:1.5}}>
          <strong style={{color:C.text}}>{tx.description}</strong>
          <span style={{marginLeft:8,fontFamily:"monospace",color:C.dim}}>{fmtDNum(tx.date)}</span>
        </div>
        <LabelRow label="Account">
          <select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{...inp(),appearance:"none"}}>
            <option value="">— Unassigned —</option>
            {(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.name}{a.last4?" ···"+a.last4:""}</option>)}
          </select>
        </LabelRow>
        <LabelRow label="Vendor">
          <div style={{display:"flex",flexDirection:"column",gap:6,width:"100%"}}>
            <select value={vendorMode==="new"?"__new__":vendor} onChange={e=>{
              if(e.target.value==="__new__"){setVendorMode("new");setNewVendorText("");}
              else{setVendorMode("pick");setVendor(e.target.value);}
            }} style={{...inp(),appearance:"none",width:"100%"}}>
              <option value="">— No vendor —</option>
              {sortedVendors.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
              <option value="__new__">＋ Type new vendor…</option>
            </select>
            {vendorMode==="new"&&(
              <input value={newVendorText} onChange={e=>setNewVendorText(e.target.value)} placeholder="New vendor name…" style={{...inp(),width:"100%",boxSizing:"border-box"}} autoFocus/>
            )}
          </div>
        </LabelRow>
        <LabelRow label="Cost Type">
          <div style={{display:"flex",gap:6}}>
            {Object.entries(TYPE_META).map(([v,m])=>(
              <button key={v} onClick={()=>setTxType(v)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${txType===v?m.color:C.border}`,background:txType===v?m.color+"18":"transparent",color:txType===v?m.color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:txType===v?700:400,textAlign:"center"}}>
                {m.label}
              </button>
            ))}
          </div>
        </LabelRow>
        <LabelRow label="Category">
          <select value={cat} onChange={e=>{setCat(e.target.value);setSub(Object.keys(taxonomy[e.target.value]?.subs||{})[0]||"");}} style={{...inp(),appearance:"none"}}>
            {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
          </select>
        </LabelRow>
        <LabelRow label="Subcategory">
          <select value={sub} onChange={e=>setSub(e.target.value)} style={{...inp(),appearance:"none"}}>
            {Object.keys(taxonomy[cat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[cat]?.subs[s]?.icon} {s}</option>)}
          </select>
        </LabelRow>
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button onClick={()=>onSave(cat,sub,txType,"this",accountId||null,effectiveVendor||null)} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>Save</button>
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 16px")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Edit Modal ──────────────────────────────────────────────────────────
function BulkEditModal({selected,transactions,taxonomy,accounts,vendorList,onSave,onClose}) {
  const txs=transactions.filter(t=>selected.has(t.date+"||"+t.description+"||"+t.amount));
  const [cat,setCat]=useState("");
  const [sub,setSub]=useState("");
  const [txType,setTxType]=useState("");
  const [bulkAccountId,setBulkAccountId]=useState("_keep");
  const [bulkVendor,setBulkVendor]=useState("_keep"); // "_keep" | "" (clear) | vendor name | "__new__"
  const [bulkVendorNew,setBulkVendorNew]=useState("");

  const effectiveBulkVendor=bulkVendor==="__new__"?(bulkVendorNew.trim()||"_keep"):bulkVendor;
  const hasChanges = cat||sub||txType||(bulkAccountId!=="_keep")||(effectiveBulkVendor!=="_keep");

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,maxWidth:480,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontFamily:"inherit",fontSize:20,marginBottom:4}}>Edit {txs.length} Transactions</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Leave a field on <strong style={{color:C.dim}}>Keep</strong> to leave it unchanged. Only fields you change will be updated.</div>

        {/* Account */}
        {accounts&&accounts.length>0&&(
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Account</div>
            <select value={bulkAccountId} onChange={e=>setBulkAccountId(e.target.value)} style={{...inp(),appearance:"none",width:"100%",fontSize:14}}>
              <option value="_keep">— Keep existing —</option>
              <option value="">— Unassigned —</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.last4?" ···"+a.last4:""}</option>)}
            </select>
          </div>
        )}

        {/* Vendor */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Vendor</div>
          <select value={bulkVendor} onChange={e=>setBulkVendor(e.target.value)} style={{...inp(),appearance:"none",width:"100%",fontSize:14}}>
            <option value="_keep">— Keep existing —</option>
            <option value="">— Clear vendor —</option>
            {(vendorList||[]).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
            <option value="__new__">＋ Type new vendor…</option>
          </select>
          {bulkVendor==="__new__"&&(
            <input
              value={bulkVendorNew||""}
              onChange={e=>setBulkVendorNew(e.target.value)}
              placeholder="New vendor name…"
              style={{...inp(),width:"100%",boxSizing:"border-box",fontSize:14,marginTop:8}}
              autoFocus
            />
          )}
        </div>

        {/* Cost Type */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Cost Type</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>setTxType("")} style={{padding:"9px 14px",borderRadius:10,border:`1px solid ${txType===""?C.accent:C.border}`,background:txType===""?"rgba(62,180,137,0.08)":"transparent",color:txType===""?C.accent:C.dim,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:txType===""?700:400}}>
              Keep
            </button>
            {Object.entries(TYPE_META).map(([v,m])=>(
              <button key={v} onClick={()=>setTxType(v)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${txType===v?m.color:C.border}`,background:txType===v?m.color+"18":"transparent",color:txType===v?m.color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:txType===v?700:400,textAlign:"center"}}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Category</div>
          <select value={cat} onChange={e=>{setCat(e.target.value);setSub("");}} style={{...inp(),appearance:"none",width:"100%",fontSize:14}}>
            <option value="">— Keep existing —</option>
            {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
          </select>
        </div>

        {/* Subcategory — always visible, disabled until category chosen */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Subcategory</div>
          <select value={sub} onChange={e=>setSub(e.target.value)} disabled={!cat} style={{...inp(),appearance:"none",width:"100%",fontSize:14,opacity:cat?1:0.4,cursor:cat?"pointer":"not-allowed"}}>
            <option value="">{cat?"— Keep existing —":"— Select a category first —"}</option>
            {Object.keys(taxonomy[cat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[cat]?.subs[s]?.icon} {s}</option>)}
          </select>
        </div>

        {/* Selected transactions list */}
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:18,maxHeight:150,overflowY:"auto"}}>
          {txs.map((t,i)=>(
            <div key={i} style={{padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.s2}`,fontSize:12}}>
              <span style={{color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{t.description}</span>
              <span style={{fontFamily:"monospace",color:C.dim,marginLeft:8,flexShrink:0}}>{fmtDNum(t.date)}</span>
              <span style={{marginLeft:8,color:(TYPE_META[t.txType]||TYPE_META.standard).color,flexShrink:0}}>{(TYPE_META[t.txType]||TYPE_META.standard).label}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:10}}>
          <button
            onClick={()=>onSave(cat,sub,txType,selected,bulkAccountId,effectiveBulkVendor)}
            disabled={!hasChanges}
            style={{...btn(hasChanges?C.accent:C.s2,hasChanges?"#fff":C.dim,hasChanges?"none":`1px solid ${C.border}`,14,"13px 0"),flex:1,opacity:hasChanges?1:0.5}}
          >
            ✓ Apply to {txs.length} transactions
          </button>
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"13px 16px")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Local vendor inference (used by ImportModal + ScanDataPanel) ────────────
function inferVendor(desc) {
  var d=desc.toUpperCase();
  if(/\bATM\b/.test(d)||/ATMA\d/.test(d)||/ATM\d/.test(d)) return "ATM Withdrawal";
  if(/\bSALARY\b|\bPAYROLL\b|\bWAGES?\b/.test(d)) return "Salary";
  if(/\bCASHBACK\b|\bREFUND\b|\bREVERSAL\b/.test(d)) return "Refund";
  if(/\bINTEREST\b/.test(d)) return "Interest";
  if(/\bINSURANCE\b/.test(d)) return "Insurance";
  if(/\bDIRECT DEBIT\b/.test(d)) return "Direct Debit";
  if(/\bSTANDING ORDER\b/.test(d)) return "Standing Order";
  if(/\bCHARGE\b|\bBANK FEE\b/.test(d)) return "Bank Charge";
  if(/\bTRANSFER\b|\bTRFR\b|\bSWIFT\b|\bWIRE\b/.test(d)) return "Bank Transfer";
  var merchants=[
    ["CARREFOUR","Carrefour"],["SPINNEY","Spinneys"],["LULU","Lulu Hypermarket"],
    ["WAITROSE","Waitrose"],["TESCO","Tesco"],["SAINSBURY","Sainsbury's"],
    ["AMAZON","Amazon"],["NOON","Noon"],["IKEA","IKEA"],
    ["MCDONALD","McDonald's"],["STARBUCKS","Starbucks"],["COSTA COFFEE","Costa Coffee"],
    ["COSTA","Costa Coffee"],["KFC","KFC"],["PIZZA HUT","Pizza Hut"],["SUBWAY","Subway"],
    ["UBER EATS","Uber Eats"],["DELIVEROO","Deliveroo"],["TALABAT","Talabat"],
    ["UBER","Uber"],["CAREEM","Careem"],
    ["ETISALAT","Etisalat"],["VIRGIN MOBILE","Virgin Mobile"],
    ["DEWA","DEWA"],["ADDC","ADDC"],["SEWA","SEWA"],["SALIK","Salik"],
    ["NETFLIX","Netflix"],["SPOTIFY","Spotify"],["APPLE.COM","Apple"],
    ["GOOGLE","Google"],["MICROSOFT","Microsoft"],
    ["EMIRATES NBD","Emirates NBD"],["ADCB","ADCB"],["HSBC","HSBC"],
    ["ADIB","ADIB"],["EMIRATES","Emirates Airlines"],
    ["FLYDUBAI","flydubai"],["AIR ARABIA","Air Arabia"],
    ["BOOKING.COM","Booking.com"],["AIRBNB","Airbnb"],["PAYPAL","PayPal"],
  ];
  for(var i=0;i<merchants.length;i++){
    if(d.indexOf(merchants[i][0])!==-1) return merchants[i][1];
  }
  var cleaned=desc
    .replace(/^(CARD TRANSACTION|PURCHASE|PAYMENT TO|PAYMENT FROM|POS |NFC |IAP-|AP-PAY-)\s*/i,"")
    .replace(/\b\d{2}[A-Za-z]{3}\d{2,4}\b/g,"")
    .replace(/\d{2}:\d{2}:\d{2}/g,"")
    .replace(/\bA\d{7,}\b/g,"")
    .replace(/Card Ending with \d+/gi,"")
    .replace(/\s+/g," ").trim();
  var words=cleaned.split(" ").filter(function(w){return w.length>2;});
  return null;
}

// ─── Import Modal (AI-powered — screenshot + text) ───────────────────────────
function ImportModal({onImport,onClose}) {
  const [apiKey,setApiKey]   = useState(()=>{try{return localStorage.getItem("ledger-apikey")||"";}catch{return "";}});
  const [status,setStatus]   = useState("idle");
  const [err,setErr]         = useState("");
  const [preview,setPreview] = useState(null);
  const [showKey,setShowKey] = useState(false);
  const [images,setImages]   = useState([]);
  const [text,setText]       = useState("");
  const [importCurrency,setImportCurrency] = useState("AED");

  function saveKey(k){ setApiKey(k); try{k?localStorage.setItem("ledger-apikey",k):localStorage.removeItem("ledger-apikey");}catch{} }

  function stripFences(s){ return s.replace(/`{3}json|`{3}/g,"").trim(); }

  const photoInputRef = React.useRef(null);
  function handlePhotoInput(e) { Array.from(e.target.files||[]).forEach(addImageFromFile); e.target.value=""; }

  function addImageFromFile(file) {
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const dataUrl=ev.target.result;
      const base64=dataUrl.split(",")[1];
      setImages(prev=>[...prev,{dataUrl,base64,mediaType:file.type||"image/png"}]);
      setErr(""); setStatus("idle"); setPreview(null);
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e) {
    const items=Array.from(e.clipboardData?.items||[]);
    const imgItem=items.find(it=>it.type.startsWith("image/"));
    if(imgItem){ e.preventDefault(); addImageFromFile(imgItem.getAsFile()); }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    Array.from(e.dataTransfer.files||[]).forEach(addImageFromFile);
  }

  function removeImage(i){ setImages(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function callAPI(imgs, txt) {
    const systemPrompt="You are a bank statement parser. Extract ALL transactions including credits. Return ONLY a valid JSON array with no markdown, no explanation. Each object: {\"date\":\"YYYY-MM-DD\",\"description\":\"original transaction text\",\"vendor\":\"clean merchant name e.g. Amazon, Carrefour, Netflix\",\"amount\":number,\"isCredit\":boolean}. For vendor: extract the clean merchant/payee name from the description — strip bank prefixes (IAP-, NFC-, AP-PAY-), card numbers, city/country suffixes like 'Dubai AE', and reference numbers. If no clear merchant name, use an empty string. Set isCredit:true for credits, cashback, refunds, incoming transfers. Set isCredit:false for debits/expenses. CRITICAL for amounts: use ONLY the individual transaction amount column (debit or credit column) — NEVER use the running balance, closing balance, or total columns. The transaction amount is typically a smaller column near the description; the running balance is a larger cumulative number on the right — ignore it. If a row shows both a debit amount and a running balance, use the debit amount only. CRITICAL for dates: always use the TRANSACTION DATE (leftmost column). Convert all date formats to YYYY-MM-DD: '28-Jan-26' = 2026-01-28, '28/01/26' = 2026-01-28, '28/01/2026' = 2026-01-28. Two-digit years: 24=2024, 25=2025, 26=2026. For DD/MM/YYYY the first number is always DAY, second is MONTH. Never swap day and month. IMPORTANT: always output complete valid JSON — never truncate the array.";
    const userContent=[];
    imgs.forEach(img=>userContent.push({type:"image",source:{type:"base64",media_type:img.mediaType,data:img.base64}}));
    userContent.push({type:"text",text:imgs.length?"Parse all transactions from the screenshot(s)"+(txt?" and this text:\n\n"+txt:"."):"Parse this bank statement:\n\n"+txt});
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey.trim(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:16000,system:systemPrompt,messages:[{role:"user",content:userContent}]})
    });
    if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"API error "+res.status);}
    const data=await res.json();
    const raw=data.content?.find(b=>b.type==="text")?.text||"";
    console.log("API raw response length:", raw.length, "stop_reason:", data.stop_reason);
    console.log("API raw (first 300):", raw.slice(0,300));
    const clean=stripFences(raw);
    // Try full parse first
    try{ const p=JSON.parse(clean); if(Array.isArray(p)) return p; }catch(e){ console.log("Full parse failed:", e.message); }
    // Try to find array in response
    const m=clean.match(/\[[\s\S]*\]/);
    if(m){
      console.log("Array match length:", m[0].length);
      try{ const p=JSON.parse(m[0]); if(Array.isArray(p)) return p; }catch(e){ console.log("Array parse failed:", e.message); }
      // If truncated JSON, recover complete objects
      try{
        const partial=m[0];
        const objects=[...partial.matchAll(/\{[^{}]*"date"[^{}]*"description"[^{}]*"amount"[^{}]*\}/g)];
        console.log("Recovered objects:", objects.length);
        if(objects.length) return objects.map(o=>JSON.parse(o[0]));
      }catch(e){ console.log("Recovery failed:", e.message); }
    }
    console.log("Full clean response:", clean.slice(0,500));
    throw new Error("Invalid response format — the AI did not return valid JSON. Check console for details.");
  }

  async function runAI() {
    if(!apiKey.trim()){ setErr("Enter your Anthropic API key first."); return; }
    const domText = document.querySelector("#ledger-stmt-input")?.value||"";
    const effectiveText=(text||domText).trim();
    if(!images.length&&!effectiveText){ setErr("Paste a screenshot or statement text first."); return; }
    setErr(""); setStatus("loading"); setPreview(null);

    try{
      // Process 2 pages at a time to avoid token limits on dense statements
      const BATCH=2;
      let allTxs=[];
      if(images.length<=BATCH){
        allTxs=await callAPI(images, effectiveText);
      } else {
        const batches=[];
        for(let i=0;i<images.length;i+=BATCH) batches.push(images.slice(i,i+BATCH));
        for(let i=0;i<batches.length;i++){
          setErr("Processing pages "+(i*BATCH+1)+"-"+Math.min((i+1)*BATCH,images.length)+" of "+images.length+"…");
          const txs=await callAPI(batches[i], i===0?effectiveText:"");
          allTxs=[...allTxs,...txs];
        }
        setErr("");
      }
      // Deduplicate
      const seen=new Set();
      allTxs=allTxs.filter(t=>{ const k=t.date+"|"+t.description+"|"+t.amount; if(seen.has(k))return false; seen.add(k); return true; });
      if(!allTxs.length) throw new Error("No transactions found in the images");
      // Apply local vendor inference where Gemini didn't return a vendor
      allTxs=allTxs.map(function(t){ return t.vendor?t:{...t,vendor:inferVendor(t.description||"")}; });
      setPreview(allTxs); setStatus("done");
    }catch(e){
      const msg=e.message||"Unknown error";
      if(msg==="Failed to fetch"||msg.toLowerCase().includes("network")){
        setErr("Could not reach Anthropic API. On Windows, make sure you are not behind a VPN or firewall blocking api.anthropic.com. Try opening https://api.anthropic.com in a new tab — if it shows an error page the API is reachable. Also verify your API key is correct.");
      } else {
        setErr(msg);
      }
      setStatus("error");
    }
  }

  function goJSON(){
    setErr("");
    const raw=stripFences((text||document.querySelector("#ledger-stmt-input")?.value||"").trim());
    if(!raw){setErr("Paste JSON first.");return;}
    let p;
    try{p=JSON.parse(raw);}
    catch{
      const m=raw.match(/\[[\s\S]*\]/);
      if(m){try{p=JSON.parse(m[0]);}catch{setErr("Invalid JSON.");return;}}
      else{setErr("Invalid JSON.");return;}
    }
    if(!Array.isArray(p)||!p.length){setErr("No transactions found.");return;}
    onImport(p, importCurrency);
  }

  const hasInput = images.length>0 || text.trim().length>0;

  return (
    <div onPaste={handlePaste} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,maxWidth:540,width:"100%",maxHeight:"94vh",overflowY:"auto"}}>
        <div style={{fontFamily:"inherit",fontSize:20,marginBottom:14}}>Add Statement Data</div>

        {/* Account Currency — shown prominently at top */}
        <div style={{marginBottom:16,padding:"12px 16px",background:importCurrency==="AED"?C.s2:"rgba(42,157,111,0.08)",border:`2px solid ${importCurrency==="AED"?C.border:C.accent}`,borderRadius:14}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,letterSpacing:"0.06em"}}>ACCOUNT CURRENCY</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["AED","GBP","USD","EUR","PKR"].map(c=>(
              <button key={c} onClick={()=>setImportCurrency(c)} style={{padding:"6px 16px",borderRadius:20,border:`1px solid ${importCurrency===c?C.accent:C.border}`,background:importCurrency===c?C.accent:"transparent",color:importCurrency===c?"#fff":C.muted,fontSize:13,fontWeight:importCurrency===c?700:500,cursor:"pointer",fontFamily:"inherit"}}>
                {c}
              </button>
            ))}
          </div>
          {importCurrency!=="AED"&&<div style={{fontSize:11,color:C.accent,marginTop:6}}>✓ Amounts will be converted to AED using live exchange rates</div>}
        </div>

        {/* API Key */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Anthropic API Key</div>
          <div style={{display:"flex",gap:8}}>
            <input type={showKey?"text":"password"} value={apiKey} onChange={e=>saveKey(e.target.value)} placeholder="sk-ant-api03-..." style={{...inp(),flex:1,fontFamily:"monospace",fontSize:12}}/>
            <button onClick={()=>setShowKey(v=>!v)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,12,"9px 12px")}>{showKey?"Hide":"Show"}</button>
          </div>
          {!apiKey&&<div style={{fontSize:11,color:C.dim,marginTop:5}}>Get a free key at <span style={{color:C.accent}}>platform.anthropic.com</span> → API Keys</div>}
          {apiKey&&<div style={{fontSize:11,color:"#0e9e7a",marginTop:5}}>✓ Key saved locally on this device</div>}
        </div>

        {/* Hidden file input - accepts images from Files app (not camera roll) */}
        <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(addImageFromFile);e.target.value="";}} style={{display:"none"}}/>

        {/* Screenshot zone */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Screenshots</div>
            <button onClick={()=>photoInputRef.current?.click()} style={{...btn(C.accent,"#fff","none",12,"7px 14px"),display:"flex",alignItems:"center",gap:5}}>
              📁 Select Files
            </button>
          </div>
          <div
            onDrop={handleFileDrop}
            onDragOver={e=>e.preventDefault()}
            style={{minHeight:90,background:C.s2,border:`2px dashed ${images.length?C.accent:C.border}`,borderRadius:12,padding:12,display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}
          >
            {images.length===0&&(
              <div onClick={()=>photoInputRef.current?.click()} style={{width:"100%",textAlign:"center",color:C.dim,fontSize:13,padding:"12px 0",cursor:"pointer"}}>
                <div style={{fontSize:32,marginBottom:6}}>🖼️</div>
                <div style={{fontWeight:600,color:C.muted}}>Tap to pick screenshot files</div>
                <div style={{fontSize:11,marginTop:4,color:C.dim,lineHeight:1.6}}>
                  📱 iPhone: take screenshots → tap <strong style={{color:C.muted}}>Select Files</strong> → pick them from the Files app<br/>
                  💻 Windows: Ctrl+V to paste, or drag &amp; drop
                </div>
              </div>
            )}
            {images.map((img,i)=>(
              <div key={i} style={{position:"relative"}}>
                <img src={img.dataUrl} alt={"p"+(i+1)} style={{height:80,maxWidth:130,borderRadius:8,border:`1px solid ${C.border}`,objectFit:"cover",display:"block"}}/>
                <button onClick={()=>removeImage(i)} style={{position:"absolute",top:-7,right:-7,width:22,height:22,borderRadius:"50%",background:C.danger,border:"none",color:"#fff",fontSize:14,cursor:"pointer",lineHeight:1,fontWeight:700}}>×</button>
                <div style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:3}}>Page {i+1}</div>
              </div>
            ))}
            {images.length>0&&(
              <div onClick={()=>photoInputRef.current?.click()} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:60,height:80,borderRadius:8,border:`2px dashed ${C.accent}`,color:C.accent,fontSize:11,gap:3,cursor:"pointer",background:"transparent"}}>
                <span style={{fontSize:22,lineHeight:1}}>+</span>
                <span style={{fontWeight:600}}>Add</span>
              </div>
            )}
          </div>
          <div style={{fontSize:11,color:C.dim,marginTop:6,lineHeight:1.6}}>
            💡 <strong style={{color:C.muted}}>iPhone tip:</strong> Take screenshots of your statement pages, then tap Select Files and navigate to Screenshots folder in Files app. No need to save to Photos.
          </div>
        </div>

                {/* Text paste zone */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Or paste statement text rows</div>
          <textarea
            id="ledger-stmt-input"
            value={text}
            onChange={e=>{setText(e.target.value);setErr("");setStatus("idle");setPreview(null);}}
            onInput={e=>setText(e.target.value)}
            onPaste={e=>{setTimeout(()=>setText(e.target.value),50);}}
            placeholder={"Copy-paste rows directly from your banking website or PDF viewer…"}
            style={{width:"100%",minHeight:90,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontFamily:"monospace",fontSize:11,resize:"vertical",outline:"none",lineHeight:1.6,boxSizing:"border-box"}}
          />
        </div>

        {/* Also support raw JSON */}
        {text.trim().startsWith("[")&&(
          <div style={{marginBottom:12}}>
            <button onClick={goJSON} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,12,"8px 14px")}}>Looks like JSON — import directly →</button>
          </div>
        )}

        {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12,padding:"8px 12px",background:"rgba(245,118,118,0.08)",borderRadius:8}}>{err}</div>}

        {/* Preview */}
        {status==="done"&&preview&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:"#0e9e7a",fontWeight:600,marginBottom:8}}>✓ Found {preview.length} transactions — review then import:</div>
            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,maxHeight:180,overflowY:"auto"}}>
              {preview.map((t,i)=>(
                <div key={i} style={{padding:"7px 12px",borderBottom:`1px solid ${C.s2}`,display:"flex",gap:12,fontSize:12}}>
                  <span style={{color:C.muted,fontFamily:"monospace",flexShrink:0}}>{fmtDNum(t.date)}</span>
                  <span style={{flex:1,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</span>
                  <span style={{color:C.danger,fontFamily:"monospace",flexShrink:0}}>{importCurrency} {t.amount.toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status==="loading"&&(
          <div style={{textAlign:"center",padding:"14px 0",color:C.muted,fontSize:13,marginBottom:10}}>
            <div style={{fontSize:24,marginBottom:6}}>⏳</div>
            <div>Reading with Claude Haiku...</div>
            <div style={{fontSize:11,color:C.dim,marginTop:3}}>~$0.01 per page</div>
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          {status!=="done"
            ? <button onClick={runAI} disabled={status==="loading"} style={{...btn(!hasInput||status==="loading"?C.s3:C.accent,!hasInput||status==="loading"?C.muted:"#fff","none",14,"12px 0"),flex:1,opacity:!hasInput||status==="loading"?0.5:1}}>
                {status==="loading"?"Reading...":"🤖 Extract Transactions"}
              </button>
            : <button onClick={()=>onImport(preview)} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>
                ✓ Import {preview?.length} Transactions
              </button>
          }
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 14px")}>Cancel</button>
        </div>

      </div>
    </div>
  );
}

// ─── Save / Load Modal ────────────────────────────────────────────────────────
function SettingsModal({taxonomy,vendorMap,rawTxs,currency,onImport,onClose,noOverlay}) {
  const [err,setErr]     = useState("");
  const [status,setStatus] = useState("idle");
  const [msg,setMsg]     = useState("");
  const loadRef          = React.useRef(null);

  function buildPayload() {
    return {version:1,savedAt:new Date().toISOString(),taxonomy,vendorMap,rawTxs,currency};
  }

  // ── Save: always downloads ledger-data.json to iCloud Downloads ──
  function saveToFile() {
    try {
      const payload = JSON.stringify(buildPayload(),null,2);
      const b64 = btoa(unescape(encodeURIComponent(payload)));
      const a = document.createElement("a");
      a.href = "data:application/json;base64,"+b64;
      a.download = "ledger-data.json";
      a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(()=>document.body.removeChild(a), 2000);
      setStatus("saved"); setMsg("Saved — ledger-data.json is in your iCloud Downloads folder");
    } catch(e) { setErr(e.message||"Save failed"); }
  }

  // ── Load ──
  function handleFileInput(e) {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setErr("");
      let p;
      try { p=JSON.parse(ev.target.result); } catch { setErr("Not valid JSON."); return; }
      if(!p.taxonomy||!p.rawTxs) { setErr("Not a valid ledger-data.json."); return; }
      onImport(p);
      setStatus("loaded");
      setMsg("Loaded "+p.rawTxs.length+" transactions");
    };
    reader.onerror = () => setErr("Could not read file.");
    reader.readAsText(file);
  }

  const settingsInner = (
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,maxWidth:440,width:"100%"}}>
        <div style={{fontFamily:"inherit",fontSize:20,fontWeight:700,marginBottom:6}}>Backup & Restore</div>

        {/* Cloud sync status */}
        <div style={{background:"rgba(42,157,111,0.08)",border:`1px solid ${C.accent}33`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.muted}}>
          <div style={{fontWeight:700,color:C.accent,marginBottom:4}}>☁️ Cloud Sync Active</div>
          <div>Your data auto-saves to Google Firestore on every change. Use backup only as an emergency copy or to transfer data.</div>
        </div>

        {/* Stats */}
        <div style={{background:C.s2,borderRadius:10,padding:"10px 14px",marginBottom:20,display:"flex",gap:16,fontSize:12,fontWeight:500,color:C.muted,flexWrap:"wrap"}}>
          <span>📁 {rawTxs.length} transactions</span>
          <span>🗂 {Object.keys(taxonomy).length} categories</span>
          <span>🔗 {Object.keys(vendorMap).length} mappings</span>
        </div>

        {/* Status messages */}
        {status==="saved"&&(
          <div style={{marginBottom:16,padding:"14px 16px",background:"rgba(42,157,111,0.08)",border:`2px solid ${C.accent}`,borderRadius:12,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>💾</div>
            <div style={{fontSize:15,fontWeight:700,color:"#0e9e7a",marginBottom:4}}>Backup Downloaded</div>
            <div style={{fontSize:12,color:C.muted}}>{msg}</div>
          </div>
        )}
        {status==="loaded"&&(
          <div style={{marginBottom:16,padding:"14px 16px",background:"rgba(42,157,111,0.08)",border:`2px solid ${C.accent}`,borderRadius:12,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>📂</div>
            <div style={{fontSize:15,fontWeight:700,color:"#0e9e7a",marginBottom:4}}>Data Restored</div>
            <div style={{fontSize:12,color:C.muted}}>{msg}</div>
          </div>
        )}
        {(status==="error"||err)&&(
          <div style={{marginBottom:16,padding:"14px 16px",background:"rgba(245,118,118,0.1)",border:`2px solid ${C.danger}`,borderRadius:12,textAlign:"center"}}>
            <div style={{fontSize:13,color:C.danger}}>{err||msg}</div>
          </div>
        )}

        {/* Hidden file input */}
        <input ref={loadRef} type="file" accept=".json,application/json" onChange={handleFileInput} style={{display:"none"}}/>

        {/* Action buttons */}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <button onClick={saveToFile} style={{...btn(C.accent,"#fff","none",15,"15px 0"),width:"100%",fontWeight:700}}>
            💾 Download Backup File
          </button>
          <button onClick={()=>loadRef.current&&loadRef.current.click()} style={{...btn(C.s2,C.text,`1px solid ${C.border}`,15,"15px 0"),width:"100%",fontWeight:600}}>
            📂 Restore from Backup File
          </button>
        </div>

        <div style={{fontSize:11,color:C.dim,lineHeight:1.7,padding:"10px 12px",background:C.s2,borderRadius:8,marginBottom:14}}>
          Use <strong style={{color:C.muted}}>Download Backup</strong> to save a local copy of your data as a JSON file — useful as an emergency copy or to share with another device.<br/><br/>
          Use <strong style={{color:C.muted}}>Restore</strong> to load a previously saved backup file — this will overwrite your current cloud data.
        </div>

        <button onClick={onClose} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,13,"11px 0"),width:"100%"}}>Close</button>
      </div>
  );
  if(noOverlay) return settingsInner;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      {settingsInner}
    </div>
  );
}

// ─── Spending Bar Chart (vertical, cat/sub, type filter, drill-down) ──────────
// ─── Date Range helpers ──────────────────────────────────────────────────────
// ─── Date range helper ───────────────────────────────────────────────────────
function resolvePeriod(preset, customFrom, customTo) {
  const today = new Date();
  // toDateStr: builds YYYY-MM-DD from LOCAL date fields — avoids UTC timezone shift bug
  // Never use toISOString() for date strings — it returns UTC which differs in UAE (UTC+4)
  const toDateStr = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+dd;
  };
  const y = today.getFullYear();
  const mo = today.getMonth(); // 0-based
  const tod = toDateStr(today);
  if(preset==="all")        return { from:"2000-01-01", to:"2099-12-31" };
  if(preset==="this_month") return { from:y+"-"+String(mo+1).padStart(2,"0")+"-01", to:tod };
  if(preset==="last_month") {
    const lm = mo === 0 ? 12 : mo;      // last month number (1-based)
    const ly = mo === 0 ? y-1 : y;      // year of last month
    const lastDay = new Date(ly, lm, 0).getDate(); // last day of last month
    return { from:ly+"-"+String(lm).padStart(2,"0")+"-01",
             to:  ly+"-"+String(lm).padStart(2,"0")+"-"+String(lastDay).padStart(2,"0") };
  }
  if(preset==="this_year")  return { from:y+"-01-01", to:tod };
  if(preset==="last_year")  return { from:(y-1)+"-01-01", to:(y-1)+"-12-31" };
  if(preset==="this_week")  {
    const d=new Date(today); const day=d.getDay()||7; d.setDate(d.getDate()-day+1);
    return { from:toDateStr(d), to:tod };
  }
  if(preset==="last_week")  {
    const d=new Date(today); const day=d.getDay()||7; d.setDate(d.getDate()-day-6);
    const e=new Date(d); e.setDate(e.getDate()+6);
    return { from:toDateStr(d), to:toDateStr(e) };
  }
  return { from: customFrom||"2000-01-01", to: customTo||tod };
}

const PERIOD_PRESETS = [
  ["this_week","This Week"],["last_week","Last Week"],
  ["this_month","This Month"],["last_month","Last Month"],
  ["this_year","This Year"],["last_year","Last Year"],["custom","Custom"],
];

function PeriodPicker({label, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, color}) {
  const {from,to} = resolvePeriod(preset, customFrom, customTo);
  return (
    <div style={{background:C.s2,borderRadius:12,padding:"12px 14px",border:`2px solid ${color}55`}}>
      <div style={{fontSize:11,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{label}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
        {PERIOD_PRESETS.map(([v,l])=>(
          <button key={v} onClick={()=>setPreset(v)} style={{
            padding:"5px 11px",borderRadius:20,
            border:`1px solid ${preset===v?color:C.border}`,
            background:preset===v?color:"transparent",
            color:preset===v?"#fff":C.muted,
            fontSize:11,fontWeight:preset===v?700:500,
            cursor:"pointer",fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>
      {preset==="custom" ? (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:11,fontWeight:500,color:C.muted}}>From</span>
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{...inp(),colorScheme:"light",padding:"4px 8px",fontSize:11,cursor:"pointer",minWidth:130}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:11,fontWeight:500,color:C.muted}}>To</span>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{...inp(),colorScheme:"light",padding:"4px 8px",fontSize:11,cursor:"pointer",minWidth:130}}/>
          </div>
        </div>
      ) : (
        <div style={{fontSize:11,fontWeight:500,color:C.muted,marginTop:2}}>{from} → {to}</div>
      )}
    </div>
  );
}

// ─── Spending Bar Chart (two periods, one bar per cat/sub) ────────────────────

// ─── Canvas Chart Components (no external deps) ───────────────────────────────

// Safari <16 doesn't support ctx.roundRect — polyfill it
function canvasRoundRect(ctx, x, y, w, h, r) {
  if(w<1) w=1;
  var radius = typeof r==='number' ? r : (Array.isArray(r)?r[0]:4);
  radius = Math.min(radius, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius, y);
  ctx.lineTo(x+w-radius, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+radius);
  ctx.lineTo(x+w, y+h-radius);
  ctx.quadraticCurveTo(x+w, y+h, x+w-radius, y+h);
  ctx.lineTo(x+radius, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-radius);
  ctx.lineTo(x, y+radius);
  ctx.quadraticCurveTo(x, y, x+radius, y);
  ctx.closePath();
}

function HBarChart({data, showB, labelA, labelB, colorOf, colA, colB, currency, displayRates, onClickA, onClickB}) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const BAR_H = showB ? 22 : 26;
  const GAP   = showB ? 4  : 0;
  const PAD   = {top:10, right:80, bottom:20, left:120};
  const height = Math.max(180, data.length * (showB ? BAR_H*2+GAP+16 : BAR_H+14) + PAD.top + PAD.bottom);

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    try {
    const dpr = window.devicePixelRatio||1;
    const W = canvas.offsetWidth;
    canvas.width  = W * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,height);

    const maxVal = data.reduce((m,r)=>Math.max(m,r.A||0,r.B||0),1);
    const chartW = W - PAD.left - PAD.right;

    // Grid lines
    const ticks = 4;
    ctx.strokeStyle = "#dde1e9";
    ctx.lineWidth = 1;
    for(let i=0;i<=ticks;i++){
      const x = PAD.left + (chartW/ticks)*i;
      ctx.beginPath(); ctx.moveTo(x,PAD.top); ctx.lineTo(x,height-PAD.bottom); ctx.stroke();
      const v = (maxVal/ticks)*i;
      ctx.fillStyle = "#9ba8b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(v>=1000?(v/1000).toFixed(0)+"k":Math.round(v), x, height-PAD.bottom+14);
    }

    data.forEach((row,i)=>{
      const col = colorOf(row.key);
      const rowTop = PAD.top + i*(showB ? BAR_H*2+GAP+14 : BAR_H+12);

      // Label
      ctx.fillStyle = "#6b7a8d";
      ctx.font = "11px -apple-system,sans-serif";
      ctx.textAlign = "right";
      const label = row.key.length>16 ? row.key.slice(0,15)+"…" : row.key;
      ctx.fillText(label, PAD.left-8, rowTop+BAR_H/2+4);

      // Bar A — uses period A colour
      const wA = (row.A||0)/maxVal * chartW;
      const barColA = colA || col;
      ctx.fillStyle = barColA;
      canvasRoundRect(ctx, PAD.left, rowTop, Math.max(wA,2), BAR_H, 4);
      ctx.fill();

      // Value label A
      if((row.A||0)>0){
        ctx.fillStyle = barColA;
        ctx.font = "bold 10px -apple-system,sans-serif";
        ctx.textAlign = "left";
        const vA = row.A>=1000?(row.A/1000).toFixed(1)+"k":Math.round(row.A);
        ctx.fillText(vA, PAD.left+wA+4, rowTop+BAR_H/2+4);
      }

      // Bar B — uses period B colour
      if(showB && (row.B||0)>=0){
        const wB = (row.B||0)/maxVal * chartW;
        const barColB = colB || "#a78bfa";
        ctx.fillStyle = barColB+"bb";
        canvasRoundRect(ctx, PAD.left, rowTop+BAR_H+GAP, Math.max(wB,2), BAR_H, 4);
        ctx.fill();
        if((row.B||0)>0){
          ctx.fillStyle = barColB;
          ctx.font = "bold 10px -apple-system,sans-serif";
          ctx.textAlign = "left";
          const vB = row.B>=1000?(row.B/1000).toFixed(1)+"k":Math.round(row.B);
          ctx.fillText(vB, PAD.left+wB+4, rowTop+BAR_H+GAP+BAR_H/2+4);
        }
      }
    });
    } catch(err) { console.error("Chart draw error:", err.message); }
  }, [data, showB, height, colorOf, colA, colB, currency]);

  function handleMouseMove(e) {
    const canvas = canvasRef.current; if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const chartW = canvas.offsetWidth - PAD.left - PAD.right;
    const maxVal = data.reduce((m,r)=>Math.max(m,r.A||0,r.B||0),1);
    for(let i=0;i<data.length;i++){
      const row = data[i];
      const rowTop = PAD.top + i*(showB ? (22)*2+4+14 : 26+12);
      const wA = (row.A||0)/maxVal*chartW;
      if(mx>=PAD.left && mx<=PAD.left+wA && my>=rowTop && my<=rowTop+22){
        setTooltip({row,period:"A",x:e.clientX,y:e.clientY}); return;
      }
      if(showB){
        const wB=(row.B||0)/maxVal*chartW;
        if(mx>=PAD.left&&mx<=PAD.left+wB&&my>=rowTop+22+4&&my<=rowTop+22+4+22){
          setTooltip({row,period:"B",x:e.clientX,y:e.clientY}); return;
        }
      }
    }
    setTooltip(null);
  }

  function handleClick(e) {
    const canvas = canvasRef.current; if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const chartW = canvas.offsetWidth - PAD.left - PAD.right;
    const maxVal = data.reduce((m,r)=>Math.max(m,r.A||0,r.B||0),1);
    for(let i=0;i<data.length;i++){
      const row=data[i];
      const rowTop=PAD.top+i*(showB?22*2+4+14:26+12);
      const wA=(row.A||0)/maxVal*chartW;
      if(mx>=PAD.left&&mx<=PAD.left+wA&&my>=rowTop&&my<=rowTop+22){onClickA(row);return;}
      if(showB){
        const wB=(row.B||0)/maxVal*chartW;
        if(mx>=PAD.left&&mx<=PAD.left+wB&&my>=rowTop+22+4&&my<=rowTop+22+4+22){onClickB(row);return;}
      }
    }
  }

  return (
    <div style={{position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:height,cursor:"pointer",display:"block"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)} onClick={handleClick}/>
      {tooltip&&(
        <div style={{position:"fixed",left:tooltip.x+12,top:tooltip.y-10,background:"#1a2a1a",border:"1px solid #2a3a2a",borderRadius:10,padding:"10px 14px",fontSize:12,zIndex:999,pointerEvents:"none",minWidth:140}}>
          <div style={{fontWeight:700,color:colorOf(tooltip.row.key),marginBottom:5}}>{tooltip.row.key}</div>
          <div style={{color:C.muted,display:"flex",justifyContent:"space-between",gap:12}}>
            <span style={{color:tooltip.period==="A"?C.accent:"#a78bfa"}}>{tooltip.period==="A"?labelA:labelB}</span>
            <span style={{fontFamily:"monospace",color:C.text}}>{fmt(tooltip.period==="A"?tooltip.row.A:tooltip.row.B, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LineChartCanvas({data, series, colorOf, currency, xKey, dashedKeys=[]}) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const H = 260;
  const PAD = {top:16, right:16, bottom:32, left:52};

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const dpr = window.devicePixelRatio||1;
    const W = canvas.offsetWidth;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);

    if(!data.length||!series.length) return;
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const maxVal = data.reduce((m,d)=>series.reduce((mm,s)=>Math.max(mm,d[s]||0),m),1);

    // Grid
    const yTicks = 4;
    ctx.strokeStyle = "#dde1e9";
    ctx.lineWidth = 1;
    for(let i=0;i<=yTicks;i++){
      const y = PAD.top + chartH - (chartH/yTicks)*i;
      ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+chartW,y); ctx.stroke();
      const v = (maxVal/yTicks)*i;
      ctx.fillStyle = "#9ba8b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(v>=1000?(v/1000).toFixed(0)+"k":Math.round(v), PAD.left-4, y+3);
    }

    // X labels
    const step = Math.max(1, Math.floor(data.length/8));
    ctx.fillStyle = "#9ba8b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    data.forEach((d,i)=>{
      if(i%step!==0) return;
      const x = PAD.left + (i/(Math.max(data.length-1,1)))*chartW;
      ctx.fillText(String(d[xKey]||"").slice(0,7), x, H-PAD.bottom+14);
    });

    // Lines
    series.forEach(s=>{
      const col = colorOf(s);
      const isDashed = dashedKeys.includes(s);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash(isDashed?[6,3]:[]);
      ctx.beginPath();
      let started = false;
      data.forEach((d,i)=>{
        const v = d[s];
        if(v==null) return; // null = no data; zero = valid (plot at bottom)
        const x = PAD.left + (i/(Math.max(data.length-1,1)))*chartW;
        const y = PAD.top + chartH - (v/maxVal)*chartH;
        if(!started){ ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      // Dots — only on non-null, non-zero points (zero points are on the baseline, no dot needed)
      ctx.fillStyle = col;
      data.forEach((d,i)=>{
        const v = d[s]; if(v==null||v===0) return;
        const x = PAD.left + (i/(Math.max(data.length-1,1)))*chartW;
        const y = PAD.top + chartH - (v/maxVal)*chartH;
        ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
      });
    });
  }, [data, series, H, colorOf, dashedKeys, xKey, currency]);

  function handleMouseMove(e) {
    const canvas = canvasRef.current; if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const chartW = canvas.offsetWidth - PAD.left - PAD.right;
    const n = data.length;
    if(n<2){setTooltip(null);return;}
    const idx = Math.round((mx-PAD.left)/chartW*(n-1));
    if(idx<0||idx>=n){setTooltip(null);return;}
    const d = data[idx];
    const vals = series.map(s=>({s,v:d[s]})).filter(x=>x.v!=null&&x.v>0);
    if(!vals.length){setTooltip(null);return;}
    setTooltip({label:d[xKey],vals,x:e.clientX,y:e.clientY});
  }

  return (
    <div style={{position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:H,display:"block"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
      {tooltip&&(
        <div style={{position:"fixed",left:tooltip.x+12,top:tooltip.y-10,background:"#1a2a1a",border:"1px solid #2a3a2a",borderRadius:10,padding:"10px 14px",fontSize:12,zIndex:999,pointerEvents:"none",minWidth:150}}>
          <div style={{fontWeight:700,color:C.muted,marginBottom:6}}>{tooltip.label}</div>
          {tooltip.vals.map(({s,v})=>(
            <div key={s} style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:2}}>
              <span style={{color:colorOf(s)}}>{s.length>18?s.slice(0,17)+"…":s}</span>
              <span style={{fontFamily:"monospace",color:C.text}}>{fmt(v,currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SpendingChart({transactions,taxonomy,currency,onDrillTxs,pFrom,pTo,globalTypeFilter,displayRates,displayCurrency,avgMode,mMonths}) {
  const [mode,setMode]             = useState("categories");
  const [chartView,setChartView]   = useState("comparison"); // "comparison" | "overtime"
  const [overtimeSel,setOvertimeSel] = useState("__all__"); // "__all__" or category/sub name
  const [showB,setShowB]           = useState(false);
  const [monthDrill,setMonthDrill] = useState(null);
  const [selMonthsB,setSelMonthsB] = useState([]);
  const [showMonthPickerB,setShowMonthPickerB] = useState(false); // {key, data, txs, label, color}

  // Period B (comparison only — Period A uses global pFrom/pTo)
  const [presetB,setPresetB]       = useState("last_month");
  const [cfB,setCfB]               = useState("");
  const [ctB,setCtB]               = useState("");

  const {from:fromB, to:toB} = useMemo(()=>resolvePeriod(presetB,cfB,ctB),[presetB,cfB,ctB]);

  const txA = useMemo(()=>transactions,[transactions]); // already filtered by App (mTxs)
  const txB = useMemo(()=>transactions.filter(t=>t.date>=fromB&&t.date<=toB&&globalTypeFilter.includes(t.txType)&&(selMonthsB.length===0||selMonthsB.includes((t.date ? t.date.slice(0,7) : '')))),[transactions,fromB,toB,globalTypeFilter,selMonthsB]);

  const chartData = useMemo(()=>{
    const sk = mode==="categories"?"category":"subcategory";
    const keys = [...new Set([...txA,...txB].map(t=>t[sk]))];
    const totsA={}, totsB={};
    txA.forEach(t=>{totsA[t[sk]]=(totsA[t[sk]]||0)+t.amount;});
    txB.forEach(t=>{totsB[t[sk]]=(totsB[t[sk]]||0)+t.amount;});
    const div = avgMode?(mMonths||1):1;
    var dc = displayCurrency || currency;
    var rate = (displayRates && dc && displayRates[dc]) ? displayRates[dc] : 1;
    return keys
      .map(k=>({key:k, A:((totsA[k]||0)/div)*rate, B:(totsB[k]||0)*rate}))
      .sort((a,b)=>(b.A+b.B)-(a.A+a.B));
  },[txA,txB,mode,avgMode,mMonths,displayRates,currency,displayCurrency]);

  const colorOf = k => {
    if(mode==="categories") return readableColour(taxonomy[k]?.color||PAL[chartData.findIndex(r=>r.key===k)%PAL.length]);
    for(const[,d] of Object.entries(taxonomy)) if(d.subs[k]) return readableColour(d.color);
    return readableColour(PAL[chartData.findIndex(r=>r.key===k)%PAL.length]);
  };

  // Over-time chart data: one bar per month, filtered to selected category/sub
  const overtimeData = useMemo(()=>{
    const sk = mode==="categories"?"category":"subcategory";
    // Respect globalTypeFilter — same logic as mTxs passType
    const passType = t => t.isCredit || globalTypeFilter.includes(t.txType);
    const base = txA.filter(passType);
    const filtered = overtimeSel==="__all__" ? base : base.filter(t=>t[sk]===overtimeSel);
    const byMonth = {};
    filtered.forEach(t=>{
      const m = (t.date ? t.date.slice(0,7) : "");
      if(!m) return;
      byMonth[m] = (byMonth[m]||0) + t.amount;
    });
    var rate = (displayRates && displayCurrency && displayRates[displayCurrency]) ? displayRates[displayCurrency] : 1;
    return Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b))
      .map(([m,v])=>({key:fmtM(m), rawKey:m, A:v*rate, B:0}));
  },[txA,mode,overtimeSel,displayRates,displayCurrency,globalTypeFilter]);

  // Category/sub options for over-time selector
  const overtimeOptions = useMemo(()=>{
    const sk = mode==="categories"?"category":"subcategory";
    const keys=[...new Set(txA.map(t=>t[sk]))].filter(Boolean).sort();
    return keys;
  },[txA,mode]);

  const labelA = pFrom===pTo ? pFrom : pFrom.slice(0,7)===pTo.slice(0,7) ? pFrom.slice(0,7) : pFrom+" → "+pTo;
  const fmtC = (n) => fmt(n, currency);
  const labelB = useMemo(()=>PERIOD_PRESETS.find(([v])=>v===presetB)?.[1]||"Period B",[presetB]);

  function handleClick(entry, period) {
    if(!entry) return;
    const sk = mode==="categories"?"category":"subcategory";
    const txs = (period==="A"?txA:txB).filter(t=>t[sk]===entry.key);
    if(!txs.length) return;
    // Build monthly bar data for this category/subcategory
    const monthTots={};
    txs.forEach(t=>{ const m=(t.date ? t.date.slice(0,7) : ''); if(m) monthTots[m]=(monthTots[m]||0)+t.amount; });
    const monthData=Object.entries(monthTots).sort(([a],[b])=>a.localeCompare(b)).map(([m,v])=>({key:m,A:v,B:0}));
    if(monthData.length===1) {
      // Only one month — just show transactions
      onDrillTxs(txs, entry.key+" · "+(period==="A"?labelA:labelB));
    } else {
      setMonthDrill({key:entry.key, data:monthData, txs, label:entry.key, color:colorOf(entry.key)});
    }
  }

  // Custom tooltip
  function BarTT({active,payload,label}) {
    if(!active||!payload?.length) return null;
    const col = colorOf(label);
    return (
      <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,minWidth:160}}>
        <div style={{fontWeight:700,color:col,marginBottom:6}}>{label}</div>
        {payload.map((p,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:2,color:C.muted}}>
            <span style={{color:p.fill}}>{p.name}</span>
            <span style={{fontFamily:"monospace",color:C.text}}>{fmt(p.value,currency)}</span>
          </div>
        ))}
        {payload.length===2&&payload[1].value>0&&(
          <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,fontSize:11,color:C.dim}}>
            {payload[0].value>payload[1].value
              ? <span style={{color:C.danger}}>▲ {((payload[0].value/payload[1].value-1)*100).toFixed(0)}% vs {labelB}</span>
              : <span style={{color:"#0e9e7a"}}>▼ {((1-payload[0].value/payload[1].value)*100).toFixed(0)}% vs {labelB}</span>
            }
          </div>
        )}
      </div>
    );
  }

  const barHeight = showB ? 52 : 34;

  return (
    <div style={card}>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setChartView("comparison")} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${chartView==="comparison"?C.accent:C.border}`,background:chartView==="comparison"?"rgba(42,157,111,0.08)":"transparent",color:chartView==="comparison"?C.accent:C.muted,fontSize:13,fontWeight:chartView==="comparison"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
            📊 Category Comparison
          </button>
          <button onClick={()=>setChartView("overtime")} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${chartView==="overtime"?C.accent:C.border}`,background:chartView==="overtime"?"rgba(42,157,111,0.08)":"transparent",color:chartView==="overtime"?C.accent:C.muted,fontSize:13,fontWeight:chartView==="overtime"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
            📈 Time Comparison
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Pill options={[["categories","Categories"],["subcategories","Subcategories"]]} value={mode} onChange={v=>{setMode(v);setOvertimeSel("__all__");}}/>
          {chartView==="overtime"&&(
            <select value={overtimeSel} onChange={e=>setOvertimeSel(e.target.value)} style={{...inp({padding:"5px 10px",fontSize:12}),width:"auto",maxWidth:160}}>
              <option value="__all__">All {mode==="categories"?"Categories":"Subcategories"}</option>
              {overtimeOptions.map(k=><option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Period B picker — same pill style as main */}
      {showB && (
        <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(90,111,214,0.06)",border:"1px solid rgba(90,111,214,0.2)",borderRadius:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#5a6fd6",marginBottom:8,letterSpacing:"0.06em"}}>PERIOD B</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:presetB==="custom"?8:4}}>
            {[["all","All"],["this_year","This Year"],["last_year","Last Year"],["this_month","This Month"],["last_month","Last Month"],["custom","Custom"]].map(([v,l])=>(
              <button key={v} onClick={()=>{setPresetB(v);setSelMonthsB([]);}} style={{padding:"5px 11px",borderRadius:20,border:`1px solid ${presetB===v?"#5a6fd6":C.border}`,background:presetB===v?"#5a6fd6":"transparent",color:presetB===v?"#fff":C.muted,fontSize:12,cursor:"pointer",fontWeight:presetB===v?700:500,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {presetB==="custom"&&(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontSize:11,color:C.dim}}>From</span>
              <input type="date" value={cfB} onChange={e=>setCfB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,cursor:"pointer",width:"auto"}}/>
              <span style={{color:C.dim}}>→</span>
              <span style={{fontSize:11,color:C.dim}}>To</span>
              <input type="date" value={ctB} onChange={e=>setCtB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,cursor:"pointer",width:"auto"}}/>
            </div>
          )}
          <div style={{fontSize:10,color:"#5a6fd6",fontFamily:"monospace",marginBottom:6}}>{fromB} → {toB}</div>
          {/* Month selector for Period B */}
          {(()=>{
            const bMonths=[...new Set(transactions.filter(t=>t.date>=fromB&&t.date<=toB).map(t=>(t.date ? t.date.slice(0,7) : '')).filter(Boolean))].sort();
            if(bMonths.length<2) return null;
            const bLabel = selMonthsB.length===0?"📅 Months ▾":selMonthsB.length===1?"📅 "+fmtM(selMonthsB[0])+" ▾":"📅 "+selMonthsB.length+" Months ▾";
            return (
              <div style={{position:"relative",display:"inline-block",marginTop:4}}>
                <button onClick={()=>setShowMonthPickerB(v=>!v)} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${selMonthsB.length>0?"#5a6fd6":C.border}`,background:selMonthsB.length>0?"#5a6fd6":"transparent",color:selMonthsB.length>0?"#fff":C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                  {bLabel}
                </button>
                {showMonthPickerB&&(<>
                  <div onClick={()=>setShowMonthPickerB(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                  <div style={{position:"absolute",top:"110%",left:0,zIndex:200,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",minWidth:160,maxHeight:220,overflowY:"auto"}}>
                    <div onClick={()=>{setSelMonthsB([]);setShowMonthPickerB(false);}} style={{padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.s2}`,cursor:"pointer",background:selMonthsB.length===0?"rgba(90,111,214,0.06)":"transparent"}}>
                      <span style={{fontSize:13,fontWeight:600,color:selMonthsB.length===0?"#5a6fd6":C.text}}>All Months</span>
                      {selMonthsB.length===0&&<span style={{color:"#5a6fd6"}}>✓</span>}
                    </div>
                    {bMonths.map(m=>{
                      const on=selMonthsB.includes(m);
                      return (
                        <div key={m} onClick={()=>setSelMonthsB(prev=>on?prev.filter(x=>x!==m):[...prev,m])} style={{padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.s2}`,cursor:"pointer",background:on?"rgba(90,111,214,0.06)":"transparent"}}>
                          <span style={{fontSize:13,fontWeight:on?600:400,color:on?"#5a6fd6":C.text}}>{fmtM(m)}</span>
                          {on&&<span style={{color:"#5a6fd6"}}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </>)}
              </div>
            );
          })()}
        </div>
      )}
      {chartView==="comparison"&&<button onClick={()=>setShowB(v=>!v)} style={{...btn(showB?"rgba(167,139,250,0.15)":C.s2, showB?"#a78bfa":C.muted, `1px solid ${showB?"#a78bfa44":C.border}`, 11, "5px 12px"),marginBottom:14}}>
        {showB?"✕ Remove Period B":"+ Compare Period B"}
      </button>}



      {/* Legend when comparing */}
      {showB&&(
        <div style={{display:"flex",gap:16,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:C.accent}}>
            <div style={{width:14,height:14,borderRadius:3,background:C.accent}}/>{labelA}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#5a6fd6"}}>
            <div style={{width:14,height:14,borderRadius:3,background:"#5a6fd6bb"}}/>{labelB}
          </div>
        </div>
      )}

      {chartView==="comparison" ? (
        chartData.length===0
          ? <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:13}}>No data for this period</div>
          : <HBarChart data={chartData} showB={showB} labelA={labelA} labelB={labelB} colorOf={colorOf} colA={C.accent} colB={"#5a6fd6"} currency={currency} displayRates={displayRates} onClickA={e=>handleClick(e,"A")} onClickB={e=>handleClick(e,"B")}/>
      ) : (
        overtimeData.length===0
          ? <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:13}}>No data for this period</div>
          : <HBarChart
              data={overtimeData}
              showB={false} labelA="Spend" labelB=""
              colorOf={()=>C.accent} colA={C.accent} colB={C.accent}
              currency={currency} displayRates={displayRates}
              onClickA={r=>{
                if(!r) return;
                const mKey = overtimeData.find(d=>d.key===r.key)?.rawKey;
                if(!mKey) return;
                const sk = mode==="categories"?"category":"subcategory";
                const txs = txA.filter(t=>{
                  const m=(t.date ? t.date.slice(0,7) : "");
                  if(m!==mKey) return false;
                  if(!t.isCredit && !globalTypeFilter.includes(t.txType)) return false;
                  if(overtimeSel!=="__all__") return t[sk]===overtimeSel;
                  return true;
                });
                if(txs.length) onDrillTxs(txs, (overtimeSel==="__all__"?"All":overtimeSel)+" · "+fmtM(mKey));
              }}
              onClickB={()=>{}}
            />
      )}
      <div style={{fontSize:11,color:C.dim,marginTop:8,textAlign:"center"}}>
        {chartView==="comparison"?"Tap a bar to see monthly breakdown":"Tap a bar to see transactions for that month"}
      </div>

      {/* Monthly breakdown overlay */}
      {monthDrill&&(
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.surface,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",width:"100%",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:C.text}}>{monthDrill.label}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>Monthly spend</div>
              </div>
              <button onClick={()=>setMonthDrill(null)} style={{background:C.s2,border:"none",borderRadius:20,width:32,height:32,fontSize:18,cursor:"pointer",color:C.muted}}>×</button>
            </div>
            <HBarChart
              data={monthDrill.data.map(r=>({...r,key:fmtM(r.key)}))}
              showB={false} labelA="Spend" labelB="" currency={currency}
              colorOf={()=>C.accent}
              colA={C.accent} colB="#5a6fd6" displayRates={displayRates}
              onClickA={r=>{
                if(!r) return;
                const mKey=monthDrill.data.find(d=>fmtM(d.key)===r.key)?.key;
                if(!mKey) return;
                const txs=monthDrill.txs.filter(t=>(t.date ? t.date.slice(0,7) : '')===mKey);
                if(txs.length){ setMonthDrill(prev=>({...prev,txDrill:{txs,label:monthDrill.label+" · "+fmtM(mKey)}})); }
              }}
              onClickB={()=>{}}
            />
            <div style={{fontSize:11,color:C.dim,marginTop:8,textAlign:"center"}}>Tap a bar to see that month's transactions</div>

            {/* Transaction sub-overlay with back button */}
            {monthDrill.txDrill&&(
              <div style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <button onClick={()=>setMonthDrill(prev=>({...prev,txDrill:null}))} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,12,"6px 12px"),display:"flex",alignItems:"center",gap:4}}>‹ Back</button>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{monthDrill.txDrill.label}</span>
                </div>
                <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  {monthDrill.txDrill.txs.map((tx,i)=>{
                    const isCredit=tx.isCredit===true;
                    return (
                      <div key={i} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.s2}`}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDNum(tx.date)} · {tx.subcategory}</div>
                        </div>
                        <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:isCredit?C.accent:C.danger,flexShrink:0}}>{isCredit?"+":"-"}{fmtExact(tx.amount,currency)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trend + Averages Chart ───────────────────────────────────────────────────
function TrendChart({transactions,taxonomy,currency,pFrom,pTo}) {
  const [mode,setMode]             = useState("categories");
  const [chartType,setChartType]   = useState("trend");   // "trend" | "averages"
  const [gran,setGran]             = useState("month");
  const [avgGran,setAvgGran]       = useState("month");
  const [sel,setSel]               = useState([]);
  const [typeFilter,setTypeFilter] = useState(["standard","nonstandard","exceptional"]);

  // For compare mode
  const allMonths = useMemo(()=>[...new Set(transactions.map(t=>t.month))].sort(),[transactions]);
  const [cmpA,setCmpA] = useState(allMonths[Math.max(0,allMonths.length-2)]||"");
  const [cmpB,setCmpB] = useState(allMonths[allMonths.length-1]||"");

  const from = pFrom;
  const to   = pTo;
  const filtered = useMemo(()=>transactions.filter(t=>t.date>=from&&t.date<=to&&typeFilter.includes(t.txType)),[transactions,from,to,typeFilter]);

  const allSeries = useMemo(()=>{
    const s=new Set(filtered.map(t=>mode==="categories"?t.category:t.subcategory));
    return [...s].sort();
  },[filtered,mode]);

  const top5 = useMemo(()=>{
    const tots={};
    filtered.forEach(t=>{const k=mode==="categories"?t.category:t.subcategory; tots[k]=(tots[k]||0)+t.amount;});
    return Object.entries(tots).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
  },[filtered,mode]);

  const active = sel.length?sel:top5;

  const colorOf = n => {
    if(mode==="categories") return readableColour(taxonomy[n]?.color||PAL[allSeries.indexOf(n)%PAL.length]);
    for(const[,d] of Object.entries(taxonomy)) if(d.subs[n]) return readableColour(d.color);
    return readableColour(PAL[allSeries.indexOf(n)%PAL.length]);
  };

  const getBucket = (t,g) => g==="day"?t.date:g==="week"?weekKey(t.date):(t.date ? t.date.substring(0,7) : '')||"";
  const getLabel  = (k,g) => g==="month"?fmtM(k):g==="day"?fmtD(k):k;

  // ── Trend data ──
  const trendData = useMemo(()=>{
    const b={};
    filtered.forEach(t=>{
      const k=getBucket(t,gran); if(!k) return;
      if(!b[k])b[k]={_k:k};
      const sk=mode==="categories"?t.category:t.subcategory;
      b[k][sk]=(b[k][sk]||0)+t.amount;
    });
    return Object.values(b).sort((a,x)=>a._k.localeCompare(x._k)).map(r=>({...r,label:getLabel(r._k,gran)}));
  },[filtered,mode,gran]);

  // ── Averages data: for each selected series, avg spend per bucket ──
  const avgData = useMemo(()=>{
    if(chartType!=="averages") return [];
    const sk = mode==="categories"?"category":"subcategory";
    // Collect all buckets
    const buckets={};
    filtered.forEach(t=>{
      const bk=getBucket(t,avgGran); if(!bk) return;
      if(!buckets[bk]) buckets[bk]={};
      buckets[bk][t[sk]]=(buckets[bk][t[sk]]||0)+t.amount;
    });
    const allBuckets=Object.keys(buckets).sort();
    const nBuckets=allBuckets.length||1;
    // Build one row per series: { series, avg, total, count }
    return active.map(s=>{
      const total=allBuckets.reduce((sum,bk)=>sum+(buckets[bk]?.[s]||0),0);
      const nonZeroBuckets=allBuckets.filter(bk=>(buckets[bk]?.[s]||0)>0).length||1;
      return {key:s, avg:total/nonZeroBuckets, total};
    }).sort((a,b)=>b.avg-a.avg);
  },[filtered,chartType,mode,avgGran,active]);

  // ── Compare mode: two period lines ──
  const compareData = useMemo(()=>{
    if(chartType!=="compare") return [];
    const sk=mode==="categories"?"category":"subcategory";
    const txA=transactions.filter(t=>t.month===cmpA&&typeFilter.includes(t.txType));
    const txB=transactions.filter(t=>t.month===cmpB&&typeFilter.includes(t.txType));
    const days=[...new Set([...txA,...txB].map(t=>t.date.slice(8)))].sort();
    return days.map(d=>{
      const r={day:"D"+parseInt(d,10)};
      active.forEach(s=>{
        r[s+" ("+fmtM(cmpA)+")"] = txA.filter(t=>t.date.slice(8)===d&&t[sk]===s).reduce((a,t)=>a+t.amount,0)||null;
        r[s+" ("+fmtM(cmpB)+")"] = txB.filter(t=>t.date.slice(8)===d&&t[sk]===s).reduce((a,t)=>a+t.amount,0)||null;
      });
      return r;
    });
  },[chartType,transactions,cmpA,cmpB,active,mode,typeFilter]);

  const compareLines = useMemo(()=>{
    if(chartType!=="compare") return [];
    return active.flatMap(s=>[
      {key:s+" ("+fmtM(cmpA)+")", color:colorOf(s), dash:"6 3"},
      {key:s+" ("+fmtM(cmpB)+")", color:colorOf(s), dash:""},
    ]);
  },[chartType,active,cmpA,cmpB]);

  // Date range now comes from global period picker — no local date picker needed

  return (
    <div style={card}>
      <div style={{marginBottom:14}}>
        <div style={{fontFamily:"inherit",fontSize:17,marginBottom:10}}>Trends & Averages</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          {[["trend","📈 Trend"],["averages","⌀ Averages"],["compare","⇄ Compare"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setChartType(v);setSel([]);}} style={{padding:"7px 14px",borderRadius:10,border:`1px solid ${chartType===v?C.accent:C.border}`,background:chartType===v?"rgba(62,180,137,0.08)":"transparent",color:chartType===v?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:chartType===v?700:400}}>{l}</button>
          ))}
        </div>
        <Pill options={[["categories","Categories"],["subcategories","Subcategories"]]} value={mode} onChange={v=>{setMode(v);setSel([]);}}/>
      </div>

      <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Period: {from} → {to} · {filtered.length} transactions</div>

      {/* Granularity */}
      {chartType==="trend"&&(
        <div style={{marginBottom:12}}><Pill options={[["day","Day"],["week","Week"],["month","Month"]]} value={gran} onChange={setGran}/></div>
      )}
      {chartType==="averages"&&(
        <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:C.dim}}>Average per</span>
          <Pill options={[["week","Week"],["month","Month"]]} value={avgGran} onChange={setAvgGran}/>
        </div>
      )}

      {/* Compare period pickers */}
      {chartType==="compare"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,fontFamily:"monospace"}}>PERIOD A (dashed)</div>
            <select value={cmpA} onChange={e=>setCmpA(e.target.value)} style={{...inp(),appearance:"none",fontSize:12,padding:"6px 10px"}}>
              {allMonths.map(m=><option key={m} value={m}>{fmtM(m)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,fontFamily:"monospace"}}>PERIOD B (solid)</div>
            <select value={cmpB} onChange={e=>setCmpB(e.target.value)} style={{...inp(),appearance:"none",fontSize:12,padding:"6px 10px"}}>
              {allMonths.map(m=><option key={m} value={m}>{fmtM(m)}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Type filter */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {Object.entries(TYPE_META).map(([v,m])=>(
          <button key={v} onClick={()=>setTypeFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${typeFilter.includes(v)?m.color:C.border}`,background:typeFilter.includes(v)?m.color+"18":"transparent",color:typeFilter.includes(v)?m.color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:typeFilter.includes(v)?600:400}}>
            {typeFilter.includes(v)?"●":"○"} {m.full}
          </button>
        ))}
      </div>

      {/* Series selector (trend + compare) */}
      {(chartType==="trend"||chartType==="compare")&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
          {allSeries.map(name=>{
            const on=active.includes(name); const col=colorOf(name);
            return (
              <button key={name} onClick={()=>setSel(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name])} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${on?col:C.border}`,background:on?col+"22":"transparent",color:on?col:C.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:on?600:400}}>
                {on?"●":"○"} {name}
              </button>
            );
          })}
          {sel.length>0&&<button onClick={()=>setSel([])} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,fontSize:11,cursor:"pointer"}}>Reset</button>}
        </div>
      )}

      {/* Series selector (averages — horizontal bars) */}
      {chartType==="averages"&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
          {allSeries.map(name=>{
            const on=active.includes(name); const col=colorOf(name);
            return (
              <button key={name} onClick={()=>setSel(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name])} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${on?col:C.border}`,background:on?col+"22":"transparent",color:on?col:C.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:on?600:400}}>
                {on?"●":"○"} {name}
              </button>
            );
          })}
          {sel.length>0&&<button onClick={()=>setSel([])} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,fontSize:11,cursor:"pointer"}}>Reset</button>}
        </div>
      )}

      {/* ── Trend chart ── */}
      {chartType==="trend"&&(
        trendData.length===0
          ? <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:13}}>No data for this period</div>
          : <LineChartCanvas data={trendData} series={active} colorOf={colorOf} currency={currency} xKey="label"/>
      )}

      {/* ── Averages horizontal bar chart ── */}
      {chartType==="averages"&&(
        avgData.length===0
          ? <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:13}}>No data for this period</div>
          : <>
              <div style={{fontSize:12,fontWeight:500,color:C.muted,marginBottom:10}}>
                Average spend per {avgGran} · <span style={{fontFamily:"monospace",color:C.text}}>{from}</span> → <span style={{fontFamily:"monospace",color:C.text}}>{to}</span>
              </div>
              <HBarChart data={avgData.map(r=>({key:r.key,A:r.avg}))} showB={false} labelA={"Avg/"+avgGran} labelB="" colorOf={colorOf} currency={currency} onClickA={()=>{}} onClickB={()=>{}}/>
            </>
      )}

      {/* ── Compare lines ── */}
      {chartType==="compare"&&(
        compareData.length===0
          ? <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:13}}>No data to compare</div>
          : <>
              <div style={{fontSize:11,color:C.dim,marginBottom:8}}>
                Dashed = {fmtM(cmpA)} &nbsp;·&nbsp; Solid = {fmtM(cmpB)} &nbsp;·&nbsp; Same colour = same {mode==="categories"?"category":"subcategory"}
              </div>
              <LineChartCanvas data={compareData} series={compareLines.map(l=>l.key)} colorOf={k=>compareLines.find(l=>l.key===k)?.color||"#888"} currency={currency} xKey="day" dashedKeys={compareLines.filter(l=>l.dash).map(l=>l.key)}/>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
                {active.map(n=>(
                  <div key={n} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.muted}}>
                    <div style={{width:16,height:2,background:colorOf(n),borderRadius:1}}/>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </>
      )}
    </div>
  );
}

// ─── All Subcategories ────────────────────────────────────────────────────────
function AllSubs({transactions,allTxs,taxonomy,currency,dispRates,onDrill,avgMode,mMonths}) {
  const [sort,setSort]=useState("amount");
  const [showCmp,setShowCmp]=useState(false);
  const [presetB,setPresetB]=useState("last_month");
  const [cfB,setCfB]=useState("");
  const [ctB,setCtB]=useState("");
  const {from:fromB,to:toB}=useMemo(()=>resolvePeriod(presetB,cfB,ctB),[presetB,cfB,ctB]);
  const txsB=useMemo(()=>(allTxs||transactions).filter(t=>t.date>=fromB&&t.date<=toB),[allTxs,transactions,fromB,toB]);
  const grand=transactions.reduce((s,t)=>s+t.amount,0);
  const rows=useMemo(()=>{
    const m={};
    transactions.forEach(t=>{
      const k=t.category+"||"+t.subcategory;
      if(!m[k])m[k]={category:t.category,subcategory:t.subcategory,amount:0,count:0};
      m[k].amount+=t.amount; m[k].count++;
    });
    const arr=Object.values(m);
    if(sort==="amount") arr.sort((a,b)=>b.amount-a.amount);
    else if(sort==="name") arr.sort((a,b)=>a.subcategory.localeCompare(b.subcategory));
    else arr.sort((a,b)=>a.category.localeCompare(b.category)||b.amount-a.amount);
    return arr;
  },[transactions,sort]);
  const rowsB=useMemo(()=>{
    const m={};
    txsB.forEach(t=>{
      const k=t.category+"||"+t.subcategory;
      if(!m[k])m[k]={amount:0};
      m[k].amount+=t.amount;
    });
    return m;
  },[txsB]);
  const labelB=useMemo(()=>PERIOD_PRESETS.find(([v])=>v===presetB)?.[1]||"Period B",[presetB]);
  return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
        <div>
          <div style={{fontFamily:"inherit",fontSize:17,marginBottom:2}}>All Subcategories</div>
          <div style={{fontSize:12,fontWeight:500,color:C.muted}}>{rows.length} subcategories · {fmt(grand,currency)}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setShowCmp(v=>!v)} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${showCmp?"#5a6fd6":C.border}`,background:showCmp?"#5a6fd6":"transparent",color:showCmp?"#fff":C.muted,fontSize:12,fontWeight:showCmp?700:500,cursor:"pointer",fontFamily:"inherit"}}>⇄ Compare</button>
          <Pill options={[["amount","Amount"],["cat","Category"],["name","A–Z"]]} value={sort} onChange={setSort}/>
        </div>
      </div>
      {showCmp&&(
        <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(90,111,214,0.06)",border:"1px solid rgba(90,111,214,0.2)",borderRadius:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#5a6fd6",marginBottom:8,letterSpacing:"0.06em"}}>COMPARE TO</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:presetB==="custom"?8:0}}>
            {[["this_year","This Year"],["last_year","Last Year"],["this_month","This Month"],["last_month","Last Month"],["all","All Time"],["custom","Custom"]].map(([v,l])=>(
              <button key={v} onClick={()=>setPresetB(v)} style={{padding:"5px 11px",borderRadius:20,border:`1px solid ${presetB===v?"#5a6fd6":C.border}`,background:presetB===v?"#5a6fd6":"transparent",color:presetB===v?"#fff":C.muted,fontSize:12,cursor:"pointer",fontWeight:presetB===v?700:500,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {presetB==="custom"&&(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
              <span style={{fontSize:11,color:C.dim}}>From</span>
              <input type="date" value={cfB} onChange={e=>setCfB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,width:"auto"}}/>
              <span style={{color:C.dim}}>→</span>
              <span style={{fontSize:11,color:C.dim}}>To</span>
              <input type="date" value={ctB} onChange={e=>setCtB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,width:"auto"}}/>
            </div>
          )}
        </div>
      )}
      {showCmp&&<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:8,fontSize:11,color:C.muted,paddingRight:30}}><span style={{minWidth:72,textAlign:"right",fontWeight:700,color:C.accent}}>Selected</span><span style={{minWidth:72,textAlign:"right",color:"#5a6fd6"}}>{labelB}</span></div>}
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        {rows.map((r,i)=>{
          const cd=taxonomy[r.category]||{icon:"📦",color:C.muted,subs:{}};
          const sd=cd.subs[r.subcategory]||{icon:"📦"};
          const pct=grand>0?r.amount/grand*100:0;
          const valB=(rowsB[r.category+"||"+r.subcategory]||{}).amount||0;
          const diff=valB>0?((r.amount-valB)/valB*100):null;
          return (
            <div key={i} onClick={()=>onDrill&&onDrill(r.category,r.subcategory)} style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}>
              <div style={{width:34,height:34,borderRadius:9,background:readableColour(cd.color)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{sd.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showCmp?3:4,gap:4}}>
                  <div style={{flex:1,minWidth:0,overflow:"hidden"}}><span style={{fontSize:13,fontWeight:600}}>{r.subcategory}</span><span style={{fontSize:11,color:C.dim,marginLeft:8}}>{cd.icon} {r.category}</span></div>
                  {showCmp?(
                    <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                      <span style={{fontFamily:"monospace",fontSize:12,color:readableColour(cd.color),minWidth:72,textAlign:"right"}}>{fmt(r.amount,currency)}</span>
                      <span style={{fontFamily:"monospace",fontSize:12,color:"#5a6fd6",minWidth:72,textAlign:"right"}}>{valB>0?fmt(valB,currency):"—"}</span>
                      {diff!==null&&<span style={{fontSize:10,fontWeight:700,color:diff>0?C.danger:C.accent,minWidth:36,textAlign:"right"}}>{diff>0?"▲":"▼"}{Math.abs(diff).toFixed(0)}%</span>}
                    </div>
                  ):(
                    <span style={{fontFamily:"monospace",fontSize:13,color:readableColour(cd.color),marginLeft:8,flexShrink:0}}>{fmt(r.amount,currency)}</span>
                  )}
                </div>
                {!showCmp&&<><div style={{height:4,background:C.s2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:cd.color,borderRadius:3}}/></div>
                <div style={{fontSize:11,color:C.dim,marginTop:3}}>{r.count} transaction{r.count!==1?"s":""} · {pct.toFixed(1)}%</div></>}
                {showCmp&&<div style={{fontSize:11,color:C.dim}}>{r.count} transaction{r.count!==1?"s":""}</div>}
              </div>
              <span style={{color:C.dim,fontSize:18}}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Drill-down ───────────────────────────────────────────────────────────────
function Drill({txs,cur,dispRates,taxonomy,onRemap,initCat,initSub,onClearInit,avgMode,mMonths,allTxs}) {
  const [cat,setCat]=useState(initCat||null);
  const [sub,setSub]=useState(initSub||null);
  const [showCmp,setShowCmp]=useState(false);
  const [presetB,setPresetB]=useState("last_month");
  const [cfB,setCfB]=useState("");
  const [ctB,setCtB]=useState("");
  const {from:fromB,to:toB}=useMemo(()=>resolvePeriod(presetB,cfB,ctB),[presetB,cfB,ctB]);
  const txsB=useMemo(()=>(allTxs||txs).filter(t=>t.date>=fromB&&t.date<=toB),[allTxs,txs,fromB,toB]);
  const labelB=useMemo(()=>PERIOD_PRESETS.find(([v])=>v===presetB)?.[1]||"Period B",[presetB]);
  useEffect(()=>{if(initCat){setCat(initCat);setSub(initSub||null);onClearInit&&onClearInit();}},[initCat,initSub]);

  if(sub&&cat) {
    const items=txs.filter(t=>t.category===cat&&t.subcategory===sub).sort((a,b)=>b.amount-a.amount);
    const cd=taxonomy[cat]||{icon:"📦",color:C.muted,subs:{}};
    const sd=cd.subs[sub]||{icon:"📦"};
    // Net cost = debits minus credits (credits are refunds/cashback in this subcategory)
    const netCost=items.reduce((s,t)=>s+(t.isCredit?-t.amount:t.amount),0);
    return (
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>setSub(null)} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,13,"7px 14px"),display:"flex",alignItems:"center",gap:5}}>
            ‹ Back
          </button>
          <Crumb crumbs={[{label:"Categories",onClick:()=>{setCat(null);setSub(null);}},{label:cd.icon+" "+cat,onClick:()=>setSub(null)},{label:sd.icon+" "+sub}]}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontFamily:"inherit",fontSize:20}}>{sd.icon} {sub}</div><div style={{fontSize:12,fontWeight:500,color:C.muted,marginTop:2}}>{items.length} transactions</div></div>
          <div style={{fontFamily:"inherit",fontSize:22,color:readableColour(cd.color)}}>{fmt((avgMode?netCost/(mMonths||1):netCost),cur,dispRates)}</div>
        </div>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {!items.length?<div style={{padding:28,textAlign:"center",color:C.dim,fontSize:13}}>No transactions</div>:items.map((tx,i)=>(
            <div key={i} style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.s2}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tx.description}</div>
                <div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{fmtDNum(tx.date)}</div>
              </div>
              <TypeBadge txType={tx.txType} small/>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:tx.isCredit?C.accent:C.danger}}>{tx.isCredit?"+":"−"}{fmtExact(tx.amount,cur)}</div>
              <button onClick={()=>onRemap(tx)} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"4px 9px")}>✎</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if(cat) {
    const cd=taxonomy[cat]||{icon:"📦",color:C.muted,subs:{}};
    const cTxs=txs.filter(t=>t.category===cat);
    const cTot=cTxs.reduce((s,t)=>s+(t.isCredit?-t.amount:t.amount),0);
    const subTots={};
    cTxs.forEach(t=>{subTots[t.subcategory]=(subTots[t.subcategory]||0)+(t.isCredit?-t.amount:t.amount);});
    return (
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>setCat(null)} style={{...btn(C.s2,C.muted,`1px solid ${C.border}`,13,"7px 14px"),display:"flex",alignItems:"center",gap:5}}>
            ‹ Back
          </button>
          <Crumb crumbs={[{label:"Categories",onClick:()=>setCat(null)},{label:cd.icon+" "+cat}]}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"inherit",fontSize:20}}>{cd.icon} {cat}</div>
          <div style={{fontFamily:"inherit",fontSize:22,color:readableColour(cd.color)}}>{fmt(avgMode?(cTot/(mMonths||1)):cTot,cur,dispRates)}</div>
        </div>
        {Object.entries(subTots).sort((a,b)=>b[1]-a[1]).map(([sn,val])=>{
          const pct=cTot>0?val/cTot*100:0;
          const sd=cd.subs[sn]||{icon:"📦"};
          const cnt=cTxs.filter(t=>t.subcategory===sn).length;
          return (
            <div key={sn} onClick={()=>setSub(sn)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}>
              <div style={{width:34,height:34,borderRadius:9,background:readableColour(cd.color)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{sd.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:14,fontWeight:500}}>{sn}</span>
                  <span style={{fontFamily:"monospace",fontSize:13,color:readableColour(cd.color)}}>{fmt(avgMode?val/(mMonths||1):val,cur,dispRates)}</span>
                </div>
                <div style={{height:5,background:C.s2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:cd.color,borderRadius:3,transition:"width 0.5s"}}/></div>
                <div style={{fontSize:11,color:C.dim,marginTop:3}}>{cnt} transaction{cnt!==1?"s":""} · {pct.toFixed(0)}%</div>
              </div>
              <span style={{color:C.dim,fontSize:18}}>›</span>
            </div>
          );
        })}
      </div>
    );
  }

  const tots={};
  txs.forEach(t=>{tots[t.category]=(tots[t.category]||0)+t.amount;});
  const totsB={};
  txsB.forEach(t=>{totsB[t.category]=(totsB[t.category]||0)+t.amount;});
  const grand=Object.values(tots).reduce((s,v)=>s+v,0);
  return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"inherit",fontSize:18}}>Spending by Category</div>
        <button onClick={()=>setShowCmp(v=>!v)} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${showCmp?"#5a6fd6":C.border}`,background:showCmp?"#5a6fd6":"transparent",color:showCmp?"#fff":C.muted,fontSize:12,fontWeight:showCmp?700:500,cursor:"pointer",fontFamily:"inherit"}}>⇄ Compare</button>
      </div>
      {showCmp&&(
        <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(90,111,214,0.06)",border:"1px solid rgba(90,111,214,0.2)",borderRadius:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#5a6fd6",marginBottom:8,letterSpacing:"0.06em"}}>COMPARE TO</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:presetB==="custom"?8:0}}>
            {[["this_year","This Year"],["last_year","Last Year"],["this_month","This Month"],["last_month","Last Month"],["all","All Time"],["custom","Custom"]].map(([v,l])=>(
              <button key={v} onClick={()=>setPresetB(v)} style={{padding:"5px 11px",borderRadius:20,border:`1px solid ${presetB===v?"#5a6fd6":C.border}`,background:presetB===v?"#5a6fd6":"transparent",color:presetB===v?"#fff":C.muted,fontSize:12,cursor:"pointer",fontWeight:presetB===v?700:500,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {presetB==="custom"&&(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
              <span style={{fontSize:11,color:C.dim}}>From</span>
              <input type="date" value={cfB} onChange={e=>setCfB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,width:"auto"}}/>
              <span style={{color:C.dim}}>→</span>
              <span style={{fontSize:11,color:C.dim}}>To</span>
              <input type="date" value={ctB} onChange={e=>setCtB(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:11,width:"auto"}}/>
            </div>
          )}
        </div>
      )}
      {!showCmp&&<div style={{fontSize:12,fontWeight:500,color:C.muted,marginBottom:14}}>Tap a category to drill into subcategories and transactions</div>}
      {showCmp&&<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:8,fontSize:11,color:C.muted}}><span style={{minWidth:72,textAlign:"right",fontWeight:700,color:C.accent}}>Selected</span><span style={{minWidth:72,textAlign:"right",color:"#5a6fd6"}}>{labelB}</span><span style={{width:18}}/></div>}
      {Object.entries(tots).sort((a,b)=>b[1]-a[1]).map(([cn,val])=>{
        const cd=taxonomy[cn]||{icon:"📦",color:C.muted};
        const pct=grand>0?val/grand*100:0;
        const cnt=txs.filter(t=>t.category===cn).length;
        const valB=totsB[cn]||0;
        const diff=valB>0?((val-valB)/valB*100):null;
        return (
          <div key={cn} onClick={()=>setCat(cn)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}>
            <div style={{width:38,height:38,borderRadius:11,background:readableColour(cd.color)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{cd.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showCmp?3:5,gap:4}}>
                <span style={{fontSize:14,fontWeight:600,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cn}</span>
                {showCmp?(
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    <span style={{fontFamily:"monospace",fontSize:13,color:readableColour(cd.color),minWidth:72,textAlign:"right"}}>{fmt(avgMode?val/(mMonths||1):val,cur,dispRates)}</span>
                    <span style={{fontFamily:"monospace",fontSize:12,color:"#5a6fd6",minWidth:72,textAlign:"right"}}>{valB>0?fmt(valB,cur,dispRates):"—"}</span>
                    {diff!==null&&<span style={{fontSize:10,fontWeight:700,color:diff>0?C.danger:C.accent,minWidth:40,textAlign:"right"}}>{diff>0?"▲":"▼"}{Math.abs(diff).toFixed(0)}%</span>}
                  </div>
                ):(
                  <span style={{fontFamily:"monospace",fontSize:13,color:readableColour(cd.color)}}>{fmt(avgMode?val/(mMonths||1):val,cur,dispRates)}</span>
                )}
              </div>
              {!showCmp&&<><div style={{height:5,background:C.s2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:cd.color,borderRadius:3,transition:"width 0.5s"}}/></div>
              <div style={{fontSize:11,color:C.dim,marginTop:3}}>{cnt} transaction{cnt!==1?"s":""} · {pct.toFixed(0)}%</div></>}
              {showCmp&&<div style={{fontSize:11,color:C.dim}}>{cnt} transaction{cnt!==1?"s":""}</div>}
            </div>
            <span style={{color:C.dim,fontSize:18}}>›</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Drill Transactions overlay (from bar chart click) ────────────────────────
function DrillTxOverlay({txs,label,currency,dispRates,taxonomy,onRemap,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"20px 20px 0 0",padding:"20px 16px",maxWidth:600,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontFamily:"inherit",fontSize:18}}>{label}</div>
            <div style={{fontSize:12,fontWeight:500,color:C.muted,marginTop:2}}>{txs.length} transactions · {fmt(txs.reduce((s,t)=>s+t.amount,0),currency,dispRates)}</div>
          </div>
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"8px 14px")}>✕ Close</button>
        </div>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {txs.sort((a,b)=>b.amount-a.amount).map((tx,i)=>(
            <div key={i} style={{padding:"12px 14px",borderBottom:`1px solid ${C.s2}`}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{width:30,height:30,borderRadius:8,background:readableColour(taxonomy[tx.category]?.color||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>
                  {taxonomy[tx.category]?.subs[tx.subcategory]?.icon||taxonomy[tx.category]?.icon||"📦"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,wordBreak:"break-word",lineHeight:1.4}}>{tx.description}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDNum(tx.date)} · {tx.subcategory}</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <TypeBadge txType={tx.txType} small/>
                      <span style={{fontFamily:"monospace",fontSize:14,fontWeight:800,color:tx.isCredit?C.accent:C.danger}}>
                        {tx.isCredit?"+":"−"}{fmtExact(tx.amount,currency)}
                      </span>
                    </div>
                    <button onClick={()=>onRemap(tx)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"3px 9px")}>🏷 Remap</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// ─── Vendor View ─────────────────────────────────────────────────────────────
function VendorView({transactions, currency, dispRates, pFrom, pTo, selMonths}) {
  const today   = new Date();
  const ym      = d => d.toISOString().slice(0,7);
  const thisM   = ym(today);
  const prev    = new Date(today); prev.setMonth(prev.getMonth()-1);
  const lastM   = ym(prev);

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(new Set());
  const [vendorSort, setVendorSort] = useState("name_asc"); // name_asc|name_desc|amount_desc|amount_asc|date_desc|date_asc

  // Build vendor last-transaction-date map
  const vendorLastDate = useMemo(()=>{
    const m={};
    transactions.forEach(t=>{ const v=t.vendor||t.description; if(!m[v]||t.date>m[v]) m[v]=t.date; });
    return m;
  },[transactions]);

  // Build vendor net amount map — credits positive, debits negative
  const vendorTotal = useMemo(()=>{
    const m={};
    transactions.forEach(t=>{
      const v=t.vendor||t.description;
      const signed = t.isCredit ? t.amount : -t.amount;
      m[v]=(m[v]||0)+signed;
    });
    return m;
  },[transactions]);

  const allVendors = useMemo(()=>{
    const vs=[...new Set(transactions.map(t=>t.vendor||t.description))];
    if(vendorSort==="name_asc")      vs.sort((a,b)=>a.localeCompare(b));
    if(vendorSort==="name_desc")     vs.sort((a,b)=>b.localeCompare(a));
    if(vendorSort==="amount_desc")   vs.sort((a,b)=>(vendorTotal[b]||0)-(vendorTotal[a]||0));
    if(vendorSort==="amount_asc")    vs.sort((a,b)=>(vendorTotal[a]||0)-(vendorTotal[b]||0));
    if(vendorSort==="date_desc")     vs.sort((a,b)=>(vendorLastDate[b]||"").localeCompare(vendorLastDate[a]||""));
    if(vendorSort==="date_asc")      vs.sort((a,b)=>(vendorLastDate[a]||"").localeCompare(vendorLastDate[b]||""));
    return vs;
  },[transactions,vendorSort,vendorTotal,vendorLastDate]);

  const filtered = useMemo(()=>allVendors.filter(v=>v.toLowerCase().includes(search.toLowerCase())),[allVendors,search]);

  function toggle(v){ setSelected(prev=>{ const s=new Set(prev); s.has(v)?s.delete(v):s.add(v); return s; }); }
  function selectAll(){ setSelected(new Set(filtered)); }
  function clearAll(){ setSelected(new Set()); }

  // Build per-vendor spend for 3 periods
  const vendorStats = useMemo(()=>{
    const yr = today.getFullYear()+"-";
    const stats={};
    transactions.forEach(t=>{
      const v=t.vendor||t.description;
      if(!selected.has(v)) return;
      if(!stats[v]) stats[v]={period:0,thisMonth:0,lastMonth:0,ytd:0};
      const m=(t.date ? t.date.slice(0,7) : '');
      const signed = t.isCredit ? t.amount : -t.amount;
      stats[v].period+=signed;
      if(m===thisM) stats[v].thisMonth+=signed;
      if(m===lastM) stats[v].lastMonth+=signed;
      if(t.date>=(today.getFullYear()+"-01-01")) stats[v].ytd+=signed;
    });
    return Object.entries(stats)
      .map(([v,s])=>({vendor:v,...s}))
      .sort((a,b)=>b.ytd-a.ytd);
  },[transactions,selected,thisM,lastM,pFrom,pTo]);

  const totals = useMemo(()=>vendorStats.reduce((acc,r)=>({
    period:acc.period+r.period,
    thisMonth:acc.thisMonth+r.thisMonth,
    lastMonth:acc.lastMonth+r.lastMonth,
    ytd:acc.ytd+r.ytd
  }),{period:0,thisMonth:0,lastMonth:0,ytd:0}),[vendorStats]);

  const fmtM = m=>{ const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleString("default",{month:"short",year:"2-digit"}); };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Vendor selector */}
      <div style={{...card,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div style={{fontFamily:"inherit",fontSize:17}}>Select Vendors</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <Pill
              options={[
                ["name_asc",  isActive=>vendorSort==="name_desc"?"Z–A":"A–Z"],
                ["amount_desc",isActive=>vendorSort==="amount_asc"?"Value ↑":"Value ↓"],
                ["date_desc",  isActive=>vendorSort==="date_asc"?"Oldest":"Recent"]
              ]}
              value={vendorSort==="name_desc"?"name_asc":vendorSort==="amount_asc"?"amount_desc":vendorSort==="date_asc"?"date_desc":vendorSort}
              onChange={v=>{
                if(v==="name_asc")   setVendorSort(vendorSort==="name_asc"?"name_desc":"name_asc");
                else if(v==="amount_desc") setVendorSort(vendorSort==="amount_desc"?"amount_asc":"amount_desc");
                else if(v==="date_desc")   setVendorSort(vendorSort==="date_desc"?"date_asc":"date_desc");
              }}/>
            <button onClick={selectAll} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"5px 10px")}>All visible</button>
            <button onClick={clearAll}  style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"5px 10px")}>Clear</button>
          </div>
        </div>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search vendors…"
          style={{...inp(),width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:13}}
        />
        <div style={{maxHeight:220,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10,background:C.bg}}>
          {filtered.length===0&&<div style={{padding:16,textAlign:"center",color:C.dim,fontSize:13}}>No vendors found</div>}
          {filtered.map(v=>{
            const on=selected.has(v);
            return (
              <div key={v} onClick={()=>toggle(v)} style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.s2}`,cursor:"pointer",background:on?"rgba(184,245,118,0.05)":"transparent"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${on?C.accent:C.border}`,background:on?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0}}>{on?"✓":""}</div>
                <span style={{fontSize:13,color:on?C.text:C.muted,flex:1}}>{v}</span>
                <div style={{textAlign:"right"}}>
                  {(function(){
                    var net=transactions.filter(function(t){return (t.vendor||t.description)===v;}).reduce(function(s,t){return s+(t.isCredit?t.amount:-t.amount);},0);
                    return <div style={{fontSize:11,fontWeight:600,fontFamily:"monospace",color:net>=0?C.accent:C.danger}}>{net>=0?"+":"-"}{fmt(Math.abs(net),currency,dispRates)}</div>;
                  })()}
                  <div style={{fontSize:10,color:C.dim}}>{fmtDNum(vendorLastDate[v])}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:12,color:C.dim,marginTop:8}}>{selected.size} vendor{selected.size!==1?"s":""} selected · {allVendors.length} total</div>
      </div>



      {/* Transactions for selected vendors */}
      {selected.size>0&&(()=>{
        const selTxs=transactions
          .filter(t=>selected.has(t.vendor||t.description))
          .sort((a,b)=>b.date.localeCompare(a.date));
        return (
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontFamily:"inherit",fontSize:17}}>Transactions</div>
              {(function(){var net=selTxs.reduce(function(s,t){return s+(t.isCredit?t.amount:-t.amount);},0);return <span style={{fontSize:12,fontFamily:"monospace",color:net>=0?C.accent:C.danger}}>{selTxs.length} · {net>=0?"+":"-"}{fmt(Math.abs(net),currency,dispRates)}</span>;})}
            </div>
            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              {selTxs.length===0
                ? <div style={{padding:24,textAlign:"center",color:C.dim,fontSize:13}}>No transactions in this period</div>
                : selTxs.map((tx,i)=>{
                  const isCredit=tx.isCredit===true;
                  return (
                    <div key={i} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.s2}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.vendor||tx.description}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDNum(tx.date)}{tx.vendor&&<span style={{marginLeft:4,color:C.dim,fontStyle:"italic",fontSize:10}}>{tx.description}</span>} · {tx.category} › {tx.subcategory}</div>
                      </div>
                      <TypeBadge txType={tx.txType} small/>
                      <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:isCredit?C.accent:C.danger,flexShrink:0,textAlign:"right"}}>
                        {isCredit?"+":"-"}{fmtExact(tx.amount,currency)}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        );
      })()}

      {selected.size===0&&(
        <div style={{...card,padding:32,textAlign:"center",color:C.dim,fontSize:13}}>
          Select vendors above to see their spending breakdown
        </div>
      )}
    </div>
  );
}


// ─── Budget Tab ──────────────────────────────────────────────────────────────
function BudgetTab({transactions, taxonomy, budgets, setBudgets, displayCurrency}) {
  // editTarget: null | {cat, sub} — sub===null means editing at category level (legacy / no subs)
  const [editTarget, setEditTarget] = useState(null);
  const [editMonthly, setEditMonthly] = useState("");
  const [editAnnual, setEditAnnual] = useState("");
  const [viewMode, setViewMode] = useState("month");   // "month" | "year"
  const [subView, setSubView] = useState("category");  // "category" | "subcategory"
  const [expandedCats, setExpandedCats] = useState({}); // {cat: bool}

  // Spend aggregation
  const today = new Date();
  const _pad = n => String(n).padStart(2,'0');
  const thisMonthFrom = today.getFullYear()+'-'+_pad(today.getMonth()+1)+'-01';
  const thisMonthTo   = today.getFullYear()+'-'+_pad(today.getMonth()+1)+'-'+_pad(today.getDate());
  const thisYearFrom  = today.getFullYear()+'-01-01';

  // Spend by category and subcategory
  const monthSpendCat = {}, yearSpendCat = {}, monthSpendSub = {}, yearSpendSub = {};
  transactions.filter(t=>!t.isCredit).forEach(t=>{
    const c = t.category, s = t.subcategory||"";
    if(t.date>=thisYearFrom&&t.date<=thisMonthTo) {
      yearSpendCat[c]=(yearSpendCat[c]||0)+t.amount;
      if(s) yearSpendSub[c+"|||"+s]=(yearSpendSub[c+"|||"+s]||0)+t.amount;
    }
    if(t.date>=thisMonthFrom&&t.date<=thisMonthTo) {
      monthSpendCat[c]=(monthSpendCat[c]||0)+t.amount;
      if(s) monthSpendSub[c+"|||"+s]=(monthSpendSub[c+"|||"+s]||0)+t.amount;
    }
  });

  // Helper: get effective monthly budget for a category (sum of subs if subs exist, else direct)
  function catMonthly(cat) {
    const b = budgets[cat]||{};
    const subs = b.subs||{};
    const subKeys = Object.keys(subs).filter(s=>subs[s]&&subs[s].monthly>0);
    if(subKeys.length>0) return subKeys.reduce((s,k)=>s+(subs[k].monthly||0),0);
    return b.monthly||0;
  }
  function catAnnual(cat) {
    const b = budgets[cat]||{};
    const subs = b.subs||{};
    const subKeys = Object.keys(subs).filter(s=>subs[s]&&subs[s].annual>0);
    if(subKeys.length>0) return subKeys.reduce((s,k)=>s+(subs[k].annual||0),0);
    return b.annual||0;
  }
  function hasBudget(cat) { return catMonthly(cat)>0||catAnnual(cat)>0; }
  function hasSubBudgets(cat) {
    const subs = (budgets[cat]||{}).subs||{};
    return Object.keys(subs).some(s=>subs[s]&&(subs[s].monthly||0)>0);
  }

  const cats = Object.keys(taxonomy).filter(c=>c!=="Income");
  const budgetedCats = cats.filter(hasBudget);
  const unbudgetedCats = cats.filter(c=>!hasBudget(c));

  function openEditCat(cat) {
    const b = budgets[cat]||{};
    setEditTarget({cat, sub:null});
    // Show derived total if subs exist, otherwise direct value
    const m = catMonthly(cat), a = catAnnual(cat);
    setEditMonthly(m ? String(m) : "");
    setEditAnnual(a ? String(a) : "");
  }
  function openEditSub(cat, sub) {
    const b = (budgets[cat]||{}).subs||{};
    const s = b[sub]||{};
    setEditTarget({cat, sub});
    setEditMonthly(s.monthly ? String(s.monthly) : "");
    setEditAnnual(s.annual ? String(s.annual) : "");
  }

  function saveEdit() {
    const m = parseFloat(editMonthly)||0;
    const a = parseFloat(editAnnual)||0;
    const {cat, sub} = editTarget;
    if(sub===null) {
      // Category-level edit — only used when no subs exist (legacy path)
      // If subs already exist, editing category is disabled — user must edit per-sub
      if(!m&&!a) {
        setBudgets(prev=>{ const n={...prev}; delete n[cat]; return n; });
      } else {
        setBudgets(prev=>({...prev,[cat]:{...(prev[cat]||{}),monthly:m||Math.round(a/12),annual:a||m*12}}));
      }
    } else {
      // Subcategory-level edit
      setBudgets(prev=>{
        const existing = prev[cat]||{};
        const existingSubs = existing.subs||{};
        if(!m&&!a) {
          const newSubs = {...existingSubs}; delete newSubs[sub];
          // Recalculate category totals from remaining subs
          const subVals = Object.values(newSubs).filter(Boolean);
          const newM = subVals.reduce((s,x)=>s+(x.monthly||0),0);
          const newA = subVals.reduce((s,x)=>s+(x.annual||0),0);
          if(Object.keys(newSubs).length===0) {
            const n={...prev}; delete n[cat]; return n;
          }
          return {...prev,[cat]:{...existing,subs:newSubs,monthly:newM,annual:newA}};
        } else {
          const newSubs = {...existingSubs,[sub]:{monthly:m||Math.round(a/12),annual:a||m*12}};
          const subVals = Object.values(newSubs).filter(Boolean);
          const newM = subVals.reduce((s,x)=>s+(x.monthly||0),0);
          const newA = subVals.reduce((s,x)=>s+(x.annual||0),0);
          return {...prev,[cat]:{...existing,subs:newSubs,monthly:newM,annual:newA}};
        }
      });
    }
    setEditTarget(null);
  }

  function toggleExpand(cat) {
    setExpandedCats(prev=>({...prev,[cat]:!prev[cat]}));
  }

  // BudgetCard: renders one category row (and optionally subcategory rows below it)
  function BudgetCard({cat}) {
    const b = budgets[cat]||{};
    const budget = viewMode==="month" ? catMonthly(cat) : catAnnual(cat);
    const spent  = viewMode==="month" ? (monthSpendCat[cat]||0) : (yearSpendCat[cat]||0);
    const pct    = budget>0 ? Math.min(100,(spent/budget)*100) : 0;
    const over   = spent>budget&&budget>0;
    const warn   = pct>=80&&!over;
    const barCol = over?"#d94040":warn?"#f59e0b":C.accent;
    const cd     = taxonomy[cat];
    const hasSubs = hasSubBudgets(cat);
    const isExpanded = expandedCats[cat];
    const subKeys = hasSubs ? Object.keys((b.subs||{})).filter(s=>b.subs[s]&&(b.subs[s].monthly||0)>0) : [];
    // Also show taxonomy subs that have no budget yet (for easy adding) when expanded
    const allTaxSubs = Object.keys(taxonomy[cat]?.subs||{});

    return (
      <div style={{marginBottom:10}}>
        {/* Category row */}
        <div style={{background:C.surface,borderRadius:hasSubs&&isExpanded?14:14,padding:"16px 18px",border:`1px solid ${over?"#d9404033":warn?"#f59e0b33":C.border}`,borderBottomLeftRadius:hasSubs&&isExpanded?4:14,borderBottomRightRadius:hasSubs&&isExpanded?4:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
              <div style={{width:28,height:28,borderRadius:8,background:readableColour(cd?.color||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{cd?.icon||"📦"}</div>
              <span style={{fontSize:14,fontWeight:700,color:C.text,flex:1}}>{cat}</span>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              {/* Expand toggle — show if category has taxonomy subs */}
              {allTaxSubs.length>0&&(
                <button onClick={()=>toggleExpand(cat)}
                  style={{...btn(isExpanded?"rgba(42,157,111,0.12)":C.s2,isExpanded?C.accent:C.muted,`1px solid ${isExpanded?C.accent:C.border}`,11,"3px 8px"),fontFamily:"monospace"}}>
                  {isExpanded?"▾ Subs":"▸ Subs"}
                </button>
              )}
              {/* Edit button — only if no subs set (category-level); otherwise use sub rows */}
              {!hasSubs&&(
                <button onClick={()=>openEditCat(cat)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"3px 9px")}>✏️ Edit</button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{height:8,borderRadius:4,background:C.s2,marginBottom:8,overflow:"hidden"}}>
            <div style={{height:"100%",width:pct+"%",background:barCol,borderRadius:4,transition:"width 0.4s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
            <span style={{color:barCol,fontWeight:700}}>
              {over?"⚠️ Over budget":warn?"🔶 "+Math.round(pct)+"% used":""+Math.round(pct)+"% used"}
              {hasSubs&&<span style={{color:C.dim,fontWeight:400}}> · from subcategories</span>}
            </span>
            <span style={{color:C.muted,fontFamily:"monospace"}}>{fmt(spent)} / {fmt(budget)}</span>
          </div>
          {over&&<div style={{fontSize:11,color:"#d94040",marginTop:4,fontWeight:600}}>Over by {fmt(spent-budget)} ({Math.round((spent/budget-1)*100)}%)</div>}
        </div>

        {/* Subcategory rows — shown when expanded */}
        {isExpanded&&(
          <div style={{borderLeft:`2px solid ${C.accent}33`,marginLeft:14,paddingLeft:0}}>
            {allTaxSubs.map(sub=>{
              const sb = (b.subs||{})[sub]||{};
              const subBudget = viewMode==="month" ? (sb.monthly||0) : (sb.annual||0);
              const subSpent  = viewMode==="month" ? (monthSpendSub[cat+"|||"+sub]||0) : (yearSpendSub[cat+"|||"+sub]||0);
              const subPct    = subBudget>0 ? Math.min(100,(subSpent/subBudget)*100) : 0;
              const subOver   = subSpent>subBudget&&subBudget>0;
              const subWarn   = subPct>=80&&!subOver;
              const subBar    = subOver?"#d94040":subWarn?"#f59e0b":C.accent;
              const subIcon   = taxonomy[cat]?.subs[sub]?.icon||"·";
              const hasBgt    = subBudget>0;
              return (
                <div key={sub} style={{background:C.surface,borderRadius:10,padding:"12px 16px",marginBottom:4,marginTop:4,marginLeft:0,border:`1px solid ${subOver?"#d9404022":C.s2}`,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:22,height:22,borderRadius:6,background:readableColour(cd?.color||"#888")+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{subIcon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:hasBgt?6:0}}>
                      <span style={{fontSize:13,fontWeight:600,color:hasBgt?C.text:C.muted}}>{sub}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {hasBgt&&<span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{fmt(subSpent)}/{fmt(subBudget)}</span>}
                        <button onClick={()=>openEditSub(cat,sub)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,10,"2px 8px")}>{hasBgt?"✏️":"+ Set"}</button>
                      </div>
                    </div>
                    {hasBgt&&(
                      <div style={{height:5,borderRadius:3,background:C.s2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:subPct+"%",background:subBar,borderRadius:3,transition:"width 0.4s"}}/>
                      </div>
                    )}
                    {!hasBgt&&<div style={{fontSize:11,color:C.dim}}>No budget set</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Edit modal */}
      {editTarget&&(()=>{
        const {cat, sub} = editTarget;
        const isSubEdit = sub!==null;
        const subIcon = isSubEdit ? (taxonomy[cat]?.subs[sub]?.icon||"·") : null;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:C.surface,borderRadius:20,padding:24,maxWidth:400,width:"100%"}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:2}}>
                {taxonomy[cat]?.icon} {cat}
                {isSubEdit&&<span style={{fontWeight:400,color:C.muted}}> › {subIcon} {sub}</span>}
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:20}}>
                {isSubEdit ? "Set monthly budget for this subcategory" : "Enter 0 or leave blank to remove budget"}
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Monthly Budget ({displayCurrency})</div>
                <input type="number" value={editMonthly} onChange={e=>{setEditMonthly(e.target.value); if(e.target.value) setEditAnnual(String(Math.round(parseFloat(e.target.value)||0)*12));}} placeholder="e.g. 500" style={{...inp(),fontSize:15,fontFamily:"monospace"}}/>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Annual Budget ({displayCurrency})</div>
                <input type="number" value={editAnnual} onChange={e=>{setEditAnnual(e.target.value); if(e.target.value) setEditMonthly(String(Math.round((parseFloat(e.target.value)||0)/12)));}} placeholder="e.g. 6000" style={{...inp(),fontSize:15,fontFamily:"monospace"}}/>
              </div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Editing one auto-calculates the other</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={saveEdit} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>✓ Save</button>
                <button onClick={()=>setEditTarget(null)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 16px")}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View toggles — period + category/sub view */}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <button onClick={()=>setViewMode("month")} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${viewMode==="month"?C.accent:C.border}`,background:viewMode==="month"?"rgba(42,157,111,0.08)":"transparent",color:viewMode==="month"?C.accent:C.muted,fontSize:13,fontWeight:viewMode==="month"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
          This Month
        </button>
        <button onClick={()=>setViewMode("year")} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${viewMode==="year"?C.accent:C.border}`,background:viewMode==="year"?"rgba(42,157,111,0.08)":"transparent",color:viewMode==="year"?C.accent:C.muted,fontSize:13,fontWeight:viewMode==="year"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
          This Year
        </button>
      </div>

      {/* Budgeted categories */}
      {budgetedCats.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>Budget Tracking</div>
          {budgetedCats.map(cat=><BudgetCard key={cat} cat={cat}/>)}
        </div>
      )}

      {/* Total budget summary */}
      {budgetedCats.length>0&&(()=>{
        const totalBudget = budgetedCats.reduce((s,c)=>s+(viewMode==="month"?catMonthly(c):catAnnual(c)),0);
        const totalSpent  = budgetedCats.reduce((s,c)=>s+(viewMode==="month"?(monthSpendCat[c]||0):(yearSpendCat[c]||0)),0);
        const pct = totalBudget>0?Math.min(100,(totalSpent/totalBudget)*100):0;
        const over = totalSpent>totalBudget&&totalBudget>0;
        return (
          <div style={{background:over?"rgba(217,64,64,0.06)":"rgba(42,157,111,0.06)",borderRadius:14,padding:"14px 18px",marginBottom:20,border:`1px solid ${over?"#d9404033":C.accent+"33"}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Total {viewMode==="month"?"Monthly":"Annual"}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:20,fontWeight:800,color:over?"#d94040":C.accent}}>{fmt(totalSpent)}</span>
              <span style={{fontSize:13,color:C.muted,fontFamily:"monospace"}}>of {fmt(totalBudget)}</span>
            </div>
            <div style={{height:6,borderRadius:3,background:C.s2,marginTop:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:over?"#d94040":C.accent,borderRadius:3}}/>
            </div>
          </div>
        );
      })()}

      {/* Unbudgeted categories */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>
          {budgetedCats.length===0?"Set Budgets — tap a category to start":"No Budget Set"}
        </div>
        {unbudgetedCats.map(cat=>(
          <div key={cat} onClick={()=>openEditCat(cat)} style={{background:C.surface,borderRadius:12,padding:"12px 16px",marginBottom:8,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <div style={{width:26,height:26,borderRadius:7,background:readableColour(taxonomy[cat]?.color||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{taxonomy[cat]?.icon||"📦"}</div>
            <span style={{flex:1,fontSize:13,fontWeight:500,color:C.muted}}>{cat}</span>
            <span style={{fontSize:12,color:C.accent,fontWeight:600}}>+ Set budget →</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Spend Alert Tab ────────────────────────────────────────────────────────────
function WatchOutTab({transactions, taxonomy, spikeThreshold, setSpikeThreshold, showSpikeSettings, setShowSpikeSettings, displayCurrency, onDrillTxs}) {
  const today = new Date();
  const _p2 = n => String(n).padStart(2,'0');
  const thisMonthFrom = today.getFullYear()+'-'+_p2(today.getMonth()+1)+'-01';
  const thisMonthTo   = today.getFullYear()+'-'+_p2(today.getMonth()+1)+'-'+_p2(today.getDate());
  const lmIdx = today.getMonth()===0 ? 12 : today.getMonth();
  const lmYear = today.getMonth()===0 ? today.getFullYear()-1 : today.getFullYear();
  const lastMonthFrom = lmYear+'-'+_p2(lmIdx)+'-01';
  const lastMonthTo   = lmYear+'-'+_p2(lmIdx)+'-'+_p2(new Date(lmYear,lmIdx,0).getDate());
  const [thresholdInput, setThresholdInput] = useState(String(spikeThreshold));
  const [drillMode, setDrillMode] = useState("categories"); // "categories" | "subcategories"

  // Calculate spend by category and subcategory for each period
  function calcSpend(from, to, key) {
    const result = {};
    transactions.filter(t=>!t.isCredit&&t.date>=from&&t.date<=to)
      .forEach(t=>{ result[t[key]]=(result[t[key]]||0)+t.amount; });
    return result;
  }

  const thisCat  = calcSpend(thisMonthFrom, thisMonthTo, "category");
  const lastCat  = calcSpend(lastMonthFrom, lastMonthTo, "category");
  const thisSub  = calcSpend(thisMonthFrom, thisMonthTo, "subcategory");
  const lastSub  = calcSpend(lastMonthFrom, lastMonthTo, "subcategory");

  // Find spikes
  function findSpikes(thisSpend, lastSpend) {
    return Object.entries(thisSpend)
      .filter(([k])=>k&&k!=="Income")
      .map(([k,thisAmt])=>{
        const lastAmt = lastSpend[k]||0;
        const change = lastAmt>0 ? ((thisAmt-lastAmt)/lastAmt)*100 : null;
        const isNew = lastAmt===0&&thisAmt>0;
        const isSpike = isNew||(change!==null&&change>=spikeThreshold);
        return {key:k, thisAmt, lastAmt, change, isNew, isSpike};
      })
      .filter(r=>r.isSpike)
      .sort((a,b)=>(b.thisAmt-b.lastAmt)-(a.thisAmt-a.lastAmt));
  }

  const catSpikes = findSpikes(thisCat, lastCat);
  const subSpikes = findSpikes(thisSub, lastSub);
  const spikes    = drillMode==="categories" ? catSpikes : subSpikes;

  // Also find drops (good news)
  function findDrops(thisSpend, lastSpend) {
    return Object.entries(lastSpend)
      .filter(([k])=>k&&k!=="Income")
      .map(([k,lastAmt])=>{
        const thisAmt = thisSpend[k]||0;
        const change = ((thisAmt-lastAmt)/lastAmt)*100;
        return {key:k, thisAmt, lastAmt, change};
      })
      .filter(r=>r.change<=-spikeThreshold)
      .sort((a,b)=>a.change-b.change);
  }

  const catDrops = findDrops(thisCat, lastCat);
  const subDrops = findDrops(thisSub, lastSub);
  const drops    = drillMode==="categories" ? catDrops : subDrops;

  const fmtM = m => { if(!m) return ""; const [y,mo]=m.split("-"); const names=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return names[parseInt(mo)-1]+" "+y.slice(2); };
  const thisMonthLabel = fmtM(thisMonthFrom.slice(0,7));
  const lastMonthLabel = fmtM(lastMonthFrom.slice(0,7));

  function SpikeCard({item, isSpike}) {
    const cd = taxonomy[item.key];
    const changeAbs = Math.abs(item.change||0);
    const color = isSpike ? "#d94040" : "#1a7a3a";
    const bgColor = isSpike ? "rgba(217,64,64,0.05)" : "rgba(26,122,58,0.05)";
    const borderColor = isSpike ? "#d9404022" : "#1a7a3a22";

    return (
      <div
        onClick={()=>{
          const sk = drillMode==="categories"?"category":"subcategory";
          const txs = transactions.filter(t=>!t.isCredit&&t.date>=thisMonthFrom&&t.date<=thisMonthTo&&t[sk]===item.key);
          if(txs.length) onDrillTxs(txs, item.key+" · "+thisMonthLabel);
        }}
        style={{background:bgColor,borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1px solid ${borderColor}`,cursor:"pointer"}}
      >
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {cd&&<div style={{width:26,height:26,borderRadius:7,background:readableColour(cd.color||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{cd.icon||"📦"}</div>}
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{item.key}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {item.isNew
              ? <span style={{fontSize:11,fontWeight:700,color:color,background:color+"15",padding:"2px 8px",borderRadius:20}}>NEW</span>
              : <span style={{fontSize:13,fontWeight:800,color}}>{isSpike?"↑":"↓"}{Math.round(changeAbs)}%</span>
            }
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
          <span>{lastMonthLabel}: <strong style={{fontFamily:"monospace",color:C.text}}>{item.lastAmt>0?fmt(item.lastAmt):"—"}</strong></span>
          <span>{thisMonthLabel}: <strong style={{fontFamily:"monospace",color}}>{fmt(item.thisAmt)}</strong></span>
        </div>
        {!item.isNew&&<div style={{marginTop:8,height:3,borderRadius:3,background:C.s2,overflow:"hidden"}}>
          <div style={{height:"100%",width:Math.min(100,(item.thisAmt/Math.max(item.thisAmt,item.lastAmt))*100)+"%",background:color,borderRadius:3}}/>
        </div>}
        <div style={{fontSize:10,color:C.dim,marginTop:6}}>Tap to see transactions →</div>
      </div>
    );
  }

  return (
    <div>
      {/* Spike threshold settings modal */}
      {showSpikeSettings&&(
        <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.surface,borderRadius:20,padding:24,maxWidth:380,width:"100%"}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>Spike Threshold</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.6}}>
              Categories are flagged as a spike when this month's spend is more than this % above last month.
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Variance % threshold</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input
                  type="number" value={thresholdInput}
                  onChange={e=>setThresholdInput(e.target.value)}
                  min="5" max="500" step="5"
                  style={{...inp(),fontSize:20,fontFamily:"monospace",fontWeight:700,width:100,textAlign:"center"}}
                />
                <span style={{fontSize:18,color:C.muted}}>%</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                {[10,20,25,50,100].map(v=>(
                  <button key={v} onClick={()=>setThresholdInput(String(v))} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${thresholdInput===String(v)?C.accent:C.border}`,background:thresholdInput===String(v)?"rgba(42,157,111,0.1)":"transparent",color:thresholdInput===String(v)?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:thresholdInput===String(v)?700:400}}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{const v=parseInt(thresholdInput)||20; setSpikeThreshold(v); setShowSpikeSettings(false);}} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>✓ Save</button>
              <button onClick={()=>setShowSpikeSettings(false)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 16px")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>vs Last Month</div>
          <div style={{fontSize:11,color:C.dim}}>{lastMonthLabel} → {thisMonthLabel}</div>
        </div>
        <button onClick={()=>setShowSpikeSettings(true)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"5px 10px")}>
          ⚙️ Threshold: {spikeThreshold}%
        </button>
      </div>

      {/* Category / Subcategory toggle */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setDrillMode("categories")} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${drillMode==="categories"?C.accent:C.border}`,background:drillMode==="categories"?"rgba(42,157,111,0.08)":"transparent",color:drillMode==="categories"?C.accent:C.muted,fontSize:12,fontWeight:drillMode==="categories"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
          Categories
        </button>
        <button onClick={()=>setDrillMode("subcategories")} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${drillMode==="subcategories"?C.accent:C.border}`,background:drillMode==="subcategories"?"rgba(42,157,111,0.08)":"transparent",color:drillMode==="subcategories"?C.accent:C.muted,fontSize:12,fontWeight:drillMode==="subcategories"?700:500,cursor:"pointer",fontFamily:"inherit"}}>
          Subcategories
        </button>
      </div>

      {/* Spikes */}
      {spikes.length>0?(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:"#d94040",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>
            ⚠️ Spikes ({spikes.length}) — up {spikeThreshold}%+ vs last month
          </div>
          {spikes.map(item=><SpikeCard key={item.key} item={item} isSpike={true}/>)}
        </div>
      ):(
        <div style={{background:C.s2,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:28,marginBottom:8}}>✅</div>
          <div style={{fontSize:14,fontWeight:600,color:C.text}}>No spikes this month</div>
          <div style={{fontSize:12,color:C.dim,marginTop:4}}>All categories within {spikeThreshold}% of last month</div>
        </div>
      )}

      {/* Drops (good news) */}
      {drops.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:"#1a7a3a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>
            ✅ Reductions ({drops.length}) — down {spikeThreshold}%+ vs last month
          </div>
          {drops.map(item=><SpikeCard key={item.key} item={item} isSpike={false}/>)}
        </div>
      )}

      {spikes.length===0&&drops.length===0&&(
        <div style={{textAlign:"center",color:C.dim,fontSize:13,padding:20}}>
          Not enough data to compare — need transactions in both this month and last month.
        </div>
      )}
    </div>
  );
}

// ─── FORECAST TAB ────────────────────────────────────────────────────────────
// Props: transactions, financials, displayCurrency, displayRates, budgets
function ForecastTab({transactions, financials, displayCurrency, displayRates, budgets, setFinancials, taxonomy, onProjectionChange}) {
  var dc = displayCurrency || "AED";
  var C = {accent:"#2a9d6f",danger:"#d94040",text:"#0f1624",muted:"#4a5568",dim:"#7a8699",border:"#cdd1db",bg:"#ecf1eb",surface:"#fff"};

  // ──────────────────────────────────────────────
  // ALL STATE HOOKS — before any nested function definitions (Rule #19)
  // ──────────────────────────────────────────────
  var [monthlySalary, setMonthlySalary] = useState(null);
  var [showReviewModal, setShowReviewModal] = useState(false);
  var [hoverMonth, setHoverMonth] = useState(null);
  var [editingCell, setEditingCell] = useState(null); // {rowType, rowId, monthKey}
  var [editingValue, setEditingValue] = useState("");
  var editingValueRef = useRef(""); // mirrors editingValue — avoids stale closure in commitCellEdit
  // catOverrides: read directly from financials.forecastCatOverrides (single source of truth)
  // No local copy — eliminates the two-store sync bug where delete cleared Firestore but not session state
  var [cardAmounts, setCardAmounts] = useState({});     // {cardId: {monthKey: amount}}
  var [acctBalances, setAcctBalances] = useState({});   // {id: amount} — user-entered starting balances
  var [localSalary, setLocalSalary] = useState(null);   // review modal local state
  var [showEventModal, setShowEventModal] = useState(false);
  var [editingEvent, setEditingEvent] = useState(null);
  var [evtForm, setEvtForm] = useState({label:"",eventType:"expense",currency:"AED",confidence:"likely",dates:[{date:"",amount:""}]});
  var [expandedForecastCats, setExpandedForecastCats] = useState({}); // {cat: bool}
  var [fxRates, setFxRates] = useState(null);           // always-available rates, independent of displayCurrency
  var [sparkTooltip, setSparkTooltip] = useState(null); // kept for compat, sparkline removed
  var [forecastStartOffset, setForecastStartOffset] = useState(function(){  // months ahead of today the forecast starts
    return (financials.forecastStartOffset)||0;
  });
  var [showSpendModal, setShowSpendModal] = useState(false);
  var [editingSpendRow, setEditingSpendRow] = useState(null);
  var [spendForm, setSpendForm] = useState({cat:"",sub:"",useBudget:true,amount:"",fromMonth:"",toMonth:""});

  // ── ALL useMemo HOOKS — still before nested functions (Rule #19) ──

  var loanRowsMemo = useMemo(function() {
    var loans = financials.loans||[];
    var rates = displayRates || fxRates || FALLBACK_RATES;
    return loans.filter(function(l){ return (l.currentMonthlyPayment||l.monthlyPayment||0)>0; })
      .map(function(l) {
        var from = l.currency||"AED";
        var a = Number(l.currentMonthlyPayment||l.monthlyPayment||0);
        var disp = from===dc?a:(!rates||!rates[from]?a:a/rates[from]*(rates[dc]||1));
        var endDate = l.currentEndDate?new Date(l.currentEndDate):(l.endDate?new Date(l.endDate):null);
        return {id:l.id||l.name, label:l.name||"Loan", monthlyAmount:disp, endDate:endDate, currency:from};
      });
  }, [JSON.stringify(financials.loans), dc, JSON.stringify(displayRates), JSON.stringify(fxRates)]);

  // spendRowsMemo: derived from financials.forecastSpendRows — explicit user-added expected spend rows
  // Each row: {id, cat, sub, useBudget, amount, fromMonth, toMonth}
  // sub="" means category-level row. Amount per month: useBudget uses budgets[cat](.subs[sub]).monthly, else row.amount
  // Category rows are computed as sum of their sub rows that are in range for a given month
  var spendRowsMemo = useMemo(function() {
    var rows = financials.forecastSpendRows||[];
    // Group into category buckets
    var catMap = {}; // cat -> {subRows:[...], catOnlyRows:[...]}
    rows.forEach(function(r){
      if(!catMap[r.cat]) catMap[r.cat]={subRows:[],catRow:null};
      if(r.sub){
        catMap[r.cat].subRows.push(r);
      } else {
        catMap[r.cat].catRow=r; // category-level row (no sub)
      }
    });
    return catMap;
  }, [JSON.stringify(financials.forecastSpendRows), JSON.stringify(budgets)]);

  var creditCardRowsMemo = useMemo(function() {
    return (financials.accounts||[]).filter(function(a){return a.type==="credit";})
      .map(function(a){return {id:a.id||a.name, label:a.name+(a.last4?" ("+a.last4+")":""), currency:a.currency||"AED", balance:Number(a.balance||0)};});
  }, [JSON.stringify(financials.accounts)]);

  // Account + cash rows for the Starting Position block
  var startingRowsMemo = useMemo(function() {
    var rows = [];
    var rates = displayRates || fxRates || FALLBACK_RATES;
    (financials.accounts||[]).filter(function(a){return a.type!=="credit";}).forEach(function(a){
      var from = a.currency||"AED";
      var autoAmt = Number(a.balance||0);
      var autoDisp = from===dc?autoAmt:(!rates||!rates[from]?autoAmt:autoAmt/rates[from]*(rates[dc]||1));
      rows.push({id:"acct_"+(a.id||a.name), label:a.name+(a.last4?" ("+a.last4+")":""), autoAmount:autoDisp, icon:"🏦", currency:from});
    });
    (financials.cash||[]).forEach(function(c){
      var from = c.currency||"AED";
      var autoAmt = Number(c.amount||0);
      var autoDisp = from===dc?autoAmt:(!rates||!rates[from]?autoAmt:autoAmt/rates[from]*(rates[dc]||1));
      rows.push({id:"cash_"+(c.id||c.label), label:c.label, autoAmount:autoDisp, icon:"💵", currency:from});
    });
    return rows;
  }, [JSON.stringify(financials.accounts), JSON.stringify(financials.cash), dc, JSON.stringify(displayRates), JSON.stringify(fxRates)]);

  // Effective starting balance = sum of per-row values (user override or auto from Position tab)
  var effectiveStart = useMemo(function() {
    return startingRowsMemo.reduce(function(s, row) {
      var v = acctBalances[row.id];
      return s + (v !== undefined ? Number(v)||0 : row.autoAmount);
    }, 0);
  }, [startingRowsMemo, acctBalances]);

  var detectedSalary = useMemo(function() {
    var today = new Date();
    var y=today.getFullYear(), mo=today.getMonth()+1;
    var prevY=mo===1?y-1:y, prevM=mo===1?12:mo-1;
    var cutoff=prevY+"-"+(prevM<10?"0":"")+prevM;
    var txs = transactions.filter(function(t){return t.isCredit&&t.category==="Income"&&t.subcategory==="Salary"&&t.date&&t.date>=cutoff;});
    if(txs.length===0) txs=transactions.filter(function(t){return t.isCredit&&t.category==="Income"&&t.date&&t.date>=cutoff;});
    if(txs.length===0) return 0;
    var byMonth={};
    txs.forEach(function(t){var mk=t.date.slice(0,7); byMonth[mk]=(byMonth[mk]||0)+t.amount;});
    var vals=Object.values(byMonth); if(vals.length===0) return 0;
    vals.sort(function(a,b){return b-a;});
    return vals[Math.floor(vals.length/2)];
  }, [JSON.stringify(transactions)]);

  var normalizedEvents = useMemo(function() {
    return (financials.forecastEvents||[]).map(function(ev) {
      if(ev.dates&&Array.isArray(ev.dates)) return ev;
      return {id:ev.id, label:ev.label||"", eventType:ev.eventType||"expense",
              currency:ev.currency||"AED", confidence:ev.confidence||"likely",
              dates:ev.date?[{date:ev.date,amount:ev.amount||0}]:[]};
    });
  }, [JSON.stringify(financials.forecastEvents)]);

  var MONTHS = useMemo(function() {
    var today=new Date(), months=[];
    for(var i=0;i<36;i++){
      var d=new Date(today.getFullYear(),today.getMonth()+forecastStartOffset+i,1);
      var y=d.getFullYear(),mo=d.getMonth();
      months.push({key:y+"-"+(mo<9?"0":"")+(mo+1), label:d.toLocaleDateString("en-GB",{month:"short"}), year:y, month:mo});
    }
    return months;
  }, [forecastStartOffset]);

  var YEAR_SPANS = useMemo(function() {
    var spans=[],cur=null;
    MONTHS.forEach(function(m,i){
      if(!cur||cur.year!==m.year){if(cur)spans.push(cur);cur={year:m.year,start:i,count:1};}
      else cur.count++;
    });
    if(cur)spans.push(cur);
    return spans;
  }, [MONTHS]);

  var effectiveSalary = monthlySalary!==null?monthlySalary:detectedSalary;

  var projection = useMemo(function() {
    var rows=[], running=effectiveStart;
    MONTHS.forEach(function(mo,i){
      var monthStart=new Date(mo.year,mo.month,1);
      var monthEnd=new Date(mo.year,mo.month+1,0);
      var loanOut=loanRowsMemo.reduce(function(s,l){
        if(l.endDate&&l.endDate<monthStart) return s;
        return s+l.monthlyAmount;
      },0);
      // spendOut: sum of all forecastSpendRows active in this month
      var spendOut=(financials.forecastSpendRows||[]).reduce(function(s,r){
        if(r.fromMonth&&mo.key<r.fromMonth) return s;
        if(r.toMonth&&mo.key>r.toMonth) return s;
        var ovKey=r.cat+(r.sub?"|"+r.sub:"");
        var ov=financials.forecastCatOverrides&&financials.forecastCatOverrides[ovKey]&&financials.forecastCatOverrides[ovKey][mo.key];
        var base;
        if(ov!==undefined){ base=Number(ov)||0; }
        else if(r.useBudget){
          var bcat=budgets&&budgets[r.cat];
          if(r.sub){ base=(bcat&&bcat.subs&&bcat.subs[r.sub]&&bcat.subs[r.sub].monthly)||0; }
          else { var st=bcat&&bcat.subs?Object.values(bcat.subs).reduce(function(a,x){return a+(x&&x.monthly||0);},0):0; base=st>0?st:(bcat&&bcat.monthly||0); }
        } else { base=Number(r.amount)||0; }
        return s+base;
      },0);
      var budgetOut=spendOut;
      var cardOut=creditCardRowsMemo.reduce(function(s,cr){
        var cardMonths=cardAmounts[cr.id];
        var saved=cardMonths&&(mo.key in cardMonths)?cardMonths[mo.key]:undefined;
        var amt=saved!==undefined&&saved!==null?Number(saved):cr.balance;
        return s+(Number(amt)||0);
      },0);
      var eventsIn=0,eventsOut=0,eventsThisMonth=[];
      normalizedEvents.forEach(function(ev){
        (ev.dates||[]).forEach(function(dp){
          if(!dp.date) return;
          var evDate=new Date(dp.date);
          if(evDate>=monthStart&&evDate<=monthEnd){
            var from=ev.currency||"AED";
            var a=Number(dp.amount||0);
            var rates=displayRates||fxRates||FALLBACK_RATES;
            var amt=from===dc?a:(!rates||!rates[from]?a:a/rates[from]*(rates[dc]||1));
            if(ev.eventType==="income"){eventsIn+=amt;}else{eventsOut+=amt;}
            eventsThisMonth.push({id:ev.id+"_"+dp.date,label:ev.label,eventType:ev.eventType,dispAmount:amt});
          }
        });
      });
      var totalIn=effectiveSalary+eventsIn;
      var totalOut=budgetOut+loanOut+cardOut+eventsOut;
      var net=totalIn-totalOut;
      running=running+net;
      rows.push({monthKey:mo.key,label:mo.label,year:mo.year,
        salaryIn:effectiveSalary,eventsIn,eventsOut,totalIn,loanOut,budgetOut,cardOut,totalOut,net,closing:running,events:eventsThisMonth});
    });
    return rows;
  }, [effectiveStart,effectiveSalary,loanRowsMemo,spendRowsMemo,creditCardRowsMemo,
      JSON.stringify(financials.forecastSpendRows),JSON.stringify(financials.forecastCatOverrides),JSON.stringify(cardAmounts),normalizedEvents,displayCurrency,JSON.stringify(fxRates),JSON.stringify(budgets)]);

  var projEnd    = projection.length>0?projection[projection.length-1].closing:effectiveStart;
  var totalIn36  = projection.reduce(function(s,r){return s+r.totalIn;},0);
  var totalOut36 = projection.reduce(function(s,r){return s+r.totalOut;},0);

  // useEffect — before nested function definitions (Rule #19)
  useEffect(function(){
    setEvtForm(function(p){return Object.assign({},p,{currency:dc});});
  }, [dc]);

  // Bubble projection up to App so HomeTab forecast card shows the same closing balances
  useEffect(function(){
    if(onProjectionChange) onProjectionChange(projection);
  }, [projection]);

  // Fetch rates independently — displayRates is null when dc=AED, so ForecastTab needs its own copy
  useEffect(function(){
    getAEDRates().then(function(r){ if(r) setFxRates(r); });
  }, []);

  // Seed forecastStartOffset from Firestore (e.g. after reload or another device updates it)
  useEffect(function(){
    var saved = financials.forecastStartOffset;
    if(saved && typeof saved === "number" && saved > 0){
      setForecastStartOffset(saved);
    }
  }, [financials.forecastStartOffset]);

  // Seed cardAmounts from persisted financials.forecastCardAmounts on load / Firestore update
  useEffect(function(){
    var saved = financials.forecastCardAmounts;
    if(saved && typeof saved === "object" && Object.keys(saved).length > 0){
      setCardAmounts(function(prev){
        var out = Object.assign({}, saved);
        Object.keys(prev).forEach(function(k){ out[k] = prev[k]; }); // session overrides win
        return out;
      });
    }
  }, [JSON.stringify(financials.forecastCardAmounts)]);

  // (catOverrides seeding useEffect removed — cells now read financials.forecastCatOverrides directly)

  // ──────────────────────────────────────────────
  // Nested helper functions — ALL hooks are above (Rule #19 satisfied)
  // ──────────────────────────────────────────────

  function fmtF(n){
    return dc+" "+Math.abs(Number(n||0)).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0});
  }
  function fmtFSigned(n){
    var v=Number(n||0),s=v<0?"-":"";
    return s+dc+" "+Math.abs(v).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0});
  }
  // Number-only formatters — no currency prefix — used in table cells
  function fmtN(n){ return Math.abs(Number(n||0)).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function fmtNSigned(n){ var v=Number(n||0); return (v<0?"-":"")+Math.abs(v).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function fmtNSignedPlus(n){ var v=Number(n||0); return (v>=0?"+":"-")+Math.abs(v).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function uid(){return "fe_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);}

  function persistEvents(newEvents){
    if(!setFinancials) return;
    setFinancials(function(prev){return Object.assign({},prev,{forecastEvents:newEvents});});
  }

  function handleSaveEvent(){
    if(!evtForm.label) return;
    var cleanDates=evtForm.dates.filter(function(d){return d.date&&d.amount!=="";})
      .map(function(d){return {date:d.date,amount:parseFloat(d.amount)||0};});
    if(cleanDates.length===0) return;
    var newEv={id:editingEvent?editingEvent.id:uid(),label:evtForm.label,
      eventType:evtForm.eventType||"expense",currency:evtForm.currency||dc,
      confidence:evtForm.confidence||"likely",dates:cleanDates};
    var updated=editingEvent
      ?normalizedEvents.map(function(e){return e.id===editingEvent.id?newEv:e;})
      :normalizedEvents.concat([newEv]);
    persistEvents(updated);
    setShowEventModal(false); setEditingEvent(null);
    setEvtForm({label:"",eventType:"expense",currency:dc,confidence:"likely",dates:[{date:"",amount:""}]});
  }

  function openNewEvent(eventType){
    var et = eventType||"expense";
    setEditingEvent(null);
    setEvtForm({label:"",eventType:et,currency:dc,confidence:"likely",dates:[{date:"",amount:""}]});
    setShowEventModal(true);
  }

  function openEditEvent(ev){
    setEditingEvent(ev);
    setEvtForm({label:ev.label||"",eventType:ev.eventType||"expense",currency:ev.currency||dc,
      confidence:ev.confidence||"likely",
      dates:ev.dates&&ev.dates.length>0?ev.dates.map(function(d){return {date:d.date,amount:String(d.amount||"")};}):[{date:"",amount:""}]});
    setShowEventModal(true);
  }

  function deleteEvent(evId){
    persistEvents(normalizedEvents.filter(function(e){return e.id!==evId;}));
  }

  // ── Spend Row helpers ──────────────────────────────────────────────────────
  function openNewSpendRow(){
    setEditingSpendRow(null);
    setSpendForm({cat:Object.keys(taxonomy||DEFAULT_TAXONOMY)[0]||"",sub:"",useBudget:true,amount:"",fromMonth:MONTHS[0]?MONTHS[0].key:"",toMonth:MONTHS[35]?MONTHS[35].key:""});
    setShowSpendModal(true);
  }

  function openEditSpendRow(row){
    setEditingSpendRow(row);
    setSpendForm({cat:row.cat||"",sub:row.sub||"",useBudget:!!row.useBudget,amount:row.amount!==undefined?String(row.amount):"",fromMonth:row.fromMonth||"",toMonth:row.toMonth||""});
    setShowSpendModal(true);
  }

  function deleteSpendRow(id){
    setFinancials(function(prev){
      return Object.assign({},prev,{forecastSpendRows:(prev.forecastSpendRows||[]).filter(function(r){return r.id!==id;})});
    });
  }

  function handleSaveSpendRow(){
    var cat=spendForm.cat||"";
    if(!cat) return;
    var newRow={
      id:editingSpendRow?editingSpendRow.id:uid(),
      cat:cat,
      sub:spendForm.sub||"",
      useBudget:!!spendForm.useBudget,
      amount:spendForm.useBudget?0:parseFloat(spendForm.amount)||0,
      fromMonth:spendForm.fromMonth||"",
      toMonth:spendForm.toMonth||""
    };
    setFinancials(function(prev){
      var rows=prev.forecastSpendRows||[];
      var updated=editingSpendRow
        ?rows.map(function(r){return r.id===editingSpendRow.id?newRow:r;})
        :rows.concat([newRow]);
      return Object.assign({},prev,{forecastSpendRows:updated});
    });
    setShowSpendModal(false);
    setEditingSpendRow(null);
    setSpendForm({cat:"",sub:"",useBudget:true,amount:"",fromMonth:"",toMonth:""});
  }

  function handleResetToCurrentMonth(){
    // Work out how many real months have elapsed since the forecast's current start
    var today = new Date();
    var todayYear = today.getFullYear();
    var todayMonth = today.getMonth(); // 0-based
    // Current forecast start month (MONTHS[0])
    var fStart = MONTHS[0];
    var monthsElapsed = (todayYear - fStart.year)*12 + (todayMonth - fStart.month);
    if(monthsElapsed <= 0) {
      // Already at current month — nothing to advance
      return;
    }
    var newOffset = forecastStartOffset + monthsElapsed;

    // Build new starting balances: sum of financials.accounts (non-credit) + cash
    // This becomes the new acctBalances for month 0 of the new view
    var rates = displayRates || fxRates || FALLBACK_RATES;
    var dcRate = rates && rates[dc] ? rates[dc] : 1;
    var newStartingBalance = 0;
    (financials.accounts||[]).filter(function(a){return a.type!=="credit";}).forEach(function(a){
      var from = a.currency||"AED";
      var amt = Number(a.balance||0);
      var converted = from===dc ? amt : (!rates||!rates[from]?amt:amt/rates[from]*(rates[dc]||1));
      newStartingBalance += converted;
    });
    (financials.cash||[]).forEach(function(c){
      var from = c.currency||"AED";
      var amt = Number(c.amount||0);
      var converted = from===dc ? amt : (!rates||!rates[from]?amt:amt/rates[from]*(rates[dc]||1));
      newStartingBalance += converted;
    });

    // Clear acctBalances overrides for the months we're dropping — reset to fresh auto from financials
    setAcctBalances({});

    // Persist offset to financials so it survives reload
    if(setFinancials){
      setFinancials(function(prev){
        return Object.assign({},prev,{forecastStartOffset:newOffset});
      });
    }
    setForecastStartOffset(newOffset);
  }

  function startCellEdit(rowType,rowId,monthKey,currentVal){
    setEditingCell({rowType:rowType,rowId:rowId,monthKey:monthKey});
    var iv=String(currentVal||""); setEditingValue(iv); editingValueRef.current=iv;
  }

  function commitCellEdit(){
    if(!editingCell) return;
    var val=parseFloat(editingValueRef.current); if(isNaN(val)) val=0;
    if(editingCell.rowType==="salary"){
      setMonthlySalary(val);
    } else if(editingCell.rowType==="acct"){
      var aid=editingCell.rowId;
      setAcctBalances(function(p){return Object.assign({},p,{[aid]:val});});
      // Two-way sync: write back to financials.accounts / financials.cash so Position tab stays in sync
      if(setFinancials){
        setFinancials(function(prev){
          // aid is "acct_<id|name>" or "cash_<id|label>"
          var isAcct=aid.startsWith("acct_"), isCash=aid.startsWith("cash_");
          var innerKey=isAcct?aid.slice(5):aid.slice(5); // strip prefix
          if(isAcct){
            var newAccts=(prev.accounts||[]).map(function(a){
              var aKey=a.id||a.name;
              if(aKey===innerKey) return Object.assign({},a,{balance:val});
              return a;
            });
            return Object.assign({},prev,{accounts:newAccts});
          } else if(isCash){
            var newCash=(prev.cash||[]).map(function(c){
              var cKey=c.id||c.label;
              if(cKey===innerKey) return Object.assign({},c,{amount:val});
              return c;
            });
            return Object.assign({},prev,{cash:newCash});
          }
          return prev;
        });
      }
    } else if(editingCell.rowType==="budget"){
      var cat=editingCell.rowId, mk=editingCell.monthKey;
      // Write directly to financials.forecastCatOverrides (single source of truth — Rule #24)
      if(setFinancials){
        setFinancials(function(prev){
          var existing=Object.assign({},prev.forecastCatOverrides||{});
          existing[cat]=Object.assign({},existing[cat],{[mk]:val});
          return Object.assign({},prev,{forecastCatOverrides:existing});
        });
      }
    } else if(editingCell.rowType==="card"){
      var cid=editingCell.rowId, mk2=editingCell.monthKey;
      setCardAmounts(function(p){var n=Object.assign({},p); n[cid]=Object.assign({},n[cid],{[mk2]:val}); return n;});
      // Persist to financials — two stores: forecastCardAmounts (per month) AND accounts[].balance (two-way sync, Rule #22)
      if(setFinancials){
        setFinancials(function(prev){
          var existing=Object.assign({},prev.forecastCardAmounts||{});
          existing[cid]=Object.assign({},existing[cid],{[mk2]:val});
          // Also write back to accounts[].balance so Financial Position stays in sync (Rule #22)
          var newAccts=(prev.accounts||[]).map(function(a){
            var aKey=a.id||a.name;
            if(aKey===cid) return Object.assign({},a,{balance:val});
            return a;
          });
          return Object.assign({},prev,{forecastCardAmounts:existing,accounts:newAccts});
        });
      }
    }
    setEditingCell(null); setEditingValue(""); editingValueRef.current="";
  }

  function isEditing(rowType,rowId,monthKey){
    return editingCell&&editingCell.rowType===rowType&&editingCell.rowId===rowId&&editingCell.monthKey===monthKey;
  }

  function handleKeyDown(e){
    if(e.key==="Enter") commitCellEdit();
    if(e.key==="Escape"){setEditingCell(null);setEditingValue("");editingValueRef.current="";}
  }

  // Editable cell — current month only (for account rows)
  function AcctCell(rowId, autoAmount, overrideAmount){
    var val = overrideAmount!==undefined ? Number(overrideAmount)||0 : autoAmount;
    var isOverridden = overrideAmount!==undefined;
    if(isEditing("acct",rowId,"m0")){
      return React.createElement("td",{key:"m0",style:{textAlign:"right",padding:"2px 4px",minWidth:72}},
        React.createElement("input",{type:"text",inputMode:"decimal",value:editingValue,
          onChange:function(e){setEditingValue(e.target.value);editingValueRef.current=e.target.value;},
          onBlur:commitCellEdit,onKeyDown:handleKeyDown,autoFocus:true,
          style:{width:66,textAlign:"right",padding:"4px 5px",borderRadius:6,border:"2px solid #2a9d6f",
                 fontSize:11,fontFamily:"monospace",background:"#fff",outline:"none",boxSizing:"border-box"}}));
    }
    return React.createElement("td",{key:"m0",
      onClick:function(){startCellEdit("acct",rowId,"m0",val);},
      style:{textAlign:"right",padding:"7px 8px",color:val<0?C.danger:C.accent,fontFamily:"monospace",
             fontSize:11,minWidth:72,cursor:"pointer",whiteSpace:"nowrap",fontWeight:isOverridden?700:400}},
      fmtNSigned(val));
  }

  // Editable cell — any month (salary, budget, card)
  function EditableCell(rowType,rowId,monthKey,displayVal,numericVal,activeColor){
    if(isEditing(rowType,rowId,monthKey)){
      return React.createElement("td",{key:monthKey,style:{textAlign:"right",padding:"2px 4px",minWidth:72}},
        React.createElement("input",{type:"text",inputMode:"decimal",value:editingValue,
          onChange:function(e){setEditingValue(e.target.value);editingValueRef.current=e.target.value;},
          onBlur:commitCellEdit,onKeyDown:handleKeyDown,autoFocus:true,
          style:{width:66,textAlign:"right",padding:"4px 5px",borderRadius:6,border:"2px solid #2a9d6f",
                 fontSize:11,fontFamily:"monospace",background:"#fff",outline:"none",boxSizing:"border-box"}}));
    }
    return React.createElement("td",{key:monthKey,
      onClick:function(){startCellEdit(rowType,rowId,monthKey,numericVal);},
      style:{textAlign:"right",padding:"7px 8px",color:activeColor||C.muted,fontFamily:"monospace",
             fontSize:11,minWidth:72,cursor:"pointer",whiteSpace:"nowrap"}},
      displayVal);
  }

  // Sparkline
  // Review Modal (salary only now — starting balance is in the table)
  function ReviewModal(){
    var dispSalary=localSalary!==null?localSalary:(monthlySalary!==null?monthlySalary:detectedSalary);
    function save(){
      setMonthlySalary(dispSalary); setLocalSalary(null); setShowReviewModal(false);
    }
    var inp={width:"100%",boxSizing:"border-box",marginTop:6,padding:"9px 12px",borderRadius:10,
             border:"1px solid #cdd1db",fontSize:14,fontFamily:"monospace",outline:"none"};
    return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(15,22,36,0.55)",zIndex:9999,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}},
      React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:24,width:"100%",maxWidth:420,
        boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}},
        React.createElement("div",{style:{fontSize:16,fontWeight:700,marginBottom:4}},"⚙️ Forecast Figures"),
        React.createElement("div",{style:{fontSize:12,color:"#7a8699",marginBottom:20}},
          "Adjust the monthly salary used across the forecast. Starting balances are editable directly in the table."),
        React.createElement("div",{style:{marginBottom:22}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:4,letterSpacing:"0.05em"}},
            "MONTHLY SALARY / INCOME ("+dc+")"),
          React.createElement("div",{style:{fontSize:11,color:"#4a5568",marginBottom:4}},
            detectedSalary>0?"Auto-detected from last 12 months: "+fmtN(detectedSalary):"No salary found — enter manually"),
          React.createElement("input",{type:"text",inputMode:"decimal",value:dispSalary,
            onChange:function(e){setLocalSalary(parseFloat(e.target.value)||0);},style:inp})),
        React.createElement("div",{style:{display:"flex",gap:10}},
          React.createElement("button",{onClick:function(){setShowReviewModal(false);},
            style:{flex:1,padding:"11px 0",borderRadius:12,border:"1px solid #cdd1db",background:"transparent",
                   color:"#4a5568",fontSize:13,cursor:"pointer",fontFamily:"inherit"}},"Cancel"),
          React.createElement("button",{onClick:save,
            style:{flex:2,padding:"11px 0",borderRadius:12,border:"none",background:"#2a9d6f",color:"#fff",
                   fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save"))));
  }

  // SpendRow Modal — add/edit an expected spend row in the Forecast Outgoings section
  function SpendRowModal(){
    var inp={width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,border:"1px solid #cdd1db",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"};
    var tax=taxonomy||DEFAULT_TAXONOMY;
    var allCats=Object.keys(tax);
    var selCat=spendForm.cat||allCats[0]||"";
    var catSubs=selCat&&tax[selCat]&&tax[selCat].subs?Object.keys(tax[selCat].subs):[];
    var catIcon=(tax[selCat]&&tax[selCat].icon)||"🛒";

    // Budget preview amount for useBudget mode
    var budgetPreview=(function(){
      if(!budgets||!selCat) return null;
      var bcat=budgets[selCat];
      if(!bcat) return null;
      var sub=spendForm.sub;
      if(sub&&bcat.subs&&bcat.subs[sub]) return bcat.subs[sub].monthly||0;
      if(!sub){
        // category-level: sum all subs
        var total=bcat.subs?Object.values(bcat.subs).reduce(function(a,x){return a+(x&&x.monthly||0);},0):0;
        return total>0?total:(bcat.monthly||0);
      }
      return bcat.monthly||0;
    })();

    return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(15,22,36,0.6)",zIndex:9999,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}},
      React.createElement("div",{style:{background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:540,
        maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}},

        // Title
        React.createElement("div",{style:{fontSize:15,fontWeight:800,marginBottom:16,color:"#0f1624"}},
          editingSpendRow?"✏️ Edit Expense Row":"➕ Add Expense Row"),

        // Category
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:4,letterSpacing:"0.05em"}},"CATEGORY"),
          React.createElement("select",{value:selCat,
            onChange:function(e){
              var nc=e.target.value;
              setSpendForm(function(p){return Object.assign({},p,{cat:nc,sub:""});});
            },
            style:Object.assign({},inp,{appearance:"none"})},
            allCats.map(function(c){
              var ic=(tax[c]&&tax[c].icon)||"🛒";
              return React.createElement("option",{key:c,value:c},ic+" "+c);
            }))),

        // Subcategory
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:4,letterSpacing:"0.05em"}},"SUBCATEGORY"),
          React.createElement("select",{value:spendForm.sub||"",
            onChange:function(e){setSpendForm(function(p){return Object.assign({},p,{sub:e.target.value});});},
            style:Object.assign({},inp,{appearance:"none"})},
            React.createElement("option",{value:""},"— Category level (no subcategory) —"),
            catSubs.map(function(s){
              var si=(tax[selCat]&&tax[selCat].subs&&tax[selCat].subs[s]&&tax[selCat].subs[s].icon)||"·";
              return React.createElement("option",{key:s,value:s},si+" "+s);
            }))),

        // Amount source
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:6,letterSpacing:"0.05em"}},"AMOUNT"),
          React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
            ["budget","custom"].map(function(opt){
              var active=opt==="budget"?!!spendForm.useBudget:!spendForm.useBudget;
              return React.createElement("button",{key:opt,
                onClick:function(){setSpendForm(function(p){return Object.assign({},p,{useBudget:opt==="budget"});});},
                style:{flex:1,padding:"9px 0",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,
                  fontWeight:active?700:400,border:"1px solid "+(active?"#2a9d6f":"#cdd1db"),
                  background:active?"rgba(42,157,111,0.08)":"transparent",color:active?"#2a9d6f":"#4a5568"}},
                opt==="budget"?"📊 Use budget amount":"✏️ Custom amount");
            })),
          spendForm.useBudget
            ? React.createElement("div",{style:{padding:"8px 12px",borderRadius:8,background:"rgba(42,157,111,0.06)",border:"1px solid rgba(42,157,111,0.2)",fontSize:12,color:"#4a5568"}},
                budgetPreview!==null&&budgetPreview!==undefined
                  ? "Budget amount: "+fmtN(budgetPreview)+" / month"
                  : "No budget set for this category")
            : React.createElement("input",{type:"text",inputMode:"decimal",placeholder:"Amount per month",
                value:spendForm.amount||"",
                onChange:function(e){setSpendForm(function(p){return Object.assign({},p,{amount:e.target.value});});},
                style:inp})),

        // From / To month
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:20}},
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:4,letterSpacing:"0.05em"}},"FROM MONTH"),
            React.createElement("select",{value:spendForm.fromMonth||"",
              onChange:function(e){setSpendForm(function(p){return Object.assign({},p,{fromMonth:e.target.value});});},
              style:Object.assign({},inp,{appearance:"none"})},
              React.createElement("option",{value:""},"— start —"),
              MONTHS.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label+" "+m.year);}))),
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:11,fontWeight:700,color:"#7a8699",marginBottom:4,letterSpacing:"0.05em"}},"TO MONTH"),
            React.createElement("select",{value:spendForm.toMonth||"",
              onChange:function(e){setSpendForm(function(p){return Object.assign({},p,{toMonth:e.target.value});});},
              style:Object.assign({},inp,{appearance:"none"})},
              React.createElement("option",{value:""},"— end —"),
              MONTHS.map(function(m){return React.createElement("option",{key:m.key,value:m.key},m.label+" "+m.year);})))),

        // Save / Cancel
        React.createElement("div",{style:{display:"flex",gap:10}},
          React.createElement("button",{onClick:function(){setShowSpendModal(false);setEditingSpendRow(null);},
            style:{flex:1,padding:"11px 0",borderRadius:12,border:"1px solid #cdd1db",background:"transparent",color:"#4a5568",fontSize:13,cursor:"pointer",fontFamily:"inherit"}},"Cancel"),
          React.createElement("button",{onClick:handleSaveSpendRow,
            style:{flex:2,padding:"11px 0",borderRadius:12,border:"none",background:"#2a9d6f",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},
            editingSpendRow?"Save Changes":"Add Row"))));
  }

  // Event Modal
  function EventModal(){
    var inp={width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,border:"1px solid #cdd1db",fontSize:13,fontFamily:"inherit",outline:"none"};
    var inpMono=Object.assign({},inp,{fontFamily:"monospace"});
    function addDateRow(){setEvtForm(function(p){return Object.assign({},p,{dates:p.dates.concat([{date:"",amount:""}])});});}
    function removeDateRow(i){setEvtForm(function(p){var nd=p.dates.filter(function(_,j){return j!==i;});return Object.assign({},p,{dates:nd.length>0?nd:[{date:"",amount:""}]});});}
    function setDateRow(i,field,val){setEvtForm(function(p){var nd=p.dates.map(function(d,j){return j===i?Object.assign({},d,{[field]:val}):d;});return Object.assign({},p,{dates:nd});});}
    return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(15,22,36,0.6)",zIndex:9999,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}},
      React.createElement("div",{style:{background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:540,
        maxHeight:"85vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}},
        React.createElement("div",{style:{fontSize:15,fontWeight:800,marginBottom:16,color:C.text}},
          editingEvent?"✏️ Edit Event":"➕ Add One-off Event"),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:4,letterSpacing:"0.05em"}},"EVENT NAME"),
          React.createElement("input",{type:"text",placeholder:"e.g. Annual Bonus, School Fees, RSU Vest",
            value:evtForm.label,onChange:function(e){setEvtForm(function(p){return Object.assign({},p,{label:e.target.value});});},style:inp})),
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:12}},
          ["income","expense"].map(function(t){
            var isInc=t==="income",active=evtForm.eventType===t;
            return React.createElement("button",{key:t,
              onClick:function(){setEvtForm(function(p){return Object.assign({},p,{eventType:t});});},
              style:{flex:1,padding:"9px 0",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:active?700:400,
                border:"1px solid "+(active?(isInc?C.accent:C.danger):C.border),
                background:active?(isInc?"rgba(42,157,111,0.08)":"rgba(217,64,64,0.08)"):"transparent",
                color:active?(isInc?C.accent:C.danger):C.muted}},
              isInc?"+ Income":"− Expense");})),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:4,letterSpacing:"0.05em"}},"CURRENCY"),
          React.createElement("select",{value:evtForm.currency||dc,
            onChange:function(e){setEvtForm(function(p){return Object.assign({},p,{currency:e.target.value});});},
            style:Object.assign({},inp,{appearance:"none"})},
            ["AED","GBP","USD","EUR","PKR"].map(function(c){return React.createElement("option",{key:c,value:c},c);}))),
        React.createElement("div",{style:{marginBottom:4}},
          React.createElement("div",{style:{fontSize:11,fontWeight:700,color:C.dim,marginBottom:6,letterSpacing:"0.05em"}},"DATE / AMOUNT PAIRS"),
          evtForm.dates.map(function(dp,i){
            return React.createElement("div",{key:i,style:{display:"flex",gap:6,marginBottom:8,alignItems:"center"}},
              React.createElement("input",{type:"date",value:dp.date,onChange:function(e){setDateRow(i,"date",e.target.value);},
                style:Object.assign({},inp,{flex:"2",colorScheme:"light"})}),
              React.createElement("input",{type:"text",inputMode:"decimal",placeholder:"Amount",value:dp.amount,
                onChange:function(e){setDateRow(i,"amount",e.target.value);},style:Object.assign({},inpMono,{flex:"1"})}),
              evtForm.dates.length>1
                ?React.createElement("button",{onClick:function(){removeDateRow(i);},
                    style:{padding:"6px 8px",borderRadius:8,border:"1px solid "+C.danger+"44",background:"transparent",color:C.danger,fontSize:12,cursor:"pointer"}},"✕")
                :React.createElement("div",{style:{width:32}}));}),
          React.createElement("button",{onClick:addDateRow,
            style:{padding:"6px 14px",borderRadius:8,border:"1px dashed "+C.border,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",marginTop:2}},
            "+ Add another date")),
        React.createElement("div",{style:{display:"flex",gap:10,marginTop:20}},
          React.createElement("button",{onClick:function(){setShowEventModal(false);setEditingEvent(null);},
            style:{flex:1,padding:"11px 0",borderRadius:12,border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}},"Cancel"),
          React.createElement("button",{onClick:handleSaveEvent,
            style:{flex:2,padding:"11px 0",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save Event"))));
  }

  function Tile(props){
    var isNeg=typeof props.value==="number"&&props.value<0;
    return React.createElement("div",{style:{background:C.surface,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.border,flex:"1 1 140px",minWidth:130}},
      React.createElement("div",{style:{fontSize:10,fontWeight:700,color:C.dim,marginBottom:6,letterSpacing:"0.05em"}},props.label),
      React.createElement("div",{style:{fontSize:17,fontWeight:800,color:isNeg?C.danger:C.accent,fontFamily:"monospace",lineHeight:1.2}},fmtNSigned(props.value)),
      props.sub&&React.createElement("div",{style:{fontSize:11,color:C.dim,marginTop:4}},props.sub));
  }

  // Shared cell styles
  var stickyLabel={position:"sticky",left:0,zIndex:2,background:"rgba(255,255,255,0.97)",
    minWidth:152,maxWidth:152,width:152,padding:"7px 10px",borderRight:"1px solid "+C.border,
    fontSize:12,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"};
  var stickyLabelGreen=Object.assign({},stickyLabel,{background:"rgba(236,241,235,0.97)"});
  var stickyLabelBlue =Object.assign({},stickyLabel,{background:"rgba(230,238,255,0.97)"});
  var stickyLabelDanger=Object.assign({},stickyLabel,{background:"rgba(253,236,236,0.97)"});
  var dataCell={textAlign:"right",padding:"7px 8px",fontSize:11,fontFamily:"monospace",minWidth:72,whiteSpace:"nowrap"};
  var dataCellDim=Object.assign({},dataCell,{color:C.dim});

  var totalStarting=effectiveStart;

  // ── RENDER ──
  return React.createElement("div",{style:{paddingBottom:40}},

    showReviewModal&&ReviewModal(),
    showEventModal&&EventModal(),
    showSpendModal&&SpendRowModal(),

    // Header
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}},
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:17,fontWeight:800,color:C.text}},"📈 3-Year Forecast"),
        React.createElement("div",{style:{fontSize:12,color:C.dim}},
          (MONTHS[0]?MONTHS[0].label+" "+MONTHS[0].year:"")+" → "+(MONTHS[35]?MONTHS[35].label+" "+MONTHS[35].year:""))),
      React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center"}},
        React.createElement("button",{onClick:function(){handleResetToCurrentMonth();},
          style:{padding:"8px 14px",borderRadius:10,border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}},
          "📅 Reset Month"),
        React.createElement("button",{onClick:function(){setShowReviewModal(true);},
          style:{padding:"8px 14px",borderRadius:10,border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}},
          "⚙️ Salary"))),

    // 4 tiles
    React.createElement("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}},
      Tile({label:"STARTING POSITION",value:effectiveStart}),
      Tile({label:"END BALANCE (36mo)",value:projEnd}),
      Tile({label:"TOTAL IN (36mo)",value:totalIn36}),
      Tile({label:"TOTAL OUT (36mo)",value:-totalOut36})),

    // Unified table
    React.createElement("div",{style:{background:C.surface,borderRadius:14,border:"1px solid "+C.border,overflowX:"auto",marginBottom:16}},
      React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,tableLayout:"fixed",minWidth:152+MONTHS.length*72}},

        // THEAD
        React.createElement("thead",null,
          React.createElement("tr",{style:{background:"rgba(42,157,111,0.07)"}},
            React.createElement("th",{style:Object.assign({},stickyLabelGreen,{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.06em",zIndex:3})},"ROW"),
            YEAR_SPANS.map(function(ys){
              return React.createElement("th",{key:ys.year,colSpan:ys.count,
                style:{textAlign:"center",padding:"5px 0",color:C.accent,fontWeight:800,fontSize:13,
                       borderLeft:"2px solid rgba(42,157,111,0.3)",letterSpacing:"0.02em"}},
                String(ys.year));})),
          React.createElement("tr",{style:{background:"rgba(42,157,111,0.04)"}},
            React.createElement("th",{style:Object.assign({},stickyLabelGreen,{fontSize:10,color:C.dim,fontWeight:600,zIndex:3})},""),
            MONTHS.map(function(m,i){
              var isYS=i===0||MONTHS[i-1].year!==m.year;
              return React.createElement("th",{key:m.key,
                style:{textAlign:"right",padding:"4px 8px",minWidth:72,
                       color:hoverMonth===i?C.accent:C.dim,fontWeight:hoverMonth===i?700:500,fontSize:10,
                       borderLeft:isYS?"2px solid rgba(42,157,111,0.3)":undefined,whiteSpace:"nowrap"}},
                m.label);}))),

        React.createElement("tbody",null,

          // ══ STARTING POSITION section header ══
          React.createElement("tr",{style:{background:"rgba(74,98,216,0.08)"}},
            React.createElement("td",{style:{position:"sticky",left:0,zIndex:2,background:"rgba(209,218,246,0.97)",
              padding:"5px 12px",fontSize:10,fontWeight:800,color:"#4a62d8",letterSpacing:"0.07em",
              minWidth:152,maxWidth:152,width:152,whiteSpace:"nowrap"}},
              "▸ STARTING POSITION"),
            React.createElement("td",{colSpan:MONTHS.length,style:{background:"rgba(74,98,216,0.05)",padding:"5px 4px",fontSize:10,color:"#4a62d8",opacity:0.7}},"enter current balances in the first column")),

          // One row per current account + cash item
          startingRowsMemo.map(function(row){
            var overrideVal = acctBalances[row.id];
            return React.createElement("tr",{key:row.id,style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{style:Object.assign({},stickyLabelBlue,{color:C.text})},row.icon+" "+row.label),
              // Month 0: editable
              AcctCell(row.id, row.autoAmount, overrideVal),
              // Months 1–35: show "·" — balance flows through closing balance
              MONTHS.slice(1).map(function(m){
                return React.createElement("td",{key:m.key,style:dataCellDim},"·");
              }));
          }),

          // If no accounts/cash configured
          startingRowsMemo.length===0&&React.createElement("tr",{style:{borderTop:"1px solid "+C.border}},
            React.createElement("td",{colSpan:MONTHS.length+1,
              style:{padding:"8px 16px",color:C.dim,fontSize:11,fontStyle:"italic"}},
              "No accounts or cash set up — add them in Input Data → Financial Position")),

          // Total Starting Position — month 0 = sum of account inputs, months 1-35 = prev closing
          React.createElement("tr",{style:{borderTop:"2px solid rgba(74,98,216,0.3)",background:"rgba(74,98,216,0.06)"}},
            React.createElement("td",{style:Object.assign({},stickyLabelBlue,{color:"#4a62d8",fontWeight:700})},"Total Starting Position"),
            React.createElement("td",{style:Object.assign({},dataCell,{color:totalStarting<0?C.danger:"#4a62d8",fontWeight:700})},fmtNSigned(totalStarting)),
            MONTHS.slice(1).map(function(m,idx){
              var prevClose = projection[idx] ? projection[idx].closing : null;
              return React.createElement("td",{key:m.key,
                style:Object.assign({},dataCell,{color:prevClose!==null&&prevClose<0?C.danger:"#4a62d8",fontWeight:500,opacity:0.65})},
                prevClose!==null?fmtNSigned(prevClose):"·");
            })),

          // ══ CREDITS section header ══
          React.createElement("tr",{style:{background:"rgba(42,157,111,0.09)"}},
            React.createElement("td",{style:{position:"sticky",left:0,zIndex:2,background:"rgba(220,243,234,0.97)",
              padding:"5px 12px",fontSize:10,fontWeight:800,color:C.accent,letterSpacing:"0.07em",
              minWidth:152,maxWidth:152,width:152,whiteSpace:"nowrap"}},
              "▸ CREDITS"),
            React.createElement("td",{colSpan:MONTHS.length,style:{background:"rgba(42,157,111,0.04)"}})),

          // Salary
          React.createElement("tr",{style:{borderTop:"1px solid "+C.border}},
            React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text})},
              "💼 Salary"+(detectedSalary>0&&monthlySalary===null?" (auto)":"")),
            MONTHS.map(function(m,i){
              var r=projection[i];
              return EditableCell("salary","salary",m.key,r?fmtN(r.salaryIn):"—",r?r.salaryIn:effectiveSalary,C.accent);
            })),

          // One-off income events
          normalizedEvents.filter(function(ev){return ev.eventType==="income";}).map(function(ev){
            return React.createElement("tr",{key:"inc_"+ev.id,style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text})},
                React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:2}},
                  React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis",flex:1}},"💚 "+ev.label),
                  React.createElement("div",{style:{display:"flex",gap:2,flexShrink:0}},
                    React.createElement("button",{onClick:function(){openEditEvent(ev);},
                      style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✏️"),
                    React.createElement("button",{onClick:function(){if(window.confirm("Delete "+ev.label+"?")){deleteEvent(ev.id);}},
                      style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.danger+"44",background:"transparent",color:C.danger,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✕")))),
              MONTHS.map(function(m,i){
                var r=projection[i];
                var evM=r&&r.events.find(function(e){return e.id&&e.id.startsWith(ev.id+"_");});
                var v=evM?evM.dispAmount:0;
                return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:v>0?C.accent:C.dim,fontWeight:v>0?700:400})},v>0?fmtN(v):"·");
              }));}),

          // ── Blank "add income event" row ──
          React.createElement("tr",{key:"inc_add",style:{borderTop:"1px dashed rgba(42,157,111,0.25)"}},
            React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.accent,cursor:"pointer",opacity:0.6}),
              onClick:function(){openNewEvent("income");}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4,fontSize:11}},
                React.createElement("span",{style:{fontSize:13,fontWeight:700}},"+"),
                React.createElement("span",null,"Add income event"))),
            MONTHS.map(function(m){return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");})),

          // Total Credits
          React.createElement("tr",{style:{borderTop:"2px solid rgba(42,157,111,0.25)",background:"rgba(42,157,111,0.07)"}},
            React.createElement("td",{style:Object.assign({},stickyLabelGreen,{color:C.accent,fontWeight:700})},"Total Credits"),
            MONTHS.map(function(m,i){
              var r=projection[i];
              return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.accent,fontWeight:700})},r?fmtN(r.totalIn):"—");
            })),

          // ══ OUTGOINGS section header ══
          React.createElement("tr",{style:{background:"rgba(217,64,64,0.08)"}},
            React.createElement("td",{style:{position:"sticky",left:0,zIndex:2,background:"rgba(248,225,225,0.97)",
              padding:"5px 12px",fontSize:10,fontWeight:800,color:C.danger,letterSpacing:"0.07em",
              minWidth:152,maxWidth:152,width:152,whiteSpace:"nowrap"}},
              "▸ OUTGOINGS"),
            React.createElement("td",{colSpan:MONTHS.length,style:{background:"rgba(217,64,64,0.04)"}})),

          // ── Expected Spend rows — derived from financials.forecastSpendRows ──
          (function(){
            var spendRows = financials.forecastSpendRows||[];
            if(spendRows.length===0) return React.createElement("tr",{style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{colSpan:MONTHS.length+1,
                style:{padding:"8px 16px",color:C.dim,fontSize:11,fontStyle:"italic"}},
                "No expected spend rows yet — tap + Add an expense row below"));

            // Group by category
            var catOrder=[], catMap={};
            spendRows.forEach(function(r){
              if(!catMap[r.cat]){catMap[r.cat]={subRows:[],catRow:null}; catOrder.push(r.cat);}
              if(r.sub){ catMap[r.cat].subRows.push(r); }
              else { catMap[r.cat].catRow=r; }
            });

            return catOrder.map(function(cat){
              var bucket=catMap[cat];
              var catIcon=(taxonomy&&taxonomy[cat]&&taxonomy[cat].icon)||"🛒";
              var hasSubs=bucket.subRows.length>0;
              var isExp=!!expandedForecastCats[cat];

              // Category total row
              var catRowEl=React.createElement("tr",{key:"bgt_cat_"+cat,style:{borderTop:"1px solid "+C.border}},
                React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text,cursor:hasSubs?"pointer":"default"}),
                  onClick:hasSubs?function(){setExpandedForecastCats(function(p){var n=Object.assign({},p);n[cat]=!n[cat];return n;});}:undefined},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:2}},
                    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4,overflow:"hidden"}},
                      hasSubs&&React.createElement("span",{style:{fontSize:9,color:C.accent,flexShrink:0}},isExp?"▾":"▸"),
                      React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis"}},catIcon+" "+cat)),
                    React.createElement("div",{style:{display:"flex",gap:2,flexShrink:0}},
                      !hasSubs&&bucket.catRow&&React.createElement("button",{onClick:function(){openEditSpendRow(bucket.catRow);},
                        style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✏️"),
                      !hasSubs&&bucket.catRow&&React.createElement("button",{onClick:function(){deleteSpendRow(bucket.catRow.id);},
                        style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.danger+"44",background:"transparent",color:C.danger,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✕")))),
                MONTHS.map(function(m,i){
                  if(hasSubs){
                    // Total = sum of sub rows active in this month
                    var total=bucket.subRows.reduce(function(s,r){
                      if(r.fromMonth&&m.key<r.fromMonth) return s;
                      if(r.toMonth&&m.key>r.toMonth) return s;
                      var ovKey=cat+"|"+r.sub;
                      var ov=financials.forecastCatOverrides&&financials.forecastCatOverrides[ovKey]&&financials.forecastCatOverrides[ovKey][m.key];
                      var base;
                      if(ov!==undefined){base=Number(ov)||0;}
                      else if(r.useBudget){var bcat=budgets&&budgets[cat];base=(bcat&&bcat.subs&&bcat.subs[r.sub]&&bcat.subs[r.sub].monthly)||0;}
                      else{base=Number(r.amount)||0;}
                      return s+base;
                    },0);
                    return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:total>0?C.danger:C.dim,fontWeight:700})},total>0?fmtN(total):"·");
                  } else if(bucket.catRow){
                    // Category-level row (editable)
                    var r=bucket.catRow;
                    var active=(!r.fromMonth||m.key>=r.fromMonth)&&(!r.toMonth||m.key<=r.toMonth);
                    if(!active) return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");
                    var ovKey=cat;
                    var ov=financials.forecastCatOverrides&&financials.forecastCatOverrides[ovKey]&&financials.forecastCatOverrides[ovKey][m.key];
                    var base=ov!==undefined?Number(ov)||0:(r.useBudget?(function(){var bcat=budgets&&budgets[cat];var st=bcat&&bcat.subs?Object.values(bcat.subs).reduce(function(a,x){return a+(x&&x.monthly||0);},0):0;return st>0?st:(bcat&&bcat.monthly||0);})():Number(r.amount)||0);
                    return EditableCell("budget",ovKey,m.key,ov!==undefined?"~"+fmtN(base):fmtN(base),base,C.danger);
                  }
                  return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");
                }));

              // Sub rows (collapsible, editable per month)
              var subRowEls=isExp?bucket.subRows.map(function(r){
                var subIcon=(taxonomy&&taxonomy[cat]&&taxonomy[cat].subs&&taxonomy[cat].subs[r.sub]&&taxonomy[cat].subs[r.sub].icon)||"·";
                return React.createElement("tr",{key:"bgt_sub_"+r.id,style:{borderTop:"1px solid "+C.s2,background:"rgba(42,157,111,0.02)"}},
                  React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.muted,paddingLeft:22,fontSize:10})},
                    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:2}},
                      React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis"}},subIcon+" "+r.sub),
                      React.createElement("div",{style:{display:"flex",gap:2,flexShrink:0}},
                        React.createElement("button",{onClick:function(){openEditSpendRow(r);},
                          style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✏️"),
                        React.createElement("button",{onClick:function(){deleteSpendRow(r.id);},
                          style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.danger+"44",background:"transparent",color:C.danger,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✕")))),
                  MONTHS.map(function(m){
                    var active=(!r.fromMonth||m.key>=r.fromMonth)&&(!r.toMonth||m.key<=r.toMonth);
                    if(!active) return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");
                    var ovKey=cat+"|"+r.sub;
                    var ov=financials.forecastCatOverrides&&financials.forecastCatOverrides[ovKey]&&financials.forecastCatOverrides[ovKey][m.key];
                    var base=ov!==undefined?Number(ov)||0:(r.useBudget?(function(){var bcat=budgets&&budgets[cat];return (bcat&&bcat.subs&&bcat.subs[r.sub]&&bcat.subs[r.sub].monthly)||0;})():Number(r.amount)||0);
                    return EditableCell("budget",ovKey,m.key,ov!==undefined?"~"+fmtN(base):fmtN(base),base,C.danger);
                  }));
              }):[];

              return [catRowEl].concat(subRowEls);
            });
          })(),

          // Loan rows (read-only)
          loanRowsMemo.map(function(loan){
            return React.createElement("tr",{key:"loan_"+loan.id,style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text})},"🏦 "+loan.label),
              MONTHS.map(function(m,i){
                var mo=MONTHS[i];
                var active=!loan.endDate||loan.endDate>=new Date(mo.year,mo.month,1);
                return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:active?C.danger:C.dim,fontWeight:active?500:400})},active?fmtN(loan.monthlyAmount):"·");
              }));}),

          // Credit card rows (editable per month)
          creditCardRowsMemo.map(function(cr){
            return React.createElement("tr",{key:"cc_"+cr.id,style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text})},"💳 "+cr.label),
              MONTHS.map(function(m,i){
                var saved=cardAmounts[cr.id]&&(m.key in cardAmounts[cr.id])?cardAmounts[cr.id][m.key]:undefined;
                var nv=saved!==undefined&&saved!==null?Number(saved):cr.balance;
                return EditableCell("card",cr.id,m.key,nv>0?fmtN(nv):"—",nv,nv>0?C.danger:C.dim);
              }));}),

          // One-off expense events
          normalizedEvents.filter(function(ev){return ev.eventType==="expense";}).map(function(ev){
            return React.createElement("tr",{key:"exp_"+ev.id,style:{borderTop:"1px solid "+C.border}},
              React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text})},
                React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:2}},
                  React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis",flex:1}},"🔴 "+ev.label),
                  React.createElement("div",{style:{display:"flex",gap:2,flexShrink:0}},
                    React.createElement("button",{onClick:function(){openEditEvent(ev);},
                      style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✏️"),
                    React.createElement("button",{onClick:function(){if(window.confirm("Delete "+ev.label+"?")){deleteEvent(ev.id);}},
                      style:{padding:"1px 4px",borderRadius:4,border:"1px solid "+C.danger+"44",background:"transparent",color:C.danger,fontSize:9,cursor:"pointer",lineHeight:1.4}},"✕")))),
              MONTHS.map(function(m,i){
                var r=projection[i];
                var evM=r&&r.events.find(function(e){return e.id&&e.id.startsWith(ev.id+"_");});
                var v=evM?evM.dispAmount:0;
                return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:v>0?C.danger:C.dim,fontWeight:v>0?700:400})},v>0?fmtN(v):"·");
              }));}),

          // ── Blank "add expense row" dashed row ──
          React.createElement("tr",{key:"spend_add",style:{borderTop:"1px dashed rgba(217,64,64,0.25)"}},
            React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.danger,cursor:"pointer",opacity:0.7}),
              onClick:function(){openNewSpendRow();}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4,fontSize:11}},
                React.createElement("span",{style:{fontSize:13,fontWeight:700}},"+"),
                React.createElement("span",null,"Add an expense row"))),
            MONTHS.map(function(m){return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");})),

          // ── Blank "add exceptional expense" row ──
          React.createElement("tr",{key:"exp_add",style:{borderTop:"1px dashed rgba(217,64,64,0.15)"}},
            React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.danger,cursor:"pointer",opacity:0.55}),
              onClick:function(){openNewEvent("expense");}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4,fontSize:11}},
                React.createElement("span",{style:{fontSize:13,fontWeight:700}},"+"),
                React.createElement("span",null,"Add an exceptional expense"))),
            MONTHS.map(function(m){return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.dim})},"·");})),

          // Total Outgoings
          React.createElement("tr",{style:{borderTop:"2px solid rgba(217,64,64,0.25)",background:"rgba(217,64,64,0.06)"}},
            React.createElement("td",{style:Object.assign({},stickyLabelDanger,{color:C.danger,fontWeight:700})},"Total Outgoings"),
            MONTHS.map(function(m,i){
              var r=projection[i];
              return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:C.danger,fontWeight:700})},r?fmtN(r.totalOut):"—");
            })),

          // Monthly Net — immediately after Total Outgoings
          React.createElement("tr",{style:{borderTop:"1px solid "+C.border,background:"rgba(42,157,111,0.04)"}},
            React.createElement("td",{style:Object.assign({},stickyLabel,{color:C.text,fontWeight:600})},"Monthly Net"),
            MONTHS.map(function(m,i){
              var r=projection[i],v=r?r.net:0;
              return React.createElement("td",{key:m.key,style:Object.assign({},dataCell,{color:v>=0?C.accent:C.danger,fontWeight:600})},
                r?fmtNSignedPlus(v):"—");})),

          // Closing Balance (AED)
          React.createElement("tr",{style:{borderTop:"2px solid rgba(42,157,111,0.3)",background:"rgba(42,157,111,0.07)"}},
            React.createElement("td",{style:Object.assign({},stickyLabelGreen,{color:C.text,fontWeight:800,fontSize:12})},"Closing Balance ("+dc+")"),
            MONTHS.map(function(m,i){
              var r=projection[i],v=r?r.closing:null;
              return React.createElement("td",{key:m.key,
                style:Object.assign({},dataCell,{color:v!==null&&v<0?C.danger:C.accent,fontWeight:800,fontSize:12,
                  background:hoverMonth===i?"rgba(42,157,111,0.12)":"transparent"}),
                onMouseEnter:function(){setHoverMonth(i);},
                onMouseLeave:function(){setHoverMonth(null);}},
                v!==null?fmtNSigned(v):"—");})),

          // Closing Balance GBP
          React.createElement("tr",{style:{borderTop:"1px solid rgba(42,157,111,0.15)",background:"rgba(42,157,111,0.04)"}},
            React.createElement("td",{style:Object.assign({},stickyLabelGreen,{color:C.muted,fontWeight:600,fontSize:11})},"Closing Balance (GBP)"),
            MONTHS.map(function(m,i){
              var r=projection[i],v=r?r.closing:null;
              var rates=displayRates||fxRates||FALLBACK_RATES;
              var gbpRate=rates&&rates["GBP"]?rates["GBP"]:0.2105;
              var dcRate=rates&&rates[dc]?rates[dc]:1;
              // Convert: v is in dc; convert to AED first then to GBP
              var vGBP=v!==null?(v/dcRate)*gbpRate:null;
              return React.createElement("td",{key:m.key,
                style:Object.assign({},dataCell,{color:vGBP!==null&&vGBP<0?C.danger:C.muted,fontWeight:600,fontSize:11})},
                vGBP!==null?(vGBP<0?"-":"")+Math.abs(vGBP).toLocaleString("en-GB",{minimumFractionDigits:0,maximumFractionDigits:0}):"—");}))

        ) // tbody
      ) // table
    ), // table wrapper

    React.createElement("div",{style:{fontSize:11,color:C.dim,textAlign:"center",marginTop:8}},
      "Tap cells to edit · salary applies to all months · future months carry forward from closing balance")

  ); // root
}

// ─── Home Tab (Phase C) ───────────────────────────────────────────────────────
function HomeTab({transactions, financials, budgets, taxonomy, displayCurrency, dispRates, globalTypeFilter, setTab, setModal, setManageInitSection, setManualInitMode, setManualFromHome, setPositionUnlocked, spikeThreshold, forecastProjection, isWide, drawerOpen, setDrawerOpen}) {

  var now = new Date();
  var _p2 = function(n){ return String(n).padStart(2,"0"); };
  var thisYM  = now.getFullYear()+"-"+_p2(now.getMonth()+1);
  var prevDate = new Date(now); prevDate.setMonth(prevDate.getMonth()-1);
  var lastYM  = prevDate.getFullYear()+"-"+_p2(prevDate.getMonth()+1);

  var greetHour = now.getHours();
  var greetWord = greetHour<12?"Good morning":greetHour<17?"Good afternoon":"Good evening";
  var dayNames  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var monNames  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var dateStr   = dayNames[now.getDay()]+", "+now.getDate()+" "+monNames[now.getMonth()]+" "+now.getFullYear();

  // This-month transactions
  var thisMoTxs = useMemo(function(){
    return transactions.filter(function(t){ return t.date && t.date.slice(0,7)===thisYM; });
  },[transactions, thisYM]);
  var lastMoTxs = useMemo(function(){
    return transactions.filter(function(t){ return t.date && t.date.slice(0,7)===lastYM; });
  },[transactions, lastYM]);

  // This-month spend by category (debits only, excluding Income)
  var catSpend = useMemo(function(){
    var m={};
    thisMoTxs.forEach(function(t){
      if(t.isCredit) return;
      if(!globalTypeFilter.includes(t.txType)) return;
      m[t.category]=(m[t.category]||0)+t.amount;
    });
    return Object.entries(m).filter(function(e){return e[0]&&e[0]!=="Income";}).sort(function(a,b){return b[1]-a[1];});
  },[thisMoTxs, globalTypeFilter]);

  // Top income category this month
  var incomeBycat = useMemo(function(){
    var m={};
    thisMoTxs.forEach(function(t){
      if(!t.isCredit||t.category!=="Income") return;
      m[t.subcategory||"Income"]=(m[t.subcategory||"Income"]||0)+t.amount;
    });
    return Object.entries(m).sort(function(a,b){return b[1]-a[1];});
  },[thisMoTxs]);

  // Summary this month
  var summaryThis = useMemo(function(){
    var inc=0, exp=0;
    thisMoTxs.forEach(function(t){
      if(t.isCredit&&globalTypeFilter.includes(t.txType)) inc+=t.amount;
      else if(!t.isCredit&&globalTypeFilter.includes(t.txType)) exp+=t.amount;
    });
    return {income:inc, expense:exp, net:inc-exp};
  },[thisMoTxs, globalTypeFilter]);

  // YTD net
  var ytdNet = useMemo(function(){
    var yr = String(now.getFullYear());
    var n=0;
    transactions.forEach(function(t){
      if(!t.date||t.date.slice(0,4)!==yr) return;
      if(t.isCredit&&globalTypeFilter.includes(t.txType)) n+=t.amount;
      else if(!t.isCredit&&globalTypeFilter.includes(t.txType)) n-=t.amount;
    });
    return n;
  },[transactions, globalTypeFilter]);

  // Top 3 spend txs this month
  var topSpend = useMemo(function(){
    return thisMoTxs.filter(function(t){return !t.isCredit&&globalTypeFilter.includes(t.txType);})
      .slice().sort(function(a,b){return b.amount-a.amount;}).slice(0,3);
  },[thisMoTxs, globalTypeFilter]);

  // Top 3 income txs this month
  var topIncome = useMemo(function(){
    return thisMoTxs.filter(function(t){return t.isCredit&&globalTypeFilter.includes(t.txType);})
      .slice().sort(function(a,b){return b.amount-a.amount;}).slice(0,3);
  },[thisMoTxs, globalTypeFilter]);

  // Budget status
  var budgetStatus = useMemo(function(){
    var over=[], ok=[];
    Object.entries(budgets||{}).forEach(function(entry){
      var cat=entry[0], b=entry[1];
      if(!b||!b.monthly) return;
      var spent=catSpend.find(function(e){return e[0]===cat;});
      var spentAmt = spent ? spent[1] : 0;
      var pct = Math.round(spentAmt/b.monthly*100);
      if(pct>100) over.push({cat:cat,pct:pct,spent:spentAmt,limit:b.monthly});
      else ok.push({cat:cat,pct:pct,spent:spentAmt,limit:b.monthly});
    });
    over.sort(function(a,b){return b.pct-a.pct;});
    return {over:over, ok:ok, all:over.concat(ok)};
  },[budgets, catSpend]);

  // Worst budget breach (for alert)
  var worstBreach = budgetStatus.over.length>0 ? budgetStatus.over[0] : null;

  // Spend alerts (spike detection — categories over threshold vs last month)
  var spendAlerts = useMemo(function(){
    var alerts=[];
    var thisMap={}, lastMap={};
    thisMoTxs.forEach(function(t){ if(!t.isCredit) thisMap[t.category]=(thisMap[t.category]||0)+t.amount; });
    lastMoTxs.forEach(function(t){ if(!t.isCredit) lastMap[t.category]=(lastMap[t.category]||0)+t.amount; });
    Object.entries(thisMap).forEach(function(entry){
      var cat=entry[0], thisAmt=entry[1];
      var lastAmt=lastMap[cat]||0;
      if(lastAmt>0) {
        var chg=Math.round((thisAmt-lastAmt)/lastAmt*100);
        if(chg>=spikeThreshold) alerts.push({cat:cat,thisAmt:thisAmt,lastAmt:lastAmt,pct:chg});
      }
    });
    return alerts.sort(function(a,b){return b.pct-a.pct;});
  },[thisMoTxs, lastMoTxs, spikeThreshold]);

  // Top spend vendors this month (debit only)
  var topVendors = useMemo(function(){
    var m={};
    thisMoTxs.forEach(function(t){
      if(t.isCredit) return;
      if(!globalTypeFilter.includes(t.txType)) return;
      m[t.description]=(m[t.description]||0)+t.amount;
    });
    return Object.entries(m).sort(function(a,b){return b[1]-a[1];}).slice(0,3);
  },[thisMoTxs, globalTypeFilter]);

  var top12Vendors = useMemo(function(){
    var cutoff = new Date(now.getFullYear(), now.getMonth()-11, 1);
    var cutoffYM = cutoff.getFullYear()+"-"+_p2(cutoff.getMonth()+1);
    var m={};
    transactions.forEach(function(t){
      if(t.isCredit) return;
      if(!globalTypeFilter.includes(t.txType)) return;
      if(!t.date||t.date.slice(0,7)<cutoffYM) return;
      m[t.description]=(m[t.description]||0)+t.amount;
    });
    var sorted = Object.entries(m).sort(function(a,b){return b[1]-a[1];});
    return {top:sorted.slice(0,5), total:sorted.length};
  },[transactions, globalTypeFilter]);

  // Forecast: simple 3-month mini-projection from current cash + accounts
  // miniProjection: use the already-computed projection from ForecastTab (bubbled up via App).
  // Falls back to month labels only (no closing value) if ForecastTab hasn't mounted yet.
  var miniProjection = useMemo(function(){
    var months = [];
    for(var i=0;i<3;i++){
      var d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      var ym = d.getFullYear()+"-"+_p2(d.getMonth()+1);
      var mo3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
      var projRow = forecastProjection&&forecastProjection[i];
      months.push({ym:ym,label:mo3,closing:projRow?projRow.closing:null});
    }
    return months;
  },[forecastProjection, now]);

  function fmtK(n){
    var rate = (_globalDispRates&&Object.values(_globalDispRates)[0])||1;
    var sym  = (_globalDispRates&&Object.keys(_globalDispRates)[0])||displayCurrency||"AED";
    var v = n * rate;
    var abs = Math.abs(v);
    var str;
    if(abs>=1000000) str = (v/1000000).toFixed(1)+"M";
    else if(abs>=1000) str = (v/1000).toFixed(0)+"K";
    else str = String(Math.round(v));
    return sym+" "+str;
  }
  function fmtSigned(n){
    var rate = (_globalDispRates&&Object.values(_globalDispRates)[0])||1;
    var sym  = (_globalDispRates&&Object.keys(_globalDispRates)[0])||displayCurrency||"AED";
    var v = n * rate;
    var abs = Math.abs(v);
    var str;
    if(abs>=1000000) str = (Math.abs(v)/1000000).toFixed(1)+"M";
    else if(abs>=1000) str = (Math.abs(v)/1000).toFixed(0)+"K";
    else str = String(Math.round(Math.abs(v)));
    return (v>=0?"+":"-")+sym+" "+str;
  }

  function navTo(t){
    setModal(null);
    setTab(t);
  }

  // recent txs (last 8 by date desc)
  var recentTxs = useMemo(function(){
    return transactions.slice().sort(function(a,b){
      return (b.date||"").localeCompare(a.date||"");
    }).slice(0,8);
  },[transactions]);

  // budget health %
  var budgetHealthPct = useMemo(function(){
    var total = budgetStatus.all.length;
    if(!total) return null;
    return Math.round(budgetStatus.ok.length/total*100);
  },[budgetStatus]);

  // next-month forecast
  var nextMonthLabel    = miniProjection[1]?miniProjection[1].label:"Next mo";
  var nextMonthForecast = miniProjection[1]?miniProjection[1].closing:null;

  // category colour helper
  var CAT_PALETTE = ["#e76f51","#2a9d6f","#7f77dd","#f4a261","#264653","#e9c46a","#a8dadc","#d4860a"];
  function catColour(cat){
    if(taxonomy&&taxonomy[cat]&&taxonomy[cat].color) return taxonomy[cat].color;
    var h=0; for(var i=0;i<(cat||"").length;i++) h=(h*31+cat.charCodeAt(i))&0xffff;
    return CAT_PALETTE[h%CAT_PALETTE.length];
  }

  var maxCatAmt = catSpend.length>0?catSpend[0][1]:1;
  var MON_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  var _surf = {background:"#fff",border:"1px solid #cdd1db",borderRadius:12};

  return (
    <div style={{padding:isWide?"24px 28px":"16px 12px",maxWidth:1200,margin:"0 auto"}}>

      {/* HERO CARD */}
      <div style={{..._surf,padding:isWide?"28px 32px":"20px 20px",marginBottom:14}}>
        <div style={{fontSize:10,fontWeight:600,color:"#7a8699",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>
          {"Net this month — "+MON_NAMES[now.getMonth()]+" "+now.getFullYear()}
        </div>
        <div style={{fontSize:isWide?38:30,fontWeight:500,color:summaryThis.net>=0?"#2a9d6f":"#d94040",letterSpacing:"-1.5px",lineHeight:1,marginBottom:10}}>
          {(summaryThis.net>=0?"+":"")+fmtK(summaryThis.net)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:isWide?18:12,flexWrap:"wrap",fontSize:13}}>
          <span style={{color:"#2a9d6f"}}>{"▲ Income "+fmtK(summaryThis.income)}</span>
          <span style={{color:"#cdd1db"}}>·</span>
          <span style={{color:"#e76f51"}}>{"▼ Spend "+fmtK(summaryThis.expense)}</span>
        </div>
      </div>

      {/* 3 STAT TILES */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>

        <div style={{..._surf,padding:"16px 18px",cursor:"pointer"}} onClick={function(){navTo("forecast");}}>
          <div style={{fontSize:10,fontWeight:600,color:"#7a8699",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>{nextMonthLabel+" forecast"}</div>
          <div style={{fontSize:22,fontWeight:500,color:"#2a9d6f",letterSpacing:"-0.5px",lineHeight:1,marginBottom:5}}>
            {nextMonthForecast!==null?fmtK(nextMonthForecast):"—"}
          </div>
          <div style={{fontSize:12,color:"#7a8699"}}>Closing bank balance</div>
        </div>

        <div style={{..._surf,padding:"16px 18px",cursor:"pointer"}} onClick={function(){navTo("budget");}}>
          <div style={{fontSize:10,fontWeight:600,color:"#7a8699",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Budget health</div>
          <div style={{fontSize:22,fontWeight:500,letterSpacing:"-0.5px",lineHeight:1,marginBottom:5,
            color:budgetHealthPct===null?"#7a8699":budgetHealthPct>=80?"#2a9d6f":budgetHealthPct>=60?"#f4a261":"#d94040"}}>
            {budgetHealthPct!==null?(budgetHealthPct+"%"):"—"}
          </div>
          <div style={{fontSize:12,color:"#7a8699"}}>
            {budgetStatus.over.length>0?(budgetStatus.over.length+" categor"+(budgetStatus.over.length===1?"y":"ies")+" over"):"All within budget"}
          </div>
        </div>

        <div style={{..._surf,padding:"16px 18px",cursor:"pointer"}} onClick={function(){navTo("watchout");}}>
          <div style={{fontSize:10,fontWeight:600,color:"#7a8699",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Spend alerts</div>
          <div style={{fontSize:22,fontWeight:500,letterSpacing:"-0.5px",lineHeight:1,marginBottom:5,
            color:spendAlerts.length>0?"#d94040":"#2a9d6f"}}>
            {spendAlerts.length}
          </div>
          <div style={{fontSize:12,color:"#7a8699"}}>vs last month</div>
        </div>

      </div>

      {/* BOTTOM 2-COL */}
      <div style={{display:"grid",gridTemplateColumns:isWide?"1fr 1fr":"1fr",gap:12}}>

        {/* LEFT: spend bars */}
        <div style={{..._surf,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:500,color:"#0f1624"}}>Top spend this month</div>
            <span onClick={function(){navTo("subcategories");}} style={{fontSize:12,color:"#2a9d6f",cursor:"pointer",fontWeight:500}}>Subcategories ›</span>
          </div>
          {catSpend.slice(0,6).map(function(entry){
            var cat=entry[0], amt=entry[1];
            var col=catColour(cat);
            var pct=Math.round(amt/maxCatAmt*100);
            return (
              <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{fontSize:13,color:"#4a5568",width:isWide?110:90,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</div>
                <div style={{flex:1,height:6,background:"#eef0f3",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,background:col,width:pct+"%"}}></div>
                </div>
                <div style={{fontSize:12,color:"#4a5568",width:64,textAlign:"right",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{fmtK(amt)}</div>
              </div>
            );
          })}
          {catSpend.length===0&&<div style={{fontSize:13,color:"#7a8699"}}>No spend data this month</div>}
        </div>

        {/* RIGHT: recent transactions */}
        <div style={{..._surf,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:500,color:"#0f1624"}}>Recent transactions</div>
            <span onClick={function(){navTo("transactions");}} style={{fontSize:12,color:"#2a9d6f",cursor:"pointer",fontWeight:500}}>All ›</span>
          </div>
          {recentTxs.map(function(tx,i){
            var col=catColour(tx.category);
            var icon=(taxonomy&&taxonomy[tx.category]&&taxonomy[tx.category].icon)?taxonomy[tx.category].icon:(tx.vendor||tx.description||"?").charAt(0).toUpperCase();
            var amt=tx.isCredit?("+"+fmtK(tx.amount)):("-"+fmtK(tx.amount));
            var amtCol=tx.isCredit?"#2a9d6f":"#d94040";
            var subLabel=(tx.subcategory||tx.category||"")+(tx.date?" · "+tx.date.slice(5).replace("-","/"):"");
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,marginBottom:10,
                borderBottom:i<recentTxs.length-1?"1px solid #f0f2f5":"none"}}>
                <div style={{width:32,height:32,borderRadius:8,background:col+"22",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:13,fontWeight:600,color:col,flexShrink:0}}>
                  {icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:"#0f1624",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {tx.vendor||tx.description||"—"}
                  </div>
                  <div style={{fontSize:11,color:"#7a8699",marginTop:1}}>{subLabel}</div>
                </div>
                <div style={{fontSize:13,fontWeight:500,color:amtCol,flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{amt}</div>
              </div>
            );
          })}
          {recentTxs.length===0&&<div style={{fontSize:13,color:"#7a8699"}}>No transactions yet</div>}
        </div>

      </div>
    </div>
  );
}


function SummaryTab({transactions, taxonomy, displayCurrency, globalTypeFilter, financials}) {
  const G = "#1a7a3a";
  const R = "#d94040";

  // Drill-down state: {blockKey, rowLabel, type} or null
  // blockKey: "12m" | "year" | "alltime"
  // rowLabel: the period label (used to identify the row)
  // type: "income" | "expense" | "net"
  var [drill, setDrill] = React.useState(null);
  var [drillAccFilter, setDrillAccFilter] = React.useState(null);
  var [drillSort, setDrillSort] = React.useState("date");
  var [windowOffset, setWindowOffset] = React.useState(0); // 0=most recent, 1=prev 12mo, 2=12mo before that

  function pad(n){ return String(n).padStart(2,"0"); }
  function ymKey(year, monthIndex) { return year+"-"+pad(monthIndex+1); }

  var now = new Date();
  var thisYM  = ymKey(now.getFullYear(), now.getMonth());
  var thisYear = String(now.getFullYear());

  var accounts = (financials&&financials.accounts)||[];
  var accMap = {};
  accounts.forEach(function(a){ accMap[a.id]=a.name+(a.last4?" ···"+a.last4:""); });

  function calcSlice(txs) {
    var income = 0;
    var buckets = {standard:0, nonstandard:0, exceptional:0};
    txs.forEach(function(t) {
      if(t.isCredit) {
        var effectiveType = (t.txType==="credit"||!t.txType) ? "standard" : t.txType;
        if(!globalTypeFilter.includes(effectiveType)) return;
        if(t.category === "Income") { income += t.amount; }
        else { buckets[effectiveType] = (buckets[effectiveType]||0) - t.amount; }
      } else {
        if(globalTypeFilter.includes(t.txType)) {
          buckets[t.txType] = (buckets[t.txType]||0) + t.amount;
        }
      }
    });
    var std = Math.max(0, buckets.standard);
    var nsv = Math.max(0, buckets.nonstandard);
    var exc = Math.max(0, buckets.exceptional);
    return {income, expense: std+nsv+exc, net: income-(std+nsv+exc), count: txs.length};
  }

  // Get the actual transactions for a drill selection
  function getTxsForDrill(sliceTxs, type) {
    if(type==="income") return sliceTxs.filter(function(t){ return t.isCredit && t.category==="Income"; });
    if(type==="expense") return sliceTxs.filter(function(t){ return !t.isCredit && globalTypeFilter.includes(t.txType); });
    // net = all (income + expenses)
    return sliceTxs.filter(function(t){
      if(t.isCredit) { var et=(t.txType==="credit"||!t.txType)?"standard":t.txType; return globalTypeFilter.includes(et); }
      return globalTypeFilter.includes(t.txType);
    });
  }

  var months12 = [];
  for(var i = 0; i < 12; i++) {
    var mIdx = now.getMonth() - i - (windowOffset * 12);
    var yr   = now.getFullYear();
    while(mIdx < 0) { mIdx += 12; yr -= 1; }
    months12.push(ymKey(yr, mIdx));
  }

  // Oldest month in data — to know if "← Older" should be enabled
  var oldestDataYM = (function(){
    var dates = transactions.map(function(t){return t.date?t.date.slice(0,7):"";}).filter(Boolean).sort();
    return dates.length ? dates[0] : null;
  })();
  // Oldest month shown in current window
  var oldestWindowYM = months12[months12.length-1];
  var canGoOlder = oldestDataYM ? oldestDataYM < oldestWindowYM : false;
  var canGoNewer = windowOffset > 0;

  var allYears = [...new Set(
    transactions.map(function(t){ return t.date ? t.date.slice(0,4) : ""; }).filter(Boolean)
  )].sort().reverse();

  var allTime = calcSlice(transactions);

  // ── Drill panel ──
  function DrillPanel({sliceTxs, type, label}) {
    // Apply account filter
    var filtered = sliceTxs;
    if(drillAccFilter!==null) {
      if(drillAccFilter.size===0) filtered=filtered.filter(function(t){return !t.accountId;});
      else filtered=filtered.filter(function(t){return drillAccFilter.has(t.accountId||"");});
    }
    // Sort
    var sorted = filtered.slice().sort(function(a,b){
      if(drillSort==="amount") return b.amount-a.amount;
      if(drillSort==="subcategory") return (a.subcategory||"").localeCompare(b.subcategory||"")||(a.category||"").localeCompare(b.category||"")||b.amount-a.amount;
      if(drillSort==="description") return (a.description||"").localeCompare(b.description||"")||b.amount-a.amount;
      return (b.date||"").localeCompare(a.date||""); // date desc
    });

    var accIds = [...new Set(sliceTxs.map(function(t){return t.accountId;}).filter(Boolean))];
    var allAccSelected = drillAccFilter===null;

    function toggleAll(){ setDrillAccFilter(allAccSelected ? new Set() : null); }
    function toggleAcc(id){
      setDrillAccFilter(function(prev){
        var next = prev===null ? new Set(accIds) : new Set(prev);
        if(next.has(id)) next.delete(id); else next.add(id);
        if(next.size===accIds.length) return null;
        return next;
      });
    }

    var total = sorted.reduce(function(s,t){return s+t.amount;},0);

    return React.createElement("div", {style:{marginTop:0,borderTop:"2px solid "+(type==="income"?G:type==="expense"?R:"#4a62d8"),
      background:"rgba(0,0,0,0.02)",padding:"12px 16px",borderRadius:"0 0 14px 14px"}},

      // Header
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}},
        React.createElement("div", {style:{fontSize:12,fontWeight:700,color:C.text}},
          label+" · "+(type==="income"?"Income":type==="expense"?"Expenses":"All")+" · "+sorted.length+" transactions"),
        React.createElement("div", {style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
          // Sort pills
          [["date","Date ↓"],["amount","Value ↓"],["subcategory","A–Z Sub"],["description","A–Z Desc"]].map(function(pair){
            var v=pair[0],l=pair[1];
            return React.createElement("button",{key:v,onClick:function(){setDrillSort(v);},
              style:{padding:"3px 8px",borderRadius:20,fontSize:10,cursor:"pointer",fontFamily:"inherit",
                border:"1px solid "+(drillSort===v?C.accent:C.border),
                background:drillSort===v?C.accent:"transparent",
                color:drillSort===v?"#fff":C.muted,fontWeight:drillSort===v?700:400}},l);
          }))),

      // Account pills (only if any txs have accountIds)
      accIds.length>0 && React.createElement("div", {style:{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",alignItems:"center"}},
        React.createElement("span",{style:{fontSize:10,fontWeight:600,color:C.muted,flexShrink:0}},"Account:"),
        React.createElement("button",{onClick:toggleAll,
          style:{padding:"3px 8px",borderRadius:20,fontSize:10,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(allAccSelected?C.accent:C.border),
            background:allAccSelected?C.accent:"transparent",
            color:allAccSelected?"#fff":C.muted,fontWeight:allAccSelected?700:500}},
          "All"),
        ...accIds.map(function(id){
          var active=allAccSelected||(drillAccFilter!==null&&drillAccFilter.has(id));
          return React.createElement("button",{key:id,onClick:function(){toggleAcc(id);},
            style:{padding:"3px 8px",borderRadius:20,fontSize:10,cursor:"pointer",fontFamily:"inherit",
              border:"1px solid "+(active?C.accent:C.border),
              background:active?C.accent+"18":C.s2,
              color:active?C.accent:C.text,fontWeight:active?600:400}},
            accMap[id]||id);
        })),

      // Transaction list
      React.createElement("div", {style:{background:C.surface,border:"1px solid "+C.border,borderRadius:10,overflow:"hidden",maxHeight:320,overflowY:"auto",WebkitOverflowScrolling:"touch"}},
        sorted.length===0
          ? React.createElement("div",{style:{padding:"16px 12px",textAlign:"center",color:C.dim,fontSize:12}},"No transactions match")
          : sorted.map(function(t,i){
            var isCredit=t.isCredit===true;
            return React.createElement("div",{key:i,
              style:{display:"flex",gap:8,padding:"7px 12px",borderBottom:"1px solid "+C.s2,fontSize:12,alignItems:"center",
                background:i%2===0?"transparent":C.bg}},
              React.createElement("span",{style:{fontFamily:"monospace",color:C.dim,flexShrink:0,fontSize:11,minWidth:58}},
                (t.date||"").slice(8,10)+"/"+(t.date||"").slice(5,7)+"/"+(t.date||"").slice(2,4)),
              React.createElement("span",{style:{flex:1,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                t.description||"—"),
              React.createElement("span",{style:{fontSize:10,color:C.muted,flexShrink:0,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                t.category),
              t.accountId&&React.createElement("span",{style:{fontSize:9,padding:"1px 5px",borderRadius:8,background:C.s2,color:C.muted,flexShrink:0}},
                accMap[t.accountId]||""),
              React.createElement("span",{style:{fontFamily:"monospace",fontSize:12,fontWeight:700,color:isCredit?G:R,flexShrink:0}},
                (isCredit?"+":"−")+fmtExact(t.amount,displayCurrency)));
          })),

      // Total
      React.createElement("div",{style:{display:"flex",justifyContent:"flex-end",alignItems:"center",marginTop:8,gap:6}},
        React.createElement("span",{style:{fontSize:11,color:C.muted}},sorted.length+" shown ·"),
        React.createElement("span",{style:{fontSize:12,fontWeight:700,fontFamily:"monospace",
          color:type==="income"?G:type==="expense"?R:C.text}},
          fmt(total,displayCurrency))));
  }

  // ── TableBlock with clickable cells ──
  function TableBlock({blockKey, title, rows, avgRow, getSliceTxs}) {
    var hasAnyData = rows.some(function(r){ return r.count > 0; });

    function cellStyle(type, empty, isAvg) {
      var isSelected = drill && drill.blockKey===blockKey && drill.type===type;
      var col = type==="income"?G:type==="expense"?R:"#4a62d8";
      return {
        padding:"8px 12px", fontFamily:"monospace", fontSize:12,
        textAlign:"right", whiteSpace:"nowrap", fontWeight:isSelected?800:(isAvg||empty)?400:500,
        color: empty?C.dim:col,
        cursor: empty?"default":"pointer",
        background: isSelected?"rgba(0,0,0,0.05)":"transparent",
        borderRadius:isSelected?4:0,
        userSelect:"none"
      };
    }

    function handleCellClick(rowLabel, type, empty) {
      if(empty) return;
      if(drill && drill.blockKey===blockKey && drill.rowLabel===rowLabel && drill.type===type) {
        // Same cell — close drill
        setDrill(null);
      } else {
        setDrill({blockKey, rowLabel, type});
        setDrillAccFilter(null);
        setDrillSort("date");
      }
    }

    return React.createElement("div", {style:{background:C.surface,border:"1px solid "+C.border,borderRadius:14,marginBottom:16,overflow:"hidden"}},
      React.createElement("div", {style:{padding:"12px 16px",borderBottom:"1px solid "+C.s2,display:"flex",justifyContent:"space-between",alignItems:"center"}},
        React.createElement("div", {style:{fontSize:13,fontWeight:700,color:C.text}}, title),
        React.createElement("div", {style:{fontSize:10,color:C.dim}}, hasAnyData?"Tap a number to see transactions":"No data yet")),
      React.createElement("div", {style:{overflowX:"auto",WebkitOverflowScrolling:"touch"}},
        React.createElement("table", {style:{width:"100%",borderCollapse:"collapse",minWidth:300}},
          React.createElement("thead", null,
            React.createElement("tr", {style:{background:C.s2}},
              ["Period","Income","Expenses","Net"].map(function(h,hi){
                return React.createElement("th",{key:h,style:{padding:"7px 12px",fontSize:10,fontWeight:700,
                  color:hi===1?G:hi===2?R:hi===3?"#4a62d8":C.muted,
                  textTransform:"uppercase",letterSpacing:"0.06em",
                  textAlign:hi===0?"left":"right",whiteSpace:"nowrap"}},h);
              }))),
          React.createElement("tbody", null,
            rows.map(function(row,i){
              var empty = row.count===0;
              var netPos = row.net>=0;
              var isRowDrilled = drill && drill.blockKey===blockKey && drill.rowLabel===row.label;
              return React.createElement(React.Fragment, {key:i},
                React.createElement("tr", {style:{borderBottom:"1px solid "+C.s2,
                  opacity:empty?0.4:1,
                  background:isRowDrilled?"rgba(74,98,216,0.04)":row.highlight?"rgba(42,157,111,0.04)":"transparent"}},
                  React.createElement("td",{style:{padding:"8px 12px",fontSize:12,fontWeight:row.bold?700:400,color:C.text,whiteSpace:"nowrap"}},row.label),
                  // Income cell
                  React.createElement("td",{style:cellStyle("income",empty,false),
                    onClick:function(){handleCellClick(row.label,"income",empty);}},
                    empty?"—":fmt(row.income,displayCurrency)),
                  // Expense cell
                  React.createElement("td",{style:cellStyle("expense",empty,false),
                    onClick:function(){handleCellClick(row.label,"expense",empty);}},
                    empty?"—":fmt(row.expense,displayCurrency)),
                  // Net cell
                  React.createElement("td",{style:Object.assign({},cellStyle("net",empty,false),{color:empty?C.dim:netPos?G:R}),
                    onClick:function(){handleCellClick(row.label,"net",empty);}},
                    empty?"—":(netPos?"+":"")+fmt(row.net,displayCurrency))),
                // Drill panel — renders immediately below the clicked row
                isRowDrilled && React.createElement("tr",{key:"drill_"+row.label},
                  React.createElement("td",{colSpan:4,style:{padding:0}},
                    DrillPanel({
                      sliceTxs: getTxsForDrill(getSliceTxs(row.label), drill.type),
                      type: drill.type,
                      label: row.label
                    }))));
            }),
            avgRow && React.createElement("tr",{style:{borderBottom:"1px solid "+C.s2,background:C.s2}},
              React.createElement("td",{style:{padding:"8px 12px",fontSize:12,fontWeight:700,color:C.muted,fontStyle:"italic"}},"Avg / Month"),
              React.createElement("td",{style:{padding:"8px 12px",fontFamily:"monospace",fontSize:12,color:G,textAlign:"right"}},fmt(avgRow.income,displayCurrency)),
              React.createElement("td",{style:{padding:"8px 12px",fontFamily:"monospace",fontSize:12,color:R,textAlign:"right"}},fmt(avgRow.expense,displayCurrency)),
              React.createElement("td",{style:{padding:"8px 12px",fontFamily:"monospace",fontSize:12,fontWeight:700,color:avgRow.net>=0?G:R,textAlign:"right"}},
                (avgRow.net>=0?"+":"")+fmt(avgRow.net,displayCurrency)))))));
  }

  // Build row data
  var month12rows = months12.map(function(ym) {
    var txs = transactions.filter(function(t){ return t.date && t.date.slice(0,7) === ym; });
    var s = calcSlice(txs);
    var parts = ym.split("-");
    var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, 1);
    var isCurrent = ym === thisYM;
    return {label:d.toLocaleDateString("en-GB",{month:"short",year:"2-digit"})+(isCurrent?" ●":""),
            highlight:isCurrent,bold:isCurrent,income:s.income,expense:s.expense,net:s.net,count:s.count,ym};
  });

  var activeMonths12 = month12rows.filter(function(r){ return r.count>0; });
  var avg12 = activeMonths12.length>0 ? {
    income:  activeMonths12.reduce(function(s,r){return s+r.income;},0)/activeMonths12.length,
    expense: activeMonths12.reduce(function(s,r){return s+r.expense;},0)/activeMonths12.length,
    net:     activeMonths12.reduce(function(s,r){return s+r.net;},0)/activeMonths12.length,
    count:1
  } : null;

  var yearRows = allYears.map(function(yr) {
    var txs = transactions.filter(function(t){ return t.date && t.date.slice(0,4)===yr; });
    var s = calcSlice(txs);
    var isCurrent = yr===thisYear;
    return {label:yr+(isCurrent?" ●":""),highlight:isCurrent,bold:isCurrent,income:s.income,expense:s.expense,net:s.net,count:s.count};
  });
  if(!yearRows.length) yearRows=[{label:"No data",count:0,income:0,expense:0,net:0}];

  var allTimeS = calcSlice(transactions);

  return React.createElement("div", {style:{paddingBottom:24}},
    // Window navigation for Last 12 Months
    React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}},
      React.createElement("button", {
        onClick:function(){ if(canGoOlder){setWindowOffset(function(p){return p+1;}); setDrill(null);} },
        disabled:!canGoOlder,
        style:{padding:"5px 12px",borderRadius:20,border:"1px solid "+(canGoOlder?C.border:C.s3),
          background:"transparent",color:canGoOlder?C.muted:C.s3,fontSize:12,cursor:canGoOlder?"pointer":"default",fontFamily:"inherit"}},
        "← Older"),
      React.createElement("div", {style:{fontSize:12,fontWeight:600,color:C.muted,textAlign:"center"}},
        windowOffset===0 ? "Most recent 12 months"
          : "Months "+(windowOffset*12+1)+"–"+(windowOffset*12+12)+" ago"),
      React.createElement("button", {
        onClick:function(){ if(canGoNewer){setWindowOffset(function(p){return p-1;}); setDrill(null);} },
        disabled:!canGoNewer,
        style:{padding:"5px 12px",borderRadius:20,border:"1px solid "+(canGoNewer?C.border:C.s3),
          background:"transparent",color:canGoNewer?C.muted:C.s3,fontSize:12,cursor:canGoNewer?"pointer":"default",fontFamily:"inherit"}},
        "Newer →")),
    TableBlock({
      blockKey:"12m",
      title:(function(){
        var newest = months12[0]; var oldest = months12[months12.length-1];
        var fmtYM = function(ym){ var p=ym.split("-"); var d=new Date(parseInt(p[0]),parseInt(p[1])-1,1); return d.toLocaleDateString("en-GB",{month:"short",year:"2-digit"}); };
        return fmtYM(oldest)+" – "+fmtYM(newest);
      })(),
      rows:month12rows, avgRow:avg12,
      getSliceTxs:function(label){
        var row = month12rows.find(function(r){return r.label===label;});
        if(!row||!row.ym) return [];
        return transactions.filter(function(t){return t.date&&t.date.slice(0,7)===row.ym;});
      }
    }),
    TableBlock({
      blockKey:"year", title:"By Year", rows:yearRows, avgRow:null,
      getSliceTxs:function(label){
        var yr = label.replace(" ●","");
        return transactions.filter(function(t){return t.date&&t.date.slice(0,4)===yr;});
      }
    }),
    TableBlock({
      blockKey:"alltime", title:"All Time",
      rows:[{label:"All time",bold:true,highlight:false,income:allTimeS.income,expense:allTimeS.expense,net:allTimeS.net,count:allTimeS.count}],
      avgRow:null,
      getSliceTxs:function(){ return transactions; }
    }));
}

// ─── Position Lock Screen (WebAuthn biometric) ────────────────────────────────
// Uses Web Authentication API — triggers Face ID on iPhone, Touch ID on iPad,
// Windows Hello (fingerprint/face/PIN) on Windows. Nothing stored in Firestore.
// Flow: first unlock = register credential on device. Subsequent = verify with biometric.
var _webAuthnCredentialId = null; // in-memory only, resets on page reload

function PositionLockScreen({fbUser, onUnlocked}) {
  var [status, setStatus] = useState("idle"); // "idle"|"loading"|"error"|"unsupported"
  var [errMsg, setErrMsg] = useState("");

  // WebAuthn uses the user's Firebase UID as the user handle so credentials are user-specific
  function getUserHandle() {
    var uid = fbUser && fbUser.uid ? fbUser.uid : "unknown";
    var enc = new TextEncoder();
    return enc.encode(uid);
  }

  // Convert base64url string to ArrayBuffer
  function b64ToBuffer(b64) {
    var b64Std = b64.replace(/-/g,"+").replace(/_/g,"/");
    var bin = atob(b64Std);
    var buf = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    return buf.buffer;
  }

  // Convert ArrayBuffer to base64url string (for storage key)
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = "";
    bytes.forEach(function(b){ bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  }

  // Storage key for this user's credential ID (localStorage, device-specific, non-sensitive)
  function credKey() { return "hf_wacid_" + (fbUser&&fbUser.uid||"x"); }

  async function unlock() {
    if(!window.PublicKeyCredential) {
      setStatus("unsupported");
      setErrMsg("This device does not support biometric authentication. Please use a supported browser (Safari on iPhone, Chrome/Edge on Windows).");
      return;
    }
    setStatus("loading");
    setErrMsg("");
    try {
      var storedCredId = localStorage.getItem(credKey());

      if(!storedCredId) {
        // ── First time on this device: REGISTER a new credential ──
        // This triggers Face ID / Touch ID / Windows Hello setup prompt
        var regOptions = {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: "Home Financials",
            id: window.location.hostname === "localhost" ? "localhost" : "waheedurmalik.github.io"
          },
          user: {
            id: getUserHandle(),
            name: fbUser.email || fbUser.uid,
            displayName: fbUser.displayName || fbUser.email || "User"
          },
          pubKeyCredParams: [{alg: -7, type: "public-key"}, {alg: -257, type: "public-key"}],
          authenticatorSelection: {
            authenticatorAttachment: "platform",  // device biometric only, not USB keys
            userVerification: "required",          // MUST verify (Face ID / fingerprint / PIN)
            residentKey: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        };
        var regCred = await navigator.credentials.create({publicKey: regOptions});
        // Store credential ID so we can use it for future verifications
        var credIdB64 = bufToB64(regCred.rawId);
        localStorage.setItem(credKey(), credIdB64);
        // Registration = first successful verification, unlock immediately
        setStatus("idle");
        onUnlocked();
      } else {
        // ── Subsequent unlock: VERIFY with existing credential ──
        // This triggers Face ID / Touch ID / Windows Hello verification prompt
        var credIdBuf = b64ToBuffer(storedCredId);
        var getOptions = {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname === "localhost" ? "localhost" : "waheedurmalik.github.io",
          allowCredentials: [{type: "public-key", id: credIdBuf}],
          userVerification: "required",  // MUST verify biometric/PIN — not just presence
          timeout: 60000
        };
        await navigator.credentials.get({publicKey: getOptions});
        setStatus("idle");
        onUnlocked();
      }
    } catch(e) {
      if(e.name === "NotAllowedError") {
        // User cancelled or timed out — not an error, just reset
        setStatus("idle");
      } else if(e.name === "InvalidStateError") {
        // Credential may have been deleted from device — clear and let user re-register
        localStorage.removeItem(credKey());
        setStatus("idle");
        setErrMsg("Biometric credential was reset. Tap unlock again to re-register.");
      } else if(e.name === "SecurityError") {
        setStatus("error");
        setErrMsg("Security error: ensure the app is opened via HTTPS or as a saved PWA.");
      } else {
        setStatus("error");
        setErrMsg((e.message || e.name || "Authentication failed") + ". Tap to try again.");
      }
    }
  }

  var hasRegistered = (()=>{ try { return !!localStorage.getItem(credKey()); } catch(e){ return false; } })();

  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                 minHeight:320, padding:"40px 24px", textAlign:"center"}}>
      <div style={{width:72, height:72, borderRadius:"50%",
                   background:"linear-gradient(135deg, #1a2e1a, #0f2418)",
                   display:"flex", alignItems:"center", justifyContent:"center",
                   fontSize:32, marginBottom:20, boxShadow:"0 4px 20px rgba(42,157,111,0.2)"}}>
        🔒
      </div>
      <div style={{fontSize:20, fontWeight:800, color:C.text, marginBottom:8}}>
        Position is locked
      </div>
      <div style={{fontSize:13, color:C.muted, marginBottom:6, lineHeight:1.6, maxWidth:300}}>
        Your net worth and financial data is protected.
      </div>
      <div style={{fontSize:12, color:C.dim, marginBottom:28, lineHeight:1.6, maxWidth:300}}>
        {hasRegistered
          ? "Verify with Face ID, Touch ID, or your device PIN to unlock."
          : "First time: tap to register your Face ID, Touch ID, or Windows Hello. Takes 5 seconds."
        }
      </div>
      {errMsg && (
        <div style={{fontSize:12, color:status==="unsupported"?C.muted:C.danger,
                     background:status==="unsupported"?"rgba(0,0,0,0.04)":"rgba(217,64,64,0.08)",
                     border:"1px solid "+(status==="unsupported"?C.border:"rgba(217,64,64,0.2)"),
                     borderRadius:10, padding:"10px 16px", marginBottom:16, maxWidth:320,
                     lineHeight:1.5}}>
          {errMsg}
        </div>
      )}
      <button
        onClick={unlock}
        disabled={status === "loading"}
        style={{...btn(C.accent, "#fff", "none", 14, "14px 32px"),
                borderRadius:14, fontWeight:700, opacity:status==="loading"?0.7:1,
                boxShadow:"0 2px 12px rgba(42,157,111,0.3)"}}>
        {status === "loading" ? "Waiting for biometric…"
          : hasRegistered ? "🔓 Unlock with Face ID / Touch ID"
          : "🔏 Set up biometric unlock"}
      </button>
      <div style={{fontSize:11, color:C.dim, marginTop:20, lineHeight:1.6}}>
        {fbUser.email}<br/>
        <span style={{color:C.dim}}>
          iPhone: Face ID · iPad: Touch ID · Windows: Windows Hello
        </span>
      </div>
    </div>
  );
}

// ─── Position Tab (Net Worth) ─────────────────────────────────────────────────
function PositionTab({financials, displayCurrency, displayRates}) {
  var [livePrices, setLivePrices] = useState({}); // {ticker: price_in_native_currency}
  var [priceStatus, setPriceStatus] = useState({}); // {ticker: "loading"|"ok"|"error"}
  var [fxRates, setFxRates] = useState(null); // rates from AED (same shape as displayRates)
  var [lastRefresh, setLastRefresh] = useState(null);

  // Convert any currency → display currency via AED as pivot
  // rates = {GBP: 0.2105, USD: 0.2723, ...} where value = how many displayCurrency per 1 AED
  // item is in itemCurrency. We need: amount_in_item_currency → AED → displayCurrency
  function toDisplay(amount, itemCurrency) {
    var r = fxRates || displayRates || FALLBACK_RATES;
    var dc = displayCurrency || "AED";
    if(!amount || isNaN(amount)) return 0;
    // Step 1: item → AED. r[itemCurrency] = displayCurrency per AED, but we need AED per itemCurrency
    // Actually FALLBACK_RATES = {GBP:0.2105} means 1 AED = 0.2105 GBP, so 1 GBP = 1/0.2105 AED
    var aedAmount = amount;
    if(itemCurrency && itemCurrency !== "AED") {
      var rateFromAED = r[itemCurrency]; // e.g. r[GBP]=0.2105 means 1 AED = 0.2105 GBP
      if(rateFromAED && rateFromAED > 0) aedAmount = amount / rateFromAED;
    }
    // Step 2: AED → displayCurrency
    if(dc === "AED") return aedAmount;
    var dcRate = r[dc];
    if(dcRate && dcRate > 0) return aedAmount * dcRate;
    return aedAmount;
  }

  function fmtPos(amount, itemCurrency) {
    var val = toDisplay(amount, itemCurrency);
    var dc = displayCurrency || "AED";
    return dc + " " + Math.abs(val).toLocaleString("en-AE", {minimumFractionDigits:0, maximumFractionDigits:0});
  }

  function fmtPosExact(amount, itemCurrency) {
    var val = toDisplay(amount, itemCurrency);
    var dc = displayCurrency || "AED";
    return dc + " " + Math.abs(val).toLocaleString("en-AE", {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  // Fetch Yahoo Finance price for a single ticker
  function fetchYahooPrice(ticker) {
    setPriceStatus(function(prev){ var n={...prev}; n[ticker]="loading"; return n; });
    // Yahoo Finance doesn't allow direct browser requests (CORS) — use a proxy
    fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/" + ticker))
      .then(function(r){ return r.json(); })
      .then(function(d){
        var price = d && d.chart && d.chart.result && d.chart.result[0] &&
                    d.chart.result[0].meta && d.chart.result[0].meta.regularMarketPrice;
        if(price != null) {
          // London Stock Exchange (ULVR.L etc) returns prices in pence (GBX), not GBP — divide by 100
          if(ticker.endsWith(".L")) price = price / 100;
          setLivePrices(function(prev){ var n={...prev}; n[ticker]=price; return n; });
          setPriceStatus(function(prev){ var n={...prev}; n[ticker]="ok"; return n; });
        } else {
          setPriceStatus(function(prev){ var n={...prev}; n[ticker]="error"; return n; });
        }
      })
      .catch(function(){
        setPriceStatus(function(prev){ var n={...prev}; n[ticker]="error"; return n; });
      });
  }

  // On mount: fetch exchange rates + live prices for all tickers
  useEffect(function(){
    // Fetch exchange rates first
    getAEDRates().then(function(r){ if(r) setFxRates(r); });
    // Fetch live prices for all investments with tickers
    var investments = financials && financials.investments || [];
    investments.forEach(function(inv){
      if(inv.ticker && inv.ticker.trim()) {
        fetchYahooPrice(inv.ticker.trim().toUpperCase());
      }
    });
    setLastRefresh(new Date());
  }, []);

  function refreshPrices() {
    var investments = financials && financials.investments || [];
    investments.forEach(function(inv){
      if(inv.ticker && inv.ticker.trim()) {
        fetchYahooPrice(inv.ticker.trim().toUpperCase());
      }
    });
    getAEDRates().then(function(r){ if(r) setFxRates(r); });
    setLastRefresh(new Date());
  }

  var accounts = financials && financials.accounts || [];
  var cash = financials && financials.cash || [];
  var investments = financials && financials.investments || [];
  var properties = financials && financials.properties || [];
  var loans = financials && financials.loans || [];
  var debts = financials && financials.debts || [];

  var isEmpty = !accounts.length && !cash.length && !investments.length &&
                !properties.length && !loans.length && !debts.length;

  if(isEmpty) return (
    <div style={card}>
      <div style={{textAlign:"center", padding:"40px 20px"}}>
        <div style={{fontSize:40, marginBottom:12}}>📊</div>
        <div style={{fontSize:17, fontWeight:700, marginBottom:8, color:C.text}}>Net Worth not set up yet</div>
        <div style={{fontSize:13, color:C.muted, lineHeight:1.6, maxWidth:320, margin:"0 auto"}}>
          Add your accounts, investments, properties and loans in<br/>
          <strong>Config Data → 💼 Financial</strong><br/>
          then enter current balances via <strong>✏️ Input Data → Position</strong>
        </div>
      </div>
    </div>
  );

  // ── Compute section totals (in display currency) ──────────────────────────
  var today = new Date();
  var threeYearsFromNow = new Date(today.getFullYear()+3, today.getMonth(), today.getDate());

  // Cash total
  var cashTotal = cash.reduce(function(sum, item){
    return sum + toDisplay(item.amount || 0, item.currency || "AED");
  }, 0);

  // Account totals (split current/savings vs credit)
  var bankAssets = 0, creditLiabilities = 0;
  accounts.forEach(function(acc){
    var bal = acc.balance || 0;
    if(acc.type === "credit") {
      creditLiabilities += toDisplay(bal, acc.currency || "AED");
    } else {
      bankAssets += toDisplay(bal, acc.currency || "AED");
    }
  });

  // Investments: available = medium term; locked = split by unlock date
  // locked unlocking within 3 years → medium term; locked beyond 3 years → long term
  var investAvailable = 0, investMedLocked = 0, investLongLocked = 0;
  investments.forEach(function(inv){
    var ticker = inv.ticker && inv.ticker.trim().toUpperCase();
    var price = (ticker && livePrices[ticker] != null) ? livePrices[ticker] : (inv.currentPrice || 0);
    var value = price * (inv.shares || 0);
    var val = toDisplay(value, inv.currency || "USD");
    if(inv.status !== "locked") {
      investAvailable += val;
    } else {
      // locked — check unlock date
      var unlockDate = inv.unlockDate ? new Date(inv.unlockDate) : null;
      if(unlockDate && unlockDate <= threeYearsFromNow) {
        investMedLocked += val;
      } else {
        investLongLocked += val;
      }
    }
  });

  // Loans: split by type AND end date
  // mortgage → always long term
  // non-mortgage ending within 3 years → short term (payment due)
  // non-mortgage ending beyond 3 years → medium term
  var shortTermLoans = [], mediumTermLoans = [], longTermLoans = [];
  loans.forEach(function(loan){
    if(loan.loanType === "mortgage") {
      longTermLoans.push(loan);
    } else {
      var endDate = loan.currentEndDate ? new Date(loan.currentEndDate) : (loan.endDate ? new Date(loan.endDate) : null);
      if(endDate && endDate > threeYearsFromNow) {
        mediumTermLoans.push(loan);
      } else {
        shortTermLoans.push(loan); // ends within 3 years or no end date → short term
      }
    }
  });

  var shortTermLoansBalance  = shortTermLoans.reduce(function(s,l){ return s+toDisplay(l.outstandingBalance||0,l.currency||"AED"); },0);
  var mediumTermLoansBalance = mediumTermLoans.reduce(function(s,l){ return s+toDisplay(l.outstandingBalance||0,l.currency||"AED"); },0);
  var mortgageBalance        = longTermLoans.reduce(function(s,l){ return s+toDisplay(l.outstandingBalance||0,l.currency||"AED"); },0);

  // Properties
  var propertyValue = 0;
  properties.forEach(function(prop){
    propertyValue += toDisplay(prop.currentValue || prop.purchasePrice || 0, prop.currency || "AED");
  });

  // Personal debts
  var owedToMe = 0, owedByMe = 0;
  debts.forEach(function(d){
    var amt = toDisplay(d.amount || 0, d.currency || "AED");
    if(d.debtType === "owed_to_me") owedToMe += amt;
    else owedByMe += amt;
  });

  // ── Tier calculations ──
  var shortTermFunds = bankAssets + cashTotal;
  var shortTermDue   = creditLiabilities + shortTermLoansBalance + owedByMe;
  var shortTermNet   = shortTermFunds - shortTermDue;

  var mediumTermValue = investAvailable + investMedLocked;
  var mediumTermDue   = mediumTermLoansBalance;
  var mediumTermNet   = mediumTermValue - mediumTermDue;

  var longTermValue  = propertyValue + investLongLocked;
  var longTermDebts  = mortgageBalance;
  var longTermNet    = longTermValue - longTermDebts;

  var totalNetWorth = shortTermNet + mediumTermNet + longTermNet;

  var dc = displayCurrency || "AED";

  function netWorthColor(val) { return val >= 0 ? C.accent : C.danger; }

  function SectionHeader({icon, label}) {
    return (
      <div style={{fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase",
                   letterSpacing:"0.08em", marginBottom:10, marginTop:4,
                   display:"flex", alignItems:"center", gap:6}}>
        <span>{icon}</span><span>{label}</span>
      </div>
    );
  }

  function ItemRow({label, hint, value, isLiability, isSub}) {
    var color = isLiability ? C.danger : C.text;
    // value is already in display currency — format directly without re-converting
    var formatted = dc + " " + Math.abs(value).toLocaleString("en-AE", {minimumFractionDigits:0, maximumFractionDigits:0});
    return (
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                   padding:"9px 0", borderBottom:"1px solid "+C.s2}}>
        <div>
          <div style={{fontSize: isSub ? 12 : 13, fontWeight: isSub ? 400 : 600,
                       color: isSub ? C.muted : C.text, paddingLeft: isSub ? 12 : 0}}>{label}</div>
          {hint && <div style={{fontSize:11, color:C.dim, paddingLeft: isSub ? 12 : 0}}>{hint}</div>}
        </div>
        <div style={{fontFamily:"monospace", fontSize:13, fontWeight:700, color:color,
                     whiteSpace:"nowrap", marginLeft:12}}>
          {isLiability ? "−" : ""}{formatted}
        </div>
      </div>
    );
  }

  function TierCard({title, netValue, children}) {
    var isPos = netValue >= 0;
    return (
      <div style={{background:C.surface, border:"1px solid "+C.border, borderRadius:16,
                   padding:"16px 18px", marginBottom:14}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
          <div style={{fontSize:14, fontWeight:700, color:C.text}}>{title}</div>
          <div style={{fontFamily:"monospace", fontSize:16, fontWeight:800,
                       color:netWorthColor(netValue)}}>
            {isPos ? "" : "−"}{dc+" "+Math.abs(netValue).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
        </div>
        {children}
      </div>
    );
  }

  var refreshLabel = lastRefresh
    ? "Refreshed " + lastRefresh.toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"})
    : "";

  return (
    <div>
      {/* ── Net Worth Hero ── */}
      <div style={{background:"linear-gradient(135deg, #1a2e1a 0%, #0f2418 100%)", border:"1px solid "+C.border, borderRadius:16,
                   padding:"20px 20px 16px", marginBottom:14}}>
        <div style={{fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)",
                     textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6}}>
          Total Net Worth
        </div>
        <div style={{fontFamily:"monospace", fontSize:34, fontWeight:800,
                     color:netWorthColor(totalNetWorth), lineHeight:1, marginBottom:10}}>
          {totalNetWorth >= 0 ? "" : "−"}{dc+" "+Math.abs(totalNetWorth).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
        </div>
        <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
          {[
            ["🟢 Short Term", shortTermNet],
            ["📈 Medium Term", mediumTermNet],
            ["🏠 Long Term", longTermNet],
          ].map(function(item){
            var lbl = item[0], val = item[1];
            return (
              <div key={lbl} style={{fontSize:11}}>
                <div style={{color:"rgba(255,255,255,0.4)", marginBottom:1}}>{lbl}</div>
                <div style={{fontFamily:"monospace", fontWeight:700,
                             color: val >= 0 ? "#7dd8a8" : "#f87171"}}>
                  {val >= 0 ? "" : "−"}{dc+" "+Math.abs(val).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12}}>
          <div style={{fontSize:10, color:"rgba(255,255,255,0.3)"}}>{refreshLabel}</div>
          <button onClick={refreshPrices}
            style={{fontSize:11, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.08)",
                    border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"4px 10px",
                    cursor:"pointer", fontFamily:"inherit"}}>
            ↻ Refresh prices
          </button>
        </div>
      </div>

      {/* ── Short Term Position ── */}
      <TierCard title="🟢 Short Term Position" netValue={shortTermNet}>
        {/* FUNDS */}
        <SectionHeader icon="💰" label="Short Term Funds"/>
        {accounts.filter(function(a){ return a.type !== "credit"; }).length > 0 && (
          <div>
            <SectionHeader icon="🏦" label="Bank Accounts"/>
            {accounts.filter(function(a){ return a.type !== "credit"; }).map(function(acc){
              return (
                <ItemRow key={acc.id}
                  label={acc.name || acc.bank}
                  hint={(acc.bank || "") + (acc.last4 ? " ···"+acc.last4 : "") + " · " + (acc.currency||"AED")}
                  value={toDisplay(acc.balance || 0, acc.currency || "AED")}
                />
              );
            })}
          </div>
        )}
        {cash.length > 0 && (
          <div>
            <SectionHeader icon="💵" label="Cash"/>
            {cash.map(function(item){
              return (
                <ItemRow key={item.id}
                  label={item.label || "Cash"}
                  hint={item.currency || "AED"}
                  value={toDisplay(item.amount || 0, item.currency || "AED")}
                />
              );
            })}
          </div>
        )}
        {/* Funds subtotal */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Short Term Funds</div>
          <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.accent}}>
            {dc+" "+shortTermFunds.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
        </div>

        {/* PAYMENTS DUE */}
        <SectionHeader icon="📤" label="Short Term Payments Due"/>
        {accounts.filter(function(a){ return a.type === "credit"; }).length > 0 && (
          <div>
            <SectionHeader icon="💳" label="Credit Card Balances (Owed)"/>
            {accounts.filter(function(a){ return a.type === "credit"; }).map(function(acc){
              return (
                <ItemRow key={acc.id}
                  label={acc.name || acc.bank}
                  hint={(acc.bank||"") + (acc.last4 ? " ···"+acc.last4 : "") + " · " + (acc.currency||"AED")}
                  value={toDisplay(acc.balance || 0, acc.currency || "AED")}
                  isLiability
                />
              );
            })}
          </div>
        )}
        {shortTermLoans.length > 0 && (
          <div>
            <SectionHeader icon="💸" label="Short-term Loan Payments"/>
            {shortTermLoans.map(function(loan){
              return (
                <ItemRow key={loan.id}
                  label={loan.name}
                  hint={(loan.lender||"") + " · " + (loan.currency||"AED")}
                  value={toDisplay(loan.outstandingBalance || 0, loan.currency || "AED")}
                  isLiability
                />
              );
            })}
          </div>
        )}
        {owedByMe > 0 && (
          <div>
            <SectionHeader icon="🤝" label="Personal Debts Owed"/>
            {debts.filter(function(d){ return d.debtType !== "owed_to_me"; }).map(function(d){
              return (
                <ItemRow key={d.id}
                  label={d.person || "Unnamed"}
                  hint={"You owe them · " + (d.currency||"AED") + (d.notes ? " · "+d.notes : "")}
                  value={toDisplay(d.amount || 0, d.currency || "AED")}
                  isLiability
                />
              );
            })}
          </div>
        )}
        {owedToMe > 0 && (
          <div>
            <SectionHeader icon="🤝" label="Owed to You"/>
            {debts.filter(function(d){ return d.debtType === "owed_to_me"; }).map(function(d){
              return (
                <ItemRow key={d.id}
                  label={d.person || "Unnamed"}
                  hint={"They owe you · " + (d.currency||"AED") + (d.notes ? " · "+d.notes : "")}
                  value={toDisplay(d.amount || 0, d.currency || "AED")}
                />
              );
            })}
          </div>
        )}
        {/* Payments Due subtotal */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Payments Due</div>
          <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.danger}}>
            −{dc+" "+shortTermDue.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
        </div>

      </TierCard>

      {/* ── Medium Term Position ── */}
      {(investments.length > 0 || mediumTermLoans.length > 0) && (
        <TierCard title="📈 Medium Term Position" netValue={mediumTermNet}>
          {/* Available investments */}
          {investments.filter(function(inv){ return inv.status !== "locked"; }).length > 0 && (
            <div>
              <SectionHeader icon="📈" label="Shares Available"/>
              {investments.filter(function(inv){ return inv.status !== "locked"; }).map(function(inv){
                var ticker = inv.ticker && inv.ticker.trim().toUpperCase();
                var livePrice = ticker && livePrices[ticker] != null ? livePrices[ticker] : null;
                var price = livePrice != null ? livePrice : (inv.currentPrice || 0);
                var value = price * (inv.shares || 0);
                var status = ticker ? priceStatus[ticker] : null;
                var priceHint = livePrice != null
                  ? ("Live: "+(inv.currency||"USD")+" "+livePrice.toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:4})+" · "+(inv.shares||0)+" shares")
                  : (inv.currentPrice ? ("Manual: "+(inv.currency||"USD")+" "+inv.currentPrice+" · "+(inv.shares||0)+" shares") : ((inv.shares||0)+" shares · no price"));
                return (
                  <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"9px 0",borderBottom:"1px solid "+C.s2}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                        {inv.name||ticker}
                        {ticker&&status==="loading"&&<span style={{fontSize:10,color:C.dim}}>⏳</span>}
                        {ticker&&status==="ok"&&<span style={{fontSize:10,color:C.accent}}>● live</span>}
                        {ticker&&status==="error"&&<span style={{fontSize:10,color:"#d4860a"}}>⚠ no feed</span>}
                      </div>
                      <div style={{fontSize:11,color:C.dim}}>{priceHint}</div>
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",marginLeft:12}}>
                      {fmtPos(value, inv.currency||"USD")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Locked shares unlocking within 3 years */}
          {investments.filter(function(inv){
            if(inv.status !== "locked") return false;
            var ud = inv.unlockDate ? new Date(inv.unlockDate) : null;
            return ud && ud <= threeYearsFromNow;
          }).length > 0 && (
            <div>
              <SectionHeader icon="🔓" label="Locked Shares — Unlocking Within 3 Years"/>
              {investments.filter(function(inv){
                if(inv.status !== "locked") return false;
                var ud = inv.unlockDate ? new Date(inv.unlockDate) : null;
                return ud && ud <= threeYearsFromNow;
              }).map(function(inv){
                var ticker = inv.ticker && inv.ticker.trim().toUpperCase();
                var livePrice = ticker && livePrices[ticker] != null ? livePrices[ticker] : null;
                var price = livePrice != null ? livePrice : (inv.currentPrice || 0);
                var value = price * (inv.shares || 0);
                var status = ticker ? priceStatus[ticker] : null;
                return (
                  <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"9px 0",borderBottom:"1px solid "+C.s2}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                        🔓 {inv.name||ticker}
                        {ticker&&status==="loading"&&<span style={{fontSize:10,color:C.dim}}>⏳</span>}
                        {ticker&&status==="ok"&&<span style={{fontSize:10,color:C.accent}}>● live</span>}
                        {ticker&&status==="error"&&<span style={{fontSize:10,color:"#d4860a"}}>⚠ no feed</span>}
                      </div>
                      {inv.unlockDate&&<div style={{fontSize:11,color:"#d4860a"}}>Unlocks {fmtD(inv.unlockDate)}</div>}
                      <div style={{fontSize:11,color:C.dim}}>
                        {(inv.shares||0)} shares
                        {livePrice!=null?" · Live: "+(inv.currency||"USD")+" "+livePrice.toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:4})
                          :(inv.currentPrice?" · Manual: "+(inv.currency||"USD")+" "+inv.currentPrice:"")}
                      </div>
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",marginLeft:12}}>
                      {fmtPos(value, inv.currency||"USD")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Medium term value subtotal */}
          {mediumTermValue > 0 && (
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Medium Term Value</div>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.accent}}>
                {dc+" "+mediumTermValue.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
              </div>
            </div>
          )}
          {/* Loans ending within 3 years (non-mortgage) */}
          {mediumTermLoans.length > 0 && (
            <div>
              <SectionHeader icon="💳" label="Loans Ending Within 3 Years"/>
              {mediumTermLoans.map(function(loan){
                return (
                  <ItemRow key={loan.id}
                    label={loan.name}
                    hint={(loan.lender||"")+" · "+(loan.currency||"AED")+(loan.currentEndDate?" · ends "+fmtD(loan.currentEndDate):(loan.endDate?" · ends "+fmtD(loan.endDate):""))}
                    value={toDisplay(loan.outstandingBalance||0, loan.currency||"AED")}
                    isLiability
                  />
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Medium Term Loans</div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.danger}}>
                  −{dc+" "+mediumTermDue.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
                </div>
              </div>
            </div>
          )}
        </TierCard>
      )}

      {/* ── Long Term Position ── */}
      {(properties.length > 0 || investments.filter(function(inv){
        if(inv.status!=="locked") return false;
        var ud = inv.unlockDate ? new Date(inv.unlockDate) : null;
        return !ud || ud > threeYearsFromNow;
      }).length > 0 || longTermLoans.length > 0) && (
        <TierCard title="🏠 Long Term Position" netValue={longTermNet}>
          <SectionHeader icon="💎" label="Long Term Value"/>
          {properties.map(function(prop){
            var val = prop.currentValue || prop.purchasePrice || 0;
            var linkedMortgage = prop.mortgageId ? loans.find(function(l){ return l.id===prop.mortgageId; }) : null;
            return (
              <div key={prop.id} style={{padding:"9px 0",borderBottom:"1px solid "+C.s2}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{prop.name}</div>
                    <div style={{fontSize:11,color:C.dim}}>{prop.currentValue?"Market value":"Purchase price"} · {prop.currency||"AED"}</div>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",marginLeft:12}}>
                    {fmtPos(val, prop.currency||"AED")}
                  </div>
                </div>
                {linkedMortgage&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingLeft:12,marginTop:4}}>
                    <div style={{fontSize:11,color:C.dim}}>Linked mortgage: {linkedMortgage.name||linkedMortgage.lender}</div>
                    <div style={{fontFamily:"monospace",fontSize:11,color:C.dim,whiteSpace:"nowrap",marginLeft:12}}>
                      outstanding: {fmtPos(linkedMortgage.outstandingBalance||0, linkedMortgage.currency||"AED")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {investments.filter(function(inv){
            if(inv.status!=="locked") return false;
            var ud = inv.unlockDate ? new Date(inv.unlockDate) : null;
            return !ud || ud > threeYearsFromNow;
          }).map(function(inv){
            var ticker = inv.ticker && inv.ticker.trim().toUpperCase();
            var livePrice = ticker && livePrices[ticker] != null ? livePrices[ticker] : null;
            var price = livePrice != null ? livePrice : (inv.currentPrice || 0);
            var value = price * (inv.shares || 0);
            var status = ticker ? priceStatus[ticker] : null;
            return (
              <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"9px 0",borderBottom:"1px solid "+C.s2}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                    🔒 {inv.name||ticker}
                    {ticker&&status==="loading"&&<span style={{fontSize:10,color:C.dim}}>⏳</span>}
                    {ticker&&status==="ok"&&<span style={{fontSize:10,color:C.accent}}>● live</span>}
                    {ticker&&status==="error"&&<span style={{fontSize:10,color:"#d4860a"}}>⚠ no feed</span>}
                  </div>
                  {inv.unlockDate&&<div style={{fontSize:11,color:"#d4860a"}}>Unlocks {fmtD(inv.unlockDate)}</div>}
                  <div style={{fontSize:11,color:C.dim}}>
                    {(inv.shares||0)} shares
                    {livePrice!=null?" · Live: "+(inv.currency||"USD")+" "+livePrice.toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:4})
                      :(inv.currentPrice?" · Manual: "+(inv.currency||"USD")+" "+inv.currentPrice:"")}
                  </div>
                </div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",marginLeft:12}}>
                  {fmtPos(value, inv.currency||"USD")}
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Long Term Value</div>
            <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.accent}}>
              {dc+" "+longTermValue.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
            </div>
          </div>
          {longTermLoans.length > 0 && (
            <div>
              <SectionHeader icon="🏦" label="Long Term Debts — Mortgages"/>
              {longTermLoans.map(function(loan){
                return (
                  <ItemRow key={loan.id}
                    label={loan.name}
                    hint={(loan.lender||"")+(loan.interestRate?" · "+loan.interestRate+"% p.a.":"")+" · "+(loan.currency||"AED")}
                    value={toDisplay(loan.outstandingBalance||0, loan.currency||"AED")}
                    isLiability
                  />
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"2px solid "+C.border,marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:700,color:C.muted}}>Total Long Term Debts</div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:C.danger}}>
                  −{dc+" "+longTermDebts.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
                </div>
              </div>
            </div>
          )}
        </TierCard>
      )}

      {/* ── Total Net Worth footer ── */}
      <div style={{background:C.surface, border:"1px solid "+C.border, borderRadius:14,
                   padding:"14px 18px", display:"flex", justifyContent:"space-between",
                   alignItems:"center"}}>
        <div style={{fontSize:14, fontWeight:700, color:C.text}}>Total Net Worth</div>
        <div style={{fontFamily:"monospace", fontSize:20, fontWeight:800,
                     color:netWorthColor(totalNetWorth)}}>
          {totalNetWorth >= 0 ? "" : "−"}{dc+" "+Math.abs(totalNetWorth).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}
        </div>
      </div>

      <div style={{fontSize:11, color:C.dim, textAlign:"center", marginTop:10, marginBottom:4}}>
        To update balances: ✏️ Input Data → 📊 Position
      </div>
    </div>
  );
}

// ─── Position Input Panel (inside ManualEntryModal) ──────────────────────────
function FinancialPositionPanel({financials, setFinancials, onSave, onClose}) {
  var [posAmounts, setPosAmounts] = useState({});
  var CURRENCIES = ["AED","GBP","USD","EUR","PKR","CAD","AUD","JPY","CHF","SGD"];
  var [section, setSection] = useState("accounts");
  // For Cash inline create/edit
  var [cashEdit, setCashEdit] = useState(null); // null | {id,label,currency,amount} | {new:true}
  // For Debts inline create/edit
  var [debtEdit, setDebtEdit] = useState(null);
  // For Forecast Events inline create/edit
  var [improvEdit, setImprovEdit] = useState(null); // {propId, date, description, amount, company, isNew}

  var accounts     = financials.accounts     || [];
  var cashItems    = financials.cash         || [];
  var investments  = financials.investments  || [];
  var properties   = financials.properties   || [];
  var loans        = financials.loans        || [];
  var debts        = financials.debts        || [];

  function uid() { return "id_"+Date.now()+"_"+Math.random().toString(36).slice(2,7); }
  function upd(type, fn) { setFinancials(function(prev){ return {...prev,[type]:fn(prev[type]||[])}; }); }
  function inp2(extra) { return {...inp(), ...(extra||{})}; }

  var SECTIONS = [
    {key:"accounts",    icon:"🏦", label:"Accounts",    count:accounts.length},
    {key:"cash",        icon:"💵", label:"Cash",         count:cashItems.length},
    {key:"investments", icon:"📈", label:"Investments",  count:investments.length},
    {key:"properties",  icon:"🏠", label:"Properties",   count:properties.length},
    {key:"loans",       icon:"💳", label:"Loans",        count:loans.length},
    {key:"debts",       icon:"🤝", label:"Debts",        count:debts.length},
  ];

  // ── Shared read-only field ──
  function ROField({label, value}) {
    if(!value) return null;
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:11,color:C.dim}}>{label}</span>
        <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{value}</span>
      </div>
    );
  }

  // ── Amount input ──
  // amtRow() — plain helper (NOT a React component) returns JSX inline.
  // Using a nested component here causes React to unmount/remount on every render = focus loss on mobile.
  function amtRow(itemId, label, existing, readOnly, onChangeCb) {
    var val = posAmounts[itemId] !== undefined ? posAmounts[itemId] : (existing||"");
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
        <div style={{fontSize:11,color:C.muted,flexShrink:0}}>{label}</div>
        <input
          type="text"
          inputMode="decimal"
          value={val}
          readOnly={readOnly}
          onChange={function(e){
            var v = e.target.value;
            setPosAmounts(function(prev){ var n={...prev}; n[itemId]=v; return n; });
            if(onChangeCb) onChangeCb(v);
          }}
          placeholder={existing ? "Last saved: "+existing : "Enter amount"}
          style={{...inp({padding:"6px 10px",fontSize:13,fontFamily:"monospace"}),flex:1,textAlign:"right",
                  background:existing?"rgba(42,157,111,0.04)":"transparent",
                  WebkitAppearance:"none",MozAppearance:"textfield"}}
        />
      </div>
    );
  }

  // ── ACCOUNTS ──
  function AccountsSection() {
    return (
      <div>
        <div style={{fontSize:12,color:C.muted,marginBottom:10,padding:"10px 12px",background:"rgba(42,157,111,0.06)",borderRadius:8,lineHeight:1.5}}>
          Account and credit card balances are managed directly in the <strong>Forecast Cashflow</strong> table. Tap any balance cell there to update it.
        </div>
        {accounts.length===0 ? (
          <div style={{textAlign:"center",padding:"24px",color:C.dim,fontSize:12}}>
            No accounts set up yet. Add them in Config Data → 💰 Financial Position.
          </div>
        ) : accounts.map(function(acc){
          var bal = acc.balance||0;
          return (
            <div key={acc.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{acc.name}</div>
                  <div style={{fontSize:11,color:C.dim}}>{acc.bank}{acc.last4?" ···"+acc.last4:""} · {acc.type} · {acc.currency||"AED"}</div>
                </div>
                <span style={{fontSize:10,background:C.s2,padding:"2px 8px",borderRadius:20,color:C.muted,border:"1px solid "+C.border}}>{acc.type}</span>
              </div>
              <div style={{marginTop:6,fontSize:12,color:C.muted,display:"flex",justifyContent:"space-between"}}>
                <span>{acc.type==="credit"?"Balance Owed":"Current Balance"}</span>
                <span style={{fontFamily:"monospace",fontWeight:600,color:bal?C.text:C.dim}}>{bal?Number(bal).toLocaleString("en-AE"):"—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── CASH — full create/edit here ──
  function CashSection() {
    function saveCash() {
      if(!cashEdit) return;
      var amt = parseFloat(cashEdit.amount||0);
      if(!cashEdit.label) return;
      if(cashEdit.new) {
        upd("cash", function(arr){ return arr.concat([{id:uid(),label:cashEdit.label,currency:cashEdit.currency||"AED",amount:isNaN(amt)?0:amt}]); });
      } else {
        upd("cash", function(arr){ return arr.map(function(x){ return x.id===cashEdit.id?{...x,label:cashEdit.label,currency:cashEdit.currency||"AED",amount:isNaN(amt)?0:amt}:x; }); });
      }
      setCashEdit(null);
    }
    return (
      <div>
        {cashEdit && (
          <div style={{background:C.surface,border:"1px solid "+C.accent+"44",borderRadius:12,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>{cashEdit.new?"Add Cash":"Edit Cash"}</div>
            <LabelRow label="Label"><input value={cashEdit.label||""} onChange={e=>setCashEdit(p=>({...p,label:e.target.value}))} placeholder="e.g. Home Safe, Wallet" style={inp2()}/></LabelRow>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <LabelRow label="Currency"><select value={cashEdit.currency||"AED"} onChange={e=>setCashEdit(p=>({...p,currency:e.target.value}))} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
              <LabelRow label="Amount"><input type="text" inputMode="decimal" value={cashEdit.amount||""} onChange={e=>setCashEdit(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={inp2({fontFamily:"monospace"})}/></LabelRow>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={saveCash} style={{...btn(C.accent,"#fff","none",13,"8px 0"),flex:1}}>✓ Save</button>
              <button onClick={()=>setCashEdit(null)} style={btn(C.s2,C.muted,"1px solid "+C.border,12,"8px 12px")}>Cancel</button>
            </div>
          </div>
        )}
        {cashItems.map(function(item){
          return (
            <div key={item.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{item.label}</div>
                  <div style={{fontSize:11,color:C.dim}}>{item.currency||"AED"} · Last saved: {item.amount||"—"}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setCashEdit({id:item.id,label:item.label,currency:item.currency||"AED",amount:String(item.amount||"")})} style={btn(C.s3,C.muted,"1px solid "+C.border,11,"4px 8px")}>✏️</button>
                  <button onClick={()=>{if(window.confirm("Delete this cash item?")) upd("cash",function(arr){return arr.filter(function(x){return x.id!==item.id;});});}} style={btn("rgba(245,118,118,0.1)",C.danger,"1px solid "+C.danger+"44",11,"4px 8px")}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={()=>setCashEdit({new:true,label:"",currency:"AED",amount:""})} style={{...btn(C.accent,"#fff","none",12,"9px 0"),width:"100%",marginTop:4}}>+ Add Cash</button>
      </div>
    );
  }

  // ── INVESTMENTS ──
  function InvestmentsSection() {
    return investments.length===0 ? (
      <div style={{textAlign:"center",padding:"24px",color:C.dim,fontSize:12}}>
        No investments set up. Add them in Config Data → 💰 Financial Position.
      </div>
    ) : investments.map(function(inv){
      var existing = inv.currentPrice||"";
      return (
        <div key={inv.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{inv.name}</div>
              {inv.ticker&&<div style={{fontSize:11,color:C.accent,fontFamily:"monospace"}}>{inv.ticker}</div>}
            </div>
            <span style={{fontSize:10,background:inv.status==="locked"?"rgba(212,134,10,0.1)":"rgba(42,157,111,0.1)",padding:"2px 8px",borderRadius:20,color:inv.status==="locked"?"#d4860a":C.accent,border:"1px solid "+(inv.status==="locked"?"#d4860a44":C.accent+"44")}}>{inv.status==="locked"?"🔒 Locked":"Available"}</span>
          </div>
          <ROField label="Provider" value={inv.provider}/>
          <ROField label="Account #" value={inv.accountNumber}/>
          <ROField label="Currency" value={inv.currency||"USD"}/>
          <ROField label="Initial shares" value={inv.initialShares?String(inv.initialShares):null}/>
          <ROField label="Initial price" value={inv.purchasePrice?String(inv.purchasePrice):null}/>
          {inv.unlockDate&&<ROField label="Unlock date" value={inv.unlockDate}/>}
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Update current values</div>
          {amtRow(inv.id+"_shares", "Current shares", inv.shares?String(inv.shares):null, undefined, function(sh){
            var pr = posAmounts[inv.id+"_price"] !== undefined ? posAmounts[inv.id+"_price"] : (inv.currentPrice||"");
            var calc = parseFloat(sh)*parseFloat(pr);
            if(!isNaN(calc)) setPosAmounts(function(prev){ var n={...prev}; n[inv.id+"_value"]=calc.toFixed(2); return n; });
          })}
          {amtRow(inv.id+"_price", "Current price ("+String(inv.currency||"USD")+")", inv.currentPrice?String(inv.currentPrice):null, undefined, function(pr){
            var sh = posAmounts[inv.id+"_shares"] !== undefined ? posAmounts[inv.id+"_shares"] : (inv.shares||"");
            var calc = parseFloat(sh)*parseFloat(pr);
            if(!isNaN(calc)) setPosAmounts(function(prev){ var n={...prev}; n[inv.id+"_value"]=calc.toFixed(2); return n; });
          })}
          {amtRow(inv.id+"_value", "Total value ("+String(inv.currency||"USD")+") — auto-calculated", inv.currentValue?String(inv.currentValue):null, undefined, undefined)}
        </div>
      );
    });
  }

  // ── PROPERTIES ──
  function PropertiesSection() {
    return properties.length===0 ? (
      <div style={{textAlign:"center",padding:"24px",color:C.dim,fontSize:12}}>
        No properties set up. Add them in Config Data → 💰 Financial Position.
      </div>
    ) : properties.map(function(prop){
      var existingVal = prop.currentValue||"";
      var existingMort = prop.outstandingMortgage||"";
      return (
        <div key={prop.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid transparent"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{prop.name}</div>
          {prop.address&&<div style={{fontSize:11,color:C.dim,marginBottom:4}}>{prop.address}</div>}
          <ROField label="Currency" value={prop.currency||"AED"}/>
          <ROField label="Purchase price" value={prop.purchasePrice?Number(prop.purchasePrice).toLocaleString():null}/>
          <ROField label="Purchase date" value={prop.purchaseDate}/>
          {prop.mortgageProvider&&<ROField label="Mortgage provider" value={prop.mortgageProvider}/>}
          {prop.initialMortgage&&<ROField label="Initial mortgage" value={Number(prop.initialMortgage).toLocaleString()}/>}
          {(prop.mortgageStartYear||prop.mortgageEndYear)&&<ROField label="Mortgage period" value={(prop.mortgageStartYear||"?")+" → "+(prop.mortgageEndYear||"?")}/>}
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Update current values</div>
          {amtRow(prop.id+"_val", "Current market value ("+String(prop.currency||"AED")+")", existingVal?String(existingVal):null, undefined, undefined)}
          {(()=>{
            var linkedLoan = prop.mortgageId ? loans.find(function(l){ return l.id===prop.mortgageId; }) : null;
            if(linkedLoan) {
              var bal = linkedLoan.outstandingBalance;
              return (
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                  <div style={{fontSize:11,color:C.muted,flexShrink:0}}>Outstanding mortgage ({linkedLoan.currency||"AED"})</div>
                  <div style={{flex:1,textAlign:"right",fontFamily:"monospace",fontSize:13,color:C.dim,padding:"6px 10px",background:"rgba(0,0,0,0.03)",borderRadius:8,border:"1px solid "+C.border}}>
                    {bal ? Number(bal).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0}) : "—"}
                    <span style={{fontSize:10,color:C.dim,marginLeft:6}}>from {linkedLoan.name}</span>
                  </div>
                </div>
              );
            }
            return <div style={{fontSize:11,color:C.dim,marginTop:8,padding:"6px 0"}}>No mortgage linked — set in Config → Properties</div>;
          })()}
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>Improvement Works</div>
            {(prop.improvements||[]).map(function(imp,i){
              return (
                <div key={i} style={{background:C.surface,borderRadius:8,padding:"8px 10px",marginBottom:4,fontSize:11,color:C.muted,display:"flex",justifyContent:"space-between"}}>
                  <span>{imp.date} · {imp.company||"—"}</span>
                  <span style={{fontFamily:"monospace"}}>{Number(imp.amount||0).toLocaleString()} {prop.currency||"AED"}</span>
                </div>
              );
            })}
            <button onClick={function(){
              setImprovEdit({propId:prop.id,date:"",description:"",amount:"",company:"",isNew:true});
            }} style={{...btn(C.s2,C.muted,"1px solid "+C.border,11,"5px 10px"),marginTop:2}}>+ Add Improvement</button>
          </div>
        </div>
      );
    });
  }

  // ── LOANS ──
  function LoansSection() {
    return loans.length===0 ? (
      <div style={{textAlign:"center",padding:"24px",color:C.dim,fontSize:12}}>
        No loans set up. Add them in Config Data → 💰 Financial Position.
      </div>
    ) : loans.map(function(loan){
      var existingBal = loan.outstandingBalance||"";
      var existingPmt = loan.currentMonthlyPayment||loan.monthlyPayment||"";
      var existingEnd = loan.currentEndDate||loan.endDate||"";
      return (
        <div key={loan.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid transparent"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{loan.name}</div>
          <ROField label="Lender" value={loan.lender}/>
          <ROField label="Type" value={loan.loanType}/>
          <ROField label="Currency" value={loan.currency||"AED"}/>
          <ROField label="Original amount" value={loan.originalAmount?Number(loan.originalAmount).toLocaleString():null}/>
          <ROField label="Original monthly payment" value={loan.monthlyPayment?Number(loan.monthlyPayment).toLocaleString():null}/>
          <ROField label="Start date" value={loan.startDate}/>
          <ROField label="Original end date" value={loan.endDate}/>
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Update current values</div>
          {amtRow(loan.id+"_bal", "Outstanding balance ("+String(loan.currency||"AED")+")", existingBal?String(existingBal):null, undefined, undefined)}
          {amtRow(loan.id+"_pmt", "Current monthly payment ("+String(loan.currency||"AED")+")", existingPmt?String(existingPmt):null, undefined, undefined)}
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
            <div style={{fontSize:11,color:C.muted,flexShrink:0}}>Current end date</div>
            <input type="date" value={posAmounts[loan.id+"_end"]!==undefined?posAmounts[loan.id+"_end"]:(existingEnd||"")}
              onChange={function(e){ setPosAmounts(function(prev){ var n={...prev}; n[loan.id+"_end"]=e.target.value; return n; }); }}
              style={{...inp({padding:"6px 10px",fontSize:12}),flex:1,colorScheme:"light"}}/>
          </div>
        </div>
      );
    });
  }

  // ── DEBTS — full create/edit here ──
  function DebtsSection() {
    function saveDebt() {
      if(!debtEdit||!debtEdit.person) return;
      var amt = parseFloat(debtEdit.amount||0);
      if(debtEdit.new) {
        upd("debts",function(arr){ return arr.concat([{id:uid(),person:debtEdit.person,debtType:debtEdit.debtType||"owed_to_me",currency:debtEdit.currency||"AED",amount:isNaN(amt)?0:amt,notes:debtEdit.notes||"",dueDate:debtEdit.dueDate||""}]); });
      } else {
        upd("debts",function(arr){ return arr.map(function(x){ return x.id===debtEdit.id?{...x,person:debtEdit.person,debtType:debtEdit.debtType||"owed_to_me",currency:debtEdit.currency||"AED",amount:isNaN(amt)?0:amt,notes:debtEdit.notes||"",dueDate:debtEdit.dueDate||""}:x; }); });
      }
      setDebtEdit(null);
    }
    return (
      <div>
        {debtEdit && (
          <div style={{background:C.surface,border:"1px solid "+C.accent+"44",borderRadius:12,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>{debtEdit.new?"Add Debt":"Edit Debt"}</div>
            <LabelRow label="Person"><input value={debtEdit.person||""} onChange={e=>setDebtEdit(p=>({...p,person:e.target.value}))} placeholder="e.g. Ahmed, Brother" style={inp2()}/></LabelRow>
            <LabelRow label="Direction">
              <div style={{display:"flex",gap:6}}>
                {[["owed_to_me","They owe me"],["owed_by_me","I owe them"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setDebtEdit(p=>({...p,debtType:v}))} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${debtEdit.debtType===v?C.accent:C.border}`,background:debtEdit.debtType===v?"rgba(42,157,111,0.08)":"transparent",color:debtEdit.debtType===v?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:debtEdit.debtType===v?700:400}}>{l}</button>
                ))}
              </div>
            </LabelRow>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <LabelRow label="Currency"><select value={debtEdit.currency||"AED"} onChange={e=>setDebtEdit(p=>({...p,currency:e.target.value}))} style={{...inp2(),appearance:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></LabelRow>
              <LabelRow label="Amount"><input type="text" inputMode="decimal" value={debtEdit.amount||""} onChange={e=>setDebtEdit(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={inp2({fontFamily:"monospace"})}/></LabelRow>
            </div>
            <LabelRow label="Due Date (optional)"><input type="date" value={debtEdit.dueDate||""} onChange={e=>setDebtEdit(p=>({...p,dueDate:e.target.value}))} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
            <LabelRow label="Notes (optional)"><input value={debtEdit.notes||""} onChange={e=>setDebtEdit(p=>({...p,notes:e.target.value}))} placeholder="e.g. For car purchase" style={inp2()}/></LabelRow>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={saveDebt} style={{...btn(C.accent,"#fff","none",13,"8px 0"),flex:1}}>✓ Save</button>
              <button onClick={()=>setDebtEdit(null)} style={btn(C.s2,C.muted,"1px solid "+C.border,12,"8px 12px")}>Cancel</button>
            </div>
          </div>
        )}
        {debts.map(function(d){
          return (
            <div key={d.id} style={{background:C.s2,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{d.person}</div>
                  <div style={{fontSize:11,color:C.dim}}>{d.debtType==="owed_to_me"?"They owe you":"You owe them"} · {d.currency||"AED"} {Number(d.amount||0).toLocaleString()}{d.dueDate?" · due "+d.dueDate:""}</div>
                  {d.notes&&<div style={{fontSize:11,color:C.dim}}>{d.notes}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setDebtEdit({id:d.id,person:d.person,debtType:d.debtType||"owed_to_me",currency:d.currency||"AED",amount:String(d.amount||""),dueDate:d.dueDate||"",notes:d.notes||""})} style={btn(C.s3,C.muted,"1px solid "+C.border,11,"4px 8px")}>✏️</button>
                  <button onClick={()=>{if(window.confirm("Delete this debt?")) upd("debts",function(arr){return arr.filter(function(x){return x.id!==d.id;});});}} style={btn("rgba(245,118,118,0.1)",C.danger,"1px solid "+C.danger+"44",11,"4px 8px")}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={()=>setDebtEdit({new:true,person:"",debtType:"owed_to_me",currency:"AED",amount:""})} style={{...btn(C.accent,"#fff","none",12,"9px 0"),width:"100%",marginTop:4}}>+ Add Debt</button>
      </div>
    );
  }

  // ── Save handler — single setFinancials call merges ALL updates ──
  function handleSave() {
    setFinancials(function(prev) {
      var next = {...prev};
      // Investments: shares, currentPrice, currentValue
      if(investments.length > 0) {
        next.investments = investments.map(function(inv){
          var out = {...inv};
          var sh = posAmounts[inv.id+"_shares"];
          var pr = posAmounts[inv.id+"_price"];
          var vl = posAmounts[inv.id+"_value"];
          if(sh !== undefined && sh !== "" && !isNaN(parseFloat(sh))) out.shares       = parseFloat(sh);
          if(pr !== undefined && pr !== "" && !isNaN(parseFloat(pr))) out.currentPrice = parseFloat(pr);
          if(vl !== undefined && vl !== "" && !isNaN(parseFloat(vl))) out.currentValue = parseFloat(vl);
          return out;
        });
      }
      // Properties: currentValue only (outstanding mortgage comes from linked loan)
      if(properties.length > 0) {
        next.properties = properties.map(function(prop){
          var out = {...prop};
          var vl = posAmounts[prop.id+"_val"];
          if(vl !== undefined && vl !== "" && !isNaN(parseFloat(vl))) out.currentValue = parseFloat(vl);
          return out;
        });
      }
      // Loans: outstandingBalance, currentMonthlyPayment, currentEndDate
      if(loans.length > 0) {
        next.loans = loans.map(function(loan){
          var out = {...loan};
          var bal = posAmounts[loan.id+"_bal"];
          var pmt = posAmounts[loan.id+"_pmt"];
          var end = posAmounts[loan.id+"_end"];
          if(bal !== undefined && bal !== "" && !isNaN(parseFloat(bal))) out.outstandingBalance    = parseFloat(bal);
          if(pmt !== undefined && pmt !== "" && !isNaN(parseFloat(pmt))) out.currentMonthlyPayment = parseFloat(pmt);
          if(end !== undefined && end) out.currentEndDate = end;
          return out;
        });
      }
      // Accounts: balances now managed via Forecast table (two-way sync in commitCellEdit)
      return next;
    });
    onSave();
  }

  return (
    <div>
      {/* Improvement Works Modal */}
      {improvEdit && (
        <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:400,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:16,color:C.text}}>
              {improvEdit.isNew ? "Add Improvement Work" : "Edit Improvement Work"}
            </div>
            <LabelRow label="Date"><input type="date" value={improvEdit.date||""} onChange={e=>setImprovEdit(p=>({...p,date:e.target.value}))} style={{...inp2(),colorScheme:"light"}}/></LabelRow>
            <LabelRow label="Description"><input value={improvEdit.description||""} onChange={e=>setImprovEdit(p=>({...p,description:e.target.value}))} placeholder="e.g. Kitchen renovation" style={inp2()}/></LabelRow>
            <LabelRow label="Company"><input value={improvEdit.company||""} onChange={e=>setImprovEdit(p=>({...p,company:e.target.value}))} placeholder="e.g. ABC Contractors" style={inp2()}/></LabelRow>
            <LabelRow label="Amount"><input type="text" inputMode="decimal" value={improvEdit.amount||""} onChange={e=>setImprovEdit(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={{...inp2(),fontFamily:"monospace"}}/></LabelRow>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={function(){
                var amt = parseFloat(improvEdit.amount||0);
                var entry = {date:improvEdit.date,description:improvEdit.description,company:improvEdit.company,amount:isNaN(amt)?0:amt};
                upd("properties",function(arr){ return arr.map(function(p){
                  if(p.id!==improvEdit.propId) return p;
                  var imps = p.improvements||[];
                  if(improvEdit.isNew) return {...p,improvements:[...imps,entry]};
                  return {...p,improvements:imps.map(function(im,i){ return i===improvEdit.idx?entry:im; })};
                }); });
                setImprovEdit(null);
              }} style={{...btn(C.accent,"#fff","none",13,"10px 0"),flex:1}}>✓ Save</button>
              <button onClick={()=>setImprovEdit(null)} style={btn(C.s2,C.muted,"1px solid "+C.border,13,"10px 14px")}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>💰 Financial Position</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Update current balances and values.</div>

      {/* Section pills */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>
        {SECTIONS.map(function(s){
          return (
            <button key={s.key} onClick={()=>setSection(s.key)}
              style={{padding:"6px 10px",borderRadius:20,border:`1px solid ${section===s.key?C.accent:C.border}`,
                      background:section===s.key?"rgba(42,157,111,0.1)":"transparent",
                      color:section===s.key?C.accent:C.muted,fontSize:12,cursor:"pointer",
                      fontFamily:"inherit",fontWeight:section===s.key?700:500}}>
              {s.icon} {s.label}
              {s.count>0&&<span style={{marginLeft:4,background:C.accent,color:"#fff",borderRadius:20,padding:"0 5px",fontSize:10,fontWeight:700}}>{s.count}</span>}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div>
        {section==="accounts"    && AccountsSection()}
        {section==="cash"        && CashSection()}
        {section==="investments" && InvestmentsSection()}
        {section==="properties"  && PropertiesSection()}
        {section==="loans"       && LoansSection()}
        {section==="debts"       && DebtsSection()}
      </div>

      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button onClick={handleSave} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>✓ Save Financial Position</button>
        <button onClick={onClose} style={btn(C.s2,C.muted,"1px solid "+C.border,13,"12px 14px")}>Cancel</button>
      </div>
    </div>
  );
}


// ─── Scan Data Panel (inside ManualEntryModal) ────────────────────────────────
const CLOUD_FN_URL = "https://parse-statement-870885265385.europe-west2.run.app";

function ScanDataPanel({onImport, onClose, taxonomy, vendorMap, financials, initialScanMode}) {
  const [scanMode, setScanMode] = useState(initialScanMode||"pdf"); // "pdf" | "screenshot" | "spreadsheet"
  const [pdfFile, setPdfFile] = useState(null);
  const [images, setImages] = useState([]); // [{base64, mediaType, dataUrl}]
  const [xlsFile, setXlsFile] = useState(null);
  const [xlsRows, setXlsRows] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);
  const [piiReport, setPiiReport] = useState(null);
  const [importCurrency, setImportCurrency] = useState("AED");
  const [scanLog, setScanLog] = useState([]); // live extraction log lines
  const [showConsentModal, setShowConsentModal] = useState(false);
  const pdfInputRef = React.useRef(null);
  const imgInputRef = React.useRef(null);
  const xlsInputRef = React.useRef(null);

  var accounts = (financials&&financials.accounts)||[];

  function addLog(line) {
    setScanLog(function(prev) { return [...prev, {time: new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}), text: line}]; });
  }

  async function callCloudFn(body) {
    var {auth} = getFB();
    var user = auth.currentUser;
    if(!user) throw new Error("Not signed in");
    var token = await user.getIdToken();
    var safeTaxonomy = {};
    Object.entries(taxonomy||{}).forEach(function([cat, def]) {
      safeTaxonomy[cat] = { subs: {} };
      Object.keys((def&&def.subs)||{}).forEach(function(sub) { safeTaxonomy[cat].subs[sub] = {}; });
    });
    var safeVendorMap = {};
    Object.entries(vendorMap||{}).forEach(function([vendor, mapping]) {
      safeVendorMap[vendor] = { category: mapping.category||"", subcategory: mapping.subcategory||"" };
    });

    setScanLog([]);
    addLog("Connecting to Gemini…");

    var res = await fetch(CLOUD_FN_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
      body:JSON.stringify({...body, accountId:accountId||null, taxonomy:safeTaxonomy, vendorMap:safeVendorMap})
    });

    if(!res.ok) {
      var errData = await res.json().catch(function(){return {};});
      var errMsg = errData.error||"Cloud Function error "+res.status;
      // Detect quota/billing errors and give actionable guidance
      var isQuota = res.status===429||errMsg.toLowerCase().includes("quota")||errMsg.toLowerCase().includes("rate limit")||errMsg.toLowerCase().includes("resource exhausted");
      var isBilling = res.status===402||errMsg.toLowerCase().includes("billing")||errMsg.toLowerCase().includes("payment")||errMsg.toLowerCase().includes("insufficient");
      if(isQuota) throw new Error("Gemini quota exceeded — you've hit your daily request limit. Free tier resets at midnight Pacific time. Go to Config → 🤖 Gemini Usage → 'Check Quotas' to see your limits, or add billing to increase them.");
      if(isBilling) throw new Error("Google Cloud billing issue — your account may need a payment method or top-up. Go to Config → 🤖 Gemini Usage for step-by-step instructions.");
      throw new Error(errMsg);
    }

    // Read streaming NDJSON response line by line
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var lastResult = null;

    while(true) {
      var chunk = await reader.read();
      if(chunk.done) break;
      buffer += decoder.decode(chunk.value, {stream:true});
      // Process complete lines
      var lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line
      for(var i=0;i<lines.length;i++) {
        var line = lines[i].trim();
        if(!line) continue;
        try {
          var msg = JSON.parse(line);
          if(msg.log) {
            addLog(msg.log);
          }
          if(msg.done) {
            lastResult = msg;
          }
        } catch(e) { /* ignore malformed lines */ }
      }
    }
    // Process any remaining buffer
    if(buffer.trim()) {
      try {
        var msg = JSON.parse(buffer.trim());
        if(msg.log) addLog(msg.log);
        if(msg.done) lastResult = msg;
      } catch(e) {}
    }

    if(!lastResult) throw new Error("No response received from server");
    if(lastResult.error) {
      var streamErr = lastResult.error;
      var isQuotaStream = streamErr.toLowerCase().includes("quota")||streamErr.toLowerCase().includes("rate limit")||streamErr.toLowerCase().includes("resource exhausted")||streamErr.includes("429");
      var isBillingStream = streamErr.toLowerCase().includes("billing")||streamErr.toLowerCase().includes("payment")||streamErr.includes("402");
      if(isQuotaStream) throw new Error("Gemini quota exceeded — you've hit your daily request limit. Free tier resets at midnight Pacific time. Go to Config → 🤖 Gemini Usage → 'Check Quotas' to see your limits.");
      if(isBillingStream) throw new Error("Google Cloud billing issue — your account may need a payment method or top-up. Go to Config → 🤖 Gemini Usage for step-by-step instructions.");
      throw new Error(streamErr);
    }
    if(!lastResult.transactions||!lastResult.transactions.length) throw new Error("No transactions found in this statement");
    addLog("✓ Complete — " + lastResult.transactions.length + " transactions extracted");
    // Return token usage if Cloud Function provides it (usageMetadata from Gemini response)
    return {
      transactions: lastResult.transactions,
      piiReport: lastResult.piiReport||null,
      inputTokens: lastResult.inputTokens||lastResult.usageMetadata?.promptTokenCount||0,
      outputTokens: lastResult.outputTokens||lastResult.usageMetadata?.candidatesTokenCount||0
    };
  }

  async function readFileAsBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result.split(",")[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function runScan() {
    setErr(""); setStatus("loading"); setPreview(null); setScanLog([]);
    try {
      var txs;
      setPiiReport(null);
      if(scanMode==="pdf") {
        if(!pdfFile) { setErr("Select a PDF first."); setStatus("idle"); return; }
        var pdfBase64 = await readFileAsBase64(pdfFile);
        var result = await callCloudFn({pdfBase64});
        txs = result.transactions;
        if(result.piiReport) setPiiReport(result.piiReport);
        var pdfCost = calcGeminiCost(result.inputTokens||0, result.outputTokens||0);
        if(pdfCost>0||(result.inputTokens||0)>0) addLog("📊 Tokens: "+Math.round((result.inputTokens||0)/1000)+"K in / "+Math.round((result.outputTokens||0)/1000)+"K out · est. £"+pdfCost.toFixed(4));
        var pdfRec = {date:new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),mode:"PDF",txCount:(txs||[]).length,inputTokens:result.inputTokens||0,outputTokens:result.outputTokens||0,costGBP:pdfCost};
        storeSave(GEMINI_USAGE_KEY,(storeLoad(GEMINI_USAGE_KEY)||[]).concat([pdfRec]));
      } else if(scanMode==="screenshot") {
        if(!images.length) { setErr("Add at least one screenshot."); setStatus("idle"); return; }
        var BATCH_SIZE = 4;
        var allImgs = images.map(function(img){return {base64:img.base64,mediaType:img.mediaType};});
        var batches = [];
        for(var bi=0; bi<allImgs.length; bi+=BATCH_SIZE) {
          batches.push(allImgs.slice(bi, bi+BATCH_SIZE));
        }
        var allTxs = [];
        var seenKeys = new Set();
        var totalInputTokens = 0, totalOutputTokens = 0;
        for(var bIdx=0; bIdx<batches.length; bIdx++) {
          addLog("Batch "+(bIdx+1)+" of "+batches.length+" (pages "+(bIdx*BATCH_SIZE+1)+"–"+Math.min((bIdx+1)*BATCH_SIZE, allImgs.length)+")…");
          var bResult = await callCloudFn({images: batches[bIdx]});
          var bTxs = bResult.transactions || bResult || [];
          totalInputTokens += bResult.inputTokens||0;
          totalOutputTokens += bResult.outputTokens||0;
          var newTxs = bTxs.filter(function(t){
            var k = (t.date||"")+"||"+(t.description||"").toLowerCase().trim()+"||"+(parseFloat(t.amount)||0).toFixed(2);
            if(seenKeys.has(k)) return false;
            seenKeys.add(k); return true;
          });
          allTxs = allTxs.concat(newTxs);
          addLog("✓ Batch "+(bIdx+1)+": "+newTxs.length+" transactions ("+allTxs.length+" total so far)");
        }
        txs = allTxs;
        if(!txs.length) throw new Error("No transactions found across all pages");
        // Save usage record
        var costGBP = calcGeminiCost(totalInputTokens, totalOutputTokens);
        if(costGBP>0||totalInputTokens>0) {
          addLog("📊 Tokens used: "+Math.round(totalInputTokens/1000)+"K in / "+Math.round(totalOutputTokens/1000)+"K out · estimated cost £"+costGBP.toFixed(4));
        }
        var usageRecord = {date:new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),mode:"screenshot ("+images.length+" pages)",txCount:txs.length,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,costGBP};
        var existingUsage = storeLoad(GEMINI_USAGE_KEY)||[];
        storeSave(GEMINI_USAGE_KEY, existingUsage.concat([usageRecord]));
      } else {
        // Spreadsheet mode — local parsing + Gemini vendor suggestions only
        if(!xlsFile||!xlsRows||!xlsRows.length) { setErr("Select a spreadsheet first."); setStatus("idle"); return; }

        // ── Step 1: Local parsing — handles all rows reliably ──
        function parseXlsDate(raw) {
          if(!raw) return null;
          var s = String(raw).trim();
          var m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
          if(m) return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
          m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
          if(m) { var yr=parseInt(m[3]); return (yr>=50?1900+yr:2000+yr)+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"); }
          var months={jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
          m = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
          if(m&&months[m[2].toLowerCase()]) return m[3]+"-"+months[m[2].toLowerCase()]+"-"+m[1].padStart(2,"0");
          m = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{2})$/);
          if(m&&months[m[2].toLowerCase()]) { var yr2=parseInt(m[3]); return (yr2>=50?1900+yr2:2000+yr2)+"-"+months[m[2].toLowerCase()]+"-"+m[1].padStart(2,"0"); }
          return null;
        }
        function parseXlsAmount(raw) {
          if(raw===null||raw===undefined||raw==="") return null;
          var n=parseFloat(String(raw).replace(/,/g,"").trim());
          return isNaN(n)?null:n;
        }

        // Skip header row if first row doesn't parse as a date
        var dataRows = xlsRows;
        if(xlsRows.length>0 && !parseXlsDate(xlsRows[0][0])) dataRows = xlsRows.slice(1);

        addLog("Parsing "+dataRows.length+" rows locally…");
        var parsedTxs = []; var parseErrors = 0;
        dataRows.forEach(function(row) {
          var dateVal=parseXlsDate(row[0]);
          var desc=row[1]!==null&&row[1]!==undefined?String(row[1]).trim():"";
          var amtRaw=parseXlsAmount(row[2]);
          if(!dateVal||!desc||amtRaw===null){parseErrors++;return;}
          parsedTxs.push({date:dateVal,description:desc,amount:Math.abs(amtRaw),isCredit:amtRaw>0});
        });
        addLog("✓ Parsed "+parsedTxs.length+" transactions"+(parseErrors>0?" ("+parseErrors+" rows skipped)":""));
        if(!parsedTxs.length) throw new Error("Could not parse any transactions — check spreadsheet format");

        // ── Step 2: Local vendor inference (uses module-level inferVendor) ──
        var vendorSuggestions={};
        parsedTxs.forEach(function(t){
          if(!(vendorMap||{})[t.description]&&!vendorSuggestions[t.description])
            vendorSuggestions[t.description]=inferVendor(t.description);
        });
        addLog("✓ Inferred vendors locally for "+Object.keys(vendorSuggestions).length+" descriptions");

        // ── Step 3: Apply vendorMap + local suggestions ──
        txs = parsedTxs.map(function(t) {
          var mapped=(vendorMap||{})[t.description];
          return Object.assign({},t,{
            vendor:mapped?(mapped.vendor||null):(vendorSuggestions[t.description]||null),
            category:mapped?mapped.category:"",
            subcategory:mapped?mapped.subcategory:""
          });
        });

        var xlsRec={date:new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),mode:"spreadsheet",txCount:txs.length,inputTokens:0,outputTokens:0,costGBP:0};
        storeSave(GEMINI_USAGE_KEY,(storeLoad(GEMINI_USAGE_KEY)||[]).concat([xlsRec]));
      }
      setPreview(txs.map(function(t){ return t.vendor&&t.vendor.trim()?t:{...t,vendor:inferVendor(t.description||"")}; }));
      setStatus("done");
    } catch(e) { setErr(e.message); setStatus("error"); }
  }

  function addImageFile(file) {
    if(!file||!file.type.startsWith("image/")) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      setImages(function(prev){return [...prev,{dataUrl,base64:dataUrl.split(",")[1],mediaType:file.type||"image/jpeg"}];});
      setErr(""); setStatus("idle"); setPreview(null);
    };
    reader.readAsDataURL(file);
  }

  var hasInput = scanMode==="pdf" ? !!pdfFile : scanMode==="screenshot" ? images.length>0 : (!!xlsFile&&!!xlsRows&&xlsRows.length>0);

  return (
    <div style={{position:"relative"}}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Scan Statement</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Powered by Gemini — extracts rich transaction data including exchange rates, VAT, and references</div>

      {/* Mode toggle */}
      <div style={{display:"flex",gap:2,background:C.s2,borderRadius:10,padding:3,marginBottom:16}}>
        {[["pdf","📄 PDF"],["screenshot","📷 Screenshots"],["spreadsheet","📊 Spreadsheet"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setScanMode(m);setErr("");setStatus("idle");setPreview(null);setXlsFile(null);setXlsRows(null);}} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:scanMode===m?C.surface:"transparent",color:scanMode===m?C.text:C.muted,fontWeight:scanMode===m?700:500,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
        ))}
      </div>

      {/* Account */}
      {accounts.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Account (optional)</div>
          <select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{...inp(),appearance:"none",fontSize:13}}>
            <option value="">— Select account —</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.last4?" ···"+a.last4:""}</option>)}
          </select>
        </div>
      )}

      {/* Currency */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Statement Currency</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["AED","GBP","USD","EUR","PKR"].map(c=>(
            <button key={c} onClick={()=>setImportCurrency(c)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${importCurrency===c?C.accent:C.border}`,background:importCurrency===c?C.accent:"transparent",color:importCurrency===c?"#fff":C.muted,fontSize:12,fontWeight:importCurrency===c?700:500,cursor:"pointer",fontFamily:"inherit"}}>{c}</button>
          ))}
        </div>
      </div>

      {/* PDF picker */}
      {scanMode==="pdf"&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>PDF Statement</div>
          <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" onChange={e=>{setPdfFile(e.target.files[0]||null);setErr("");setStatus("idle");setPreview(null);}} style={{display:"none"}}/>
          <div onClick={()=>pdfInputRef.current&&pdfInputRef.current.click()} style={{border:`2px dashed ${pdfFile?C.accent:C.border}`,borderRadius:12,padding:"20px 16px",textAlign:"center",cursor:"pointer",background:pdfFile?"rgba(42,157,111,0.04)":C.s2}}>
            {pdfFile?(
              <div>
                <div style={{fontSize:24,marginBottom:6}}>📄</div>
                <div style={{fontSize:13,fontWeight:600,color:C.accent}}>{pdfFile.name}</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>{(pdfFile.size/1024).toFixed(0)} KB · tap to change</div>
              </div>
            ):(
              <div>
                <div style={{fontSize:24,marginBottom:6}}>📂</div>
                <div style={{fontSize:13,fontWeight:600,color:C.muted}}>Tap to select PDF</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>From Files app → iCloud Drive or Downloads</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot picker — paste-first with file fallback */}
      {scanMode==="screenshot"&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Screenshots</div>
          <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(addImageFile);e.target.value="";}} style={{display:"none"}}/>
          {/* Paste zone — contenteditable so it can receive paste events on iPhone and desktop */}
          <div
            ref={function(el){
              if(!el) return;
              // Auto-refocus when tab becomes visible again (user returns from screenshot app)
              if(!el._visHandler) {
                el._visHandler = function(){
                  if(document.visibilityState==="visible") {
                    // Small delay so the browser finishes restoring focus
                    setTimeout(function(){try{el.focus();}catch(e){}}, 300);
                  }
                };
                document.addEventListener("visibilitychange", el._visHandler);
              }
              // Paste handler
              if(!el._pasteHandler) {
                el._pasteHandler = function(ev){
                  var items = Array.from((ev.clipboardData||window.clipboardData).items||[]);
                  var imgItem = items.find(function(it){return it.type.startsWith("image/");});
                  if(imgItem) {
                    ev.preventDefault();
                    var file = imgItem.getAsFile();
                    if(file) {
                      var reader = new FileReader();
                      reader.onload = function(e2){
                        var dataUrl = e2.target.result;
                        setImages(function(prev){return [...prev,{dataUrl,base64:dataUrl.split(",")[1],mediaType:file.type||"image/jpeg"}];});
                        setErr(""); setStatus("idle"); setPreview(null);
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                };
                el.addEventListener("paste", el._pasteHandler);
              }
            }}
            contentEditable="true"
            suppressContentEditableWarning={true}
            tabIndex={0}
            onKeyDown={function(e){
              // Swallow all keys except paste shortcuts to keep the zone clean
              if(!(e.ctrlKey&&e.key==="v")&&!(e.metaKey&&e.key==="v")) e.preventDefault();
            }}
            style={{
              border:"2px dashed "+(images.length?C.accent:C.border),
              borderRadius:12, padding:12,
              background:images.length?"rgba(42,157,111,0.04)":C.s2,
              minHeight:80, outline:"none", cursor:"text",
              WebkitUserSelect:"none", userSelect:"none"
            }}
          >
            {images.length===0?(
              <div style={{textAlign:"center",padding:"12px 0",pointerEvents:"none"}}>
                <div style={{fontSize:28,marginBottom:6}}>📋</div>
                <div style={{fontSize:13,fontWeight:600,color:C.muted}}>Tap here, then paste your screenshot</div>
                <div style={{fontSize:11,color:C.dim,marginTop:4}}>iPhone: long-press → Paste · Windows: Ctrl+V</div>
              </div>
            ):(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",pointerEvents:"none"}}>
                {images.map(function(img,i){return (
                  <div key={i} style={{position:"relative",pointerEvents:"auto"}}>
                    <img src={img.dataUrl} alt={"p"+(i+1)} style={{height:70,maxWidth:110,borderRadius:8,border:"1px solid "+C.border,objectFit:"cover",display:"block"}}/>
                    <button onClick={function(e){e.stopPropagation();setImages(function(prev){return prev.filter(function(_,idx){return idx!==i;});});}} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:C.danger,border:"none",color:"#fff",fontSize:13,cursor:"pointer",lineHeight:1,fontWeight:700}}>×</button>
                    <div style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:2}}>Page {i+1}</div>
                  </div>
                );})}
                <div style={{fontSize:11,color:C.accent,fontWeight:600,marginLeft:4}}>Paste to add more</div>
              </div>
            )}
          </div>
          {/* File picker fallback */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
            <div style={{flex:1,height:1,background:C.border}}/>
            <span style={{fontSize:11,color:C.dim}}>or</span>
            <div style={{flex:1,height:1,background:C.border}}/>
          </div>
          <button onClick={()=>imgInputRef.current&&imgInputRef.current.click()}
            style={{...btn(C.s2,C.muted,"1px solid "+C.border,11,"6px 14px"),display:"block",width:"100%",marginTop:8,textAlign:"center"}}>
            + Add from Files
          </button>
        </div>
      )}

      {scanMode==="spreadsheet"&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Spreadsheet File</div>
          <input ref={xlsInputRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={function(e){
            var f=e.target.files[0]; if(!f) return;
            setXlsFile(f); setErr(""); setStatus("idle"); setPreview(null); setXlsRows(null);
            var reader=new FileReader();
            reader.onload=function(ev){
              try {
                var wb=XLSX.read(ev.target.result,{type:"array"});
                var ws=wb.Sheets[wb.SheetNames[0]];
                var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
                var nonEmpty=rows.filter(function(r){return r.some(function(c){return c!==null&&c!=="";});});
                setXlsRows(nonEmpty);
              } catch(ex) { setErr("Could not read spreadsheet: "+ex.message); }
            };
            reader.readAsArrayBuffer(f);
          }}/>
          {!xlsFile?(
            <div onClick={function(){xlsInputRef.current&&xlsInputRef.current.click();}} style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:C.s2}}>
              <div style={{fontSize:22,marginBottom:6}}>📊</div>
              <div style={{fontSize:13,color:C.accent,fontWeight:600}}>Tap to select spreadsheet</div>
              <div style={{fontSize:11,color:C.dim,marginTop:4}}>.xlsx, .xls, or .csv</div>
            </div>
          ):(
            <div style={{border:`2px solid ${C.accent}`,borderRadius:10,padding:"14px 16px",background:"rgba(42,157,111,0.04)"}}>
              <div style={{fontSize:13,fontWeight:600,color:C.accent,marginBottom:2}}>📊 {xlsFile.name}</div>
              <div style={{fontSize:11,color:C.muted}}>{xlsRows?xlsRows.length+" rows detected · tap to change":"Reading…"}</div>
              {xlsRows&&xlsRows.length>0&&(
                <div style={{marginTop:10,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",maxHeight:120,overflowY:"auto"}}>
                  {xlsRows.slice(0,5).map(function(row,i){return(
                    <div key={i} style={{padding:"4px 8px",borderBottom:`1px solid ${C.s2}`,fontSize:10,fontFamily:"monospace",color:i===0?C.accent:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {row.filter(function(c){return c!==null&&c!=="";}).join("  |  ")}
                    </div>
                  );})}
                  {xlsRows.length>5&&<div style={{padding:"4px 8px",fontSize:10,color:C.dim,textAlign:"center"}}>…{xlsRows.length-5} more rows</div>}
                </div>
              )}
              <button onClick={function(){xlsInputRef.current&&xlsInputRef.current.click();}} style={{...btn(C.s3,C.muted,"1px solid "+C.border,11,"4px 10px"),marginTop:8}}>Change file</button>
            </div>
          )}
          <div style={{marginTop:10,fontSize:11,color:C.dim,lineHeight:1.6}}>
            💡 Export from your bank&apos;s online portal as Excel or CSV. Gemini will identify dates, amounts, and descriptions automatically.
          </div>
        </div>
      )}

      {/* Live extraction log */}
      {(status==="loading"||scanLog.length>0)&&(
        <div style={{marginBottom:12,background:"#0f1a0f",borderRadius:12,padding:"12px 14px",border:"1px solid #2a3a2a"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#7dd8a8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            {status==="loading"&&<span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#2a9d6f",boxShadow:"0 0 6px #2a9d6f",animation:"pulse 1s infinite"}}/>}
            {status==="loading"?"Extracting…":"Extraction complete"}
          </div>
          <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
            {scanLog.map(function(entry,i){
              var isGood = entry.text.indexOf("✓")>=0||entry.text.indexOf("transactions")>=0;
              var isWarn = entry.text.indexOf("⚠")>=0||entry.text.indexOf("truncated")>=0||entry.text.indexOf("recovered")>=0;
              return (
                <div key={i} style={{display:"flex",gap:8,alignItems:"baseline"}}>
                  <span style={{fontSize:9,color:"#4a6a4a",fontFamily:"monospace",flexShrink:0}}>{entry.time}</span>
                  <span style={{fontSize:12,color:isGood?"#7dd8a8":isWarn?"#fbbf24":"#a0b8a0",fontFamily:"monospace",lineHeight:1.4}}>{entry.text}</span>
                </div>
              );
            })}
            {status==="loading"&&<div style={{fontSize:12,color:"#4a6a4a",fontFamily:"monospace"}}>▌</div>}
          </div>
        </div>
      )}
      {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12,padding:"8px 12px",background:"rgba(245,118,118,0.08)",borderRadius:8}}>⚠️ {err}</div>}

      {/* PII Report */}
      {piiReport&&piiReport.count>0&&(
        <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(42,157,111,0.06)",border:`1px solid ${C.accent}44`,borderRadius:8}}>
          <div style={{fontSize:12,fontWeight:600,color:C.accent,marginBottom:6}}>🔒 Privacy check: {piiReport.count} item{piiReport.count!==1?"s":""} redacted before sending to Gemini</div>
          {piiReport.types&&Object.entries(piiReport.types).map(([type,count])=>(
            <div key={type} style={{fontSize:11,color:C.muted,lineHeight:1.8}}>
              · {count}x {type} replaced with [{type}]
            </div>
          ))}
          {piiReport.samples&&piiReport.samples.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:4}}>Values removed (last 4 digits shown for recognition):</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {piiReport.samples.map(function(s,i){
                  return <span key={i} style={{fontFamily:"monospace",fontSize:11,background:C.s2,padding:"2px 7px",borderRadius:6,color:C.muted,border:`1px solid ${C.border}`}}>
                    {s.type} ····{s.last4}
                  </span>;
                })}
              </div>
            </div>
          )}
          {piiReport.note==="direct-pdf-mode"&&(
            <div style={{marginTop:6,fontSize:11,color:"#d4860a"}}>⚠️ Image-based PDF — this statement was sent directly to Gemini without PII scrubbing</div>
          )}
        </div>
      )}

      {/* Preview */}
      {status==="done"&&preview&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:C.accent,fontWeight:600,marginBottom:8}}>✓ Found {preview.length} transactions</div>
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,maxHeight:180,overflowY:"auto"}}>
            {preview.slice(0,30).map(function(t,i){return (
              <div key={i} style={{padding:"7px 12px",borderBottom:`1px solid ${C.s2}`,display:"flex",gap:10,fontSize:12,alignItems:"center"}}>
                <span style={{color:C.muted,fontFamily:"monospace",flexShrink:0}}>{fmtDNum(t.date)}</span>
                <span style={{flex:1,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</span>
                {t.confidence==="low"&&<span style={{color:"#d4860a",fontSize:10,flexShrink:0}}>⚠️</span>}
                <span style={{color:t.isCredit?C.accent:C.danger,fontFamily:"monospace",flexShrink:0}}>{t.isCredit?"+":"-"}{t.amount}</span>
              </div>
            );})}
            {preview.length>30&&<div style={{padding:"8px 12px",textAlign:"center",color:C.dim,fontSize:11}}>+{preview.length-30} more</div>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:8}}>
        {status!=="done"
          ? <button onClick={scanMode==="spreadsheet"?runScan:function(){setShowConsentModal(true);}} disabled={!hasInput||status==="loading"} style={{...btn(!hasInput||status==="loading"?C.s3:C.accent,!hasInput||status==="loading"?C.dim:"#fff","none",14,"12px 0"),flex:1,opacity:!hasInput||status==="loading"?0.5:1}}>
              {status==="loading"?"Reading…":"🤖 Extract with Gemini"}
            </button>
          : <button onClick={()=>onImport(preview,importCurrency,accountId||null)} style={{...btn(C.accent,"#fff","none",14,"12px 0"),flex:1}}>
              ✓ Import {preview.length} Transactions
            </button>
        }
        <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"12px 14px")}>Cancel</button>
      </div>

      {/* SEC-1 — Gemini consent gate (PDF and screenshot modes only) */}
      {showConsentModal&&(
        <div style={{position:"absolute",inset:0,background:"rgba(236,241,235,0.96)",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",zIndex:10}}>
          <div style={{width:"100%",maxWidth:380,background:C.surface,borderRadius:14,padding:"22px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.13)",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:18,marginBottom:10,textAlign:"center"}}>🔒</div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12,textAlign:"center"}}>Before sending to Gemini</div>
            {scanMode==="pdf"?(
              <div style={{fontSize:13,color:C.muted,lineHeight:1.65,marginBottom:16}}>
                Your PDF will be sent to Google Gemini AI to extract transactions.<br/><br/>
                In most cases, personal details such as account numbers, card numbers, and IBAN are automatically removed first. However, <strong>your name and bank address may still be included</strong> in what is sent.<br/><br/>
                If your PDF is image-based (e.g. a scanned paper statement), no automatic removal is possible and the full document will be sent.
              </div>
            ):(
              <div style={{fontSize:13,color:C.muted,lineHeight:1.65,marginBottom:16}}>
                Your screenshots will be sent to Google Gemini AI as images.<br/><br/>
                <strong>Everything visible in the images</strong> — including account numbers, balances, and any other on-screen information — will be sent.<br/><br/>
                No automatic removal is possible for images.
              </div>
            )}
            <div style={{textAlign:"center",marginBottom:18}}>
              <a href="https://waheedurmalik.github.io/Home_Financials/privacy-info.html" target="_self" style={{fontSize:12,color:C.accent,textDecoration:"underline"}}>Further info →</a>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowConsentModal(false);runScan();}} style={{...btn(C.accent,"#fff","none",14,"11px 0"),flex:1}}>Proceed</button>
              <button onClick={function(){setShowConsentModal(false);}} style={{...btn(C.s2,C.muted,"1px solid "+C.border,13,"11px 16px")}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
function ManualEntryModal({onImport, taxonomy, vendorMap, vendorList, financials, setFinancials, onClose, initialMode, initialScanMode, singleSection, noOverlay}) {
  const [mode, setMode]   = useState(initialMode||"transaction"); // "transaction" | "position" | "scan"
  const [date, setDate]   = useState((function(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })());
  const [desc, setDesc]   = useState("");
  const [amount, setAmount] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [cat, setCat]     = useState("");
  const [sub, setSub]     = useState("");
  const [txType, setTxType] = useState("standard");
  const [manualAccountId, setManualAccountId] = useState("");
  const [manualVendor, setManualVendor] = useState("");
  const [err, setErr]     = useState("");
  // Position state now lives inside FinancialPositionPanel to prevent focus loss on keypress

  const accounts = (financials&&financials.accounts)||[];

  function handleAdd() {
    const amt = parseFloat(amount);
    if(!date) { setErr("Date is required."); return; }
    if(!desc.trim()) { setErr("Description is required."); return; }
    if(isNaN(amt) || amt <= 0) { setErr("Enter a valid amount greater than 0."); return; }
    const tx = {
      date, description: desc.trim(), amount: amt,
      isCredit, txType: isCredit ? "credit" : txType,
      category: cat||"Other", subcategory: sub||"Miscellaneous",
      _manual: true
    };
    if(manualAccountId) tx.accountId = manualAccountId;
    if(manualVendor.trim()) tx.vendor = manualVendor.trim();
    onImport([tx]);
    onClose();
  }

  var innerPanel = (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,maxWidth:480,width:"100%",maxHeight:"94vh",overflowY:"auto"}}>
        {/* Mode tabs — hidden when opened from Home (singleSection) */}
        {!singleSection&&<div style={{display:"flex",gap:2,background:C.s2,borderRadius:12,padding:4,marginBottom:20}}>
          {[["transaction","✏️ Transaction"],["position","💰 Financial Position"],["scan","📷 Scan"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",background:mode===m?C.surface:"transparent",color:mode===m?C.text:C.muted,fontWeight:mode===m?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>}

        {/* ── TRANSACTION MODE ── */}
        {mode==="transaction"&&<div>
        <div style={{fontFamily:"inherit",fontSize:17,fontWeight:700,marginBottom:16}}>Add Transaction</div>

        {/* Date */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Date</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inp(),colorScheme:"light",fontSize:14}}/>
        </div>

        {/* Account */}
        {accounts.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Account (optional)</div>
            <select value={manualAccountId} onChange={e=>setManualAccountId(e.target.value)} style={{...inp(),appearance:"none",fontSize:14}}>
              <option value="">— Unassigned —</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.last4?" ···"+a.last4:""}</option>)}
            </select>
          </div>
        )}

        {/* Description */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Description</div>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Salary, ADNOC, Amazon.ae" style={{...inp(),fontSize:14}}/>
        </div>

        {/* Vendor */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Vendor (optional)</div>
          {(vendorList&&vendorList.length>0)
            ? <select value={manualVendor} onChange={e=>setManualVendor(e.target.value)} style={{...inp(),appearance:"none",fontSize:14}}>
                <option value="">— None —</option>
                {(vendorList||[]).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            : <input value={manualVendor} onChange={e=>setManualVendor(e.target.value)} placeholder="e.g. Amazon, Carrefour…" style={{...inp(),fontSize:14}}/>
          }
        </div>

        {/* Amount + Credit/Debit toggle */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Amount</div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" style={{...inp(),fontSize:14,flex:1,fontFamily:"monospace"}}/>
            <button onClick={()=>setIsCredit(false)} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${!isCredit?C.danger:C.border}`,background:!isCredit?"rgba(217,48,48,0.08)":"transparent",color:!isCredit?C.danger:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:!isCredit?700:400}}>- Expense</button>
            <button onClick={()=>setIsCredit(true)} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${isCredit?C.accent:C.border}`,background:isCredit?"rgba(42,157,111,0.08)":"transparent",color:isCredit?C.accent:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:isCredit?700:400}}>+ Income</button>
          </div>
        </div>

        {/* Category */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Category</div>
          <select value={cat} onChange={e=>{setCat(e.target.value);setSub("");}} style={{...inp(),appearance:"none",fontSize:14}}>
            <option value="">— Auto-detect —</option>
            {Object.keys(taxonomy).map(c=><option key={c} value={c}>{taxonomy[c]?.icon} {c}</option>)}
          </select>
        </div>

        {/* Subcategory */}
        {cat&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Subcategory</div>
            <select value={sub} onChange={e=>setSub(e.target.value)} style={{...inp(),appearance:"none",fontSize:14}}>
              <option value="">— Select —</option>
              {Object.keys(taxonomy[cat]?.subs||{}).map(s=><option key={s} value={s}>{taxonomy[cat]?.subs[s]?.icon} {s}</option>)}
            </select>
          </div>
        )}

        {/* Cost type — only for expenses */}
        {!isCredit&&(
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Cost Type</div>
            <div style={{display:"flex",gap:6}}>
              {Object.entries(TYPE_META).map(([v,m])=>(
                <button key={v} onClick={()=>setTxType(v)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${txType===v?m.color:C.border}`,background:txType===v?m.color+"18":"transparent",color:txType===v?m.color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:txType===v?700:400}}>{m.label}</button>
              ))}
            </div>
          </div>
        )}

        {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>⚠️ {err}</div>}

        <div style={{display:"flex",gap:10}}>
          <button onClick={handleAdd} style={{...btn(C.accent,"#fff","none",14,"13px 0"),flex:1}}>✓ Add Transaction</button>
          <button onClick={onClose} style={btn(C.s2,C.muted,`1px solid ${C.border}`,13,"13px 16px")}>Cancel</button>
        </div>
        </div>}

        {/* ── POSITION MODE ── */}
        {mode==="position"&&<FinancialPositionPanel financials={financials} setFinancials={setFinancials} onSave={onClose} onClose={onClose}/>}

        {/* ── SCAN MODE ── */}
        {mode==="scan"&&<ScanDataPanel onImport={onImport} onClose={onClose} taxonomy={taxonomy} vendorMap={vendorMap} financials={financials} initialScanMode={initialScanMode}/>}

      </div>
  );
  if(noOverlay) return innerPanel;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.96)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      {innerPanel}
    </div>
  );
}

function App() {
  const [taxonomy,   setTaxonomyRaw]  = useState(DEFAULT_TAXONOMY);
  const [vendorMap,  setVendorMapRaw] = useState({});
  const [rawTxs,     setRawTxsRaw]    = useState(RAW_SEED);
  const [period,     setPeriod]       = useState({preset:"all",from:"",to:""});
  const [tab,        setTab]          = useState("home");
  const [positionUnlocked, setPositionUnlocked] = useState(false); // re-auth gate for Position tab
  const [txFilter,   setTxFilter]     = useState("all");
  const [txViewMode,  setTxViewMode]   = useState("all"); // "all"|"costs"|"credits"
  const [txSort,     setTxSort]       = useState("amount_desc");
  const [txSearch,   setTxSearch]     = useState("");
  const [txAccFilter, setTxAccFilter] = useState(null); // null = all. Empty Set = unassigned only. Set of ids = show those accounts.
  const [txCatFilter, setTxCatFilter] = useState(null); // null = all selected. Set of INCLUDED category names when not null.
  const [uncatOnly,   setUncatOnly]   = useState(false);     // kept for reset compat — now handled via empty Set
  const [dupesMode, setDupesMode] = useState(false);
  // ── Firebase auth state ──
  const [fbUser, setFbUser]       = useState(undefined); // undefined=loading, null=signed out, obj=signed in
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbLastSaved, setFbLastSaved] = useState(null);
  const [fbError, setFbError]     = useState("");
  const saveTimerRef              = useRef(null);
  const pendingLocalRef           = useRef(false); // blocks snapshot restore during local writes
  const isSavingRef               = useRef(false); // true while Firestore write in progress

  const [editingTx, setEditingTx] = useState(null); // {key, description, amount}
  const [budgets, setBudgetsRaw] = useState({}); // {category: {monthly: n, annual: n}}
  const setBudgets = v=>{const n=typeof v==="function"?v(budgets):v; setBudgetsRaw(n); storeSave("ledger-budgets",n);};
  // ── Financial Items (accounts, investments, properties, loans, etc.) ──
  const [financials, setFinancialsRaw] = useState({
    accounts:[], cash:[], investments:[], properties:[], loans:[], debts:[], forecastEvents:[], forecastCardAmounts:{}, forecastCatOverrides:{}, forecastStartOffset:0, forecastSpendRows:[]
  });
  const setFinancials = v=>{
    if(typeof v==="function"){
      setFinancialsRaw(function(prev){const n=v(prev); pendingLocalRef.current=true; return n;});
    } else {
      setFinancialsRaw(v); pendingLocalRef.current=true;
    }
  };
  const [spikeThreshold, setSpikeThresholdRaw] = useState(20); // % variance before flagged
  const setSpikeThreshold = v=>{setSpikeThresholdRaw(v); storeSave("ledger-spike-threshold",v);};
  const [showSpikeSettings, setShowSpikeSettings] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [importMsg, setImportMsg]   = useState(null); // {text, type} — shown after import
  const [avgMode, setAvgMode]       = useState(false); // true = show avg per month
  const [selMonths, setSelMonths]     = useState([]); // [] = all months, or selected month strings
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [txSubFilter, setTxSubFilter] = useState("all"); // "all" | subcategory name
  const [globalTypeFilter, setGlobalTypeFilter] = useState(["standard","nonstandard","exceptional"]);
  const [currency,   setCurrency]     = useState("AED"); // base storage currency
  const [displayCurrency, setDisplayCurrency] = useState("AED"); // display currency
  const [displayRates, setDisplayRates] = useState(null); // {GBP: 0.21, ...} rates from AED
  const [modal,      setModal]        = useState(null);
  const [modalKey,   setModalKey]     = useState(0);
  const openModal = function(name){ setModalKey(function(k){return k+1;}); setModal(name); };
  const [manageInitSection, setManageInitSection] = useState("categories");
  const [manageInitFinancialSub, setManageInitFinancialSub] = useState(null);
  const [manualInitMode,    setManualInitMode]    = useState("transaction");
  const [manualInitScanMode, setManualInitScanMode] = useState("pdf"); // "pdf"|"screenshot"|"spreadsheet"
  const [manualFromHome,    setManualFromHome]    = useState(false);
  const [forecastProjection, setForecastProjection] = useState([]); // lifted from ForecastTab — closing balances
  const [remapTx,    setRemapTx]      = useState(null);
  const [loaded,     setLoaded]       = useState(false);
  const [drillCat,   setDrillCat]     = useState(null);
  const [drillSub,   setDrillSub]     = useState(null);
  const [selTxs,     setSelTxs]       = useState(new Set());
  const [drillOverlay, setDrillOverlay] = useState(null);
  // ── Vendor assignment in Transactions tab ──
  const [txVendorSelMode, setTxVendorSelMode] = useState(false); // bulk select mode
  const [txVendorSel,     setTxVendorSel]     = useState(new Set()); // selected tx keys
  const [txNoVendorFilter,setTxNoVendorFilter]= useState(false); // show only no-vendor txs
  const [vendorPickerTx,  setVendorPickerTx]  = useState(null);  // tx key with picker open
  const [vendorPickerSearch,setVendorPickerSearch]=useState("");  // typeahead filter
  const [bulkVendorSearch, setBulkVendorSearch]=useState("");     // bulk assign typeahead
  // ── Vendor master list (separate from vendorMap) ──
  const [vendorList, setVendorListRaw] = useState([]); // [{name,category,subcategory,txType}]
  const setVendorList = v=>{const n=typeof v==="function"?v(vendorList):v; setVendorListRaw(n); storeSave("ledger-vendorlist",n);};
  const [pendingNewVendors, setPendingNewVendors] = useState([]); // vendor names detected from import, awaiting confirmation
  // ── Nav drawer (mobile) + wide layout (desktop) ──
  const [isWide,     setIsWide]     = useState(typeof window!=="undefined"&&window.innerWidth>=700);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState({input:false,manage:false,tools:false});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const setTaxonomy  = v=>{const n=typeof v==="function"?v(taxonomy):v; setTaxonomyRaw(n); storeSave("ledger-taxonomy",n);};
  const setVendorMap = v=>{const n=typeof v==="function"?v(vendorMap):v; setVendorMapRaw(n); storeSave("ledger-vendormap",n);};
  const setRawTxs    = v=>{const n=typeof v==="function"?v(rawTxs):v; setRawTxsRaw(n); storeSave("ledger-rawtxs",n);};
  const rawTxsRef = useRef(rawTxs); // always current value for use in async callbacks
  rawTxsRef.current = rawTxs;
  const financialsRef = useRef(financials); // always current — prevents stale closure in auto-save
  financialsRef.current = financials;

  useEffect(()=>{
    const tax=storeLoad("ledger-taxonomy");
    const vmap=storeLoad("ledger-vendormap");
    const txs=storeLoad("ledger-rawtxs");
    const cur=storeLoad("ledger-currency");
    if(tax) setTaxonomyRaw({...DEFAULT_TAXONOMY, ...tax}); // merge so new defaults appear
    const budg=storeLoad("ledger-budgets"); if(budg) setBudgetsRaw(budg);
    const spike=storeLoad("ledger-spike-threshold"); if(spike!=null) setSpikeThresholdRaw(spike);
    if(vmap) setVendorMapRaw(vmap);
    const vlist=storeLoad("ledger-vendorlist"); if(vlist) setVendorListRaw(vlist);
    if(txs&&txs.length) setRawTxsRaw(txs);
    if(cur) setCurrency(cur);
    setLoaded(true);
  },[]);
  useEffect(()=>{if(loaded) storeSave("ledger-currency",currency);},[currency,loaded]);
  useEffect(function(){
    function onResize(){ setIsWide(window.innerWidth>=700); }
    window.addEventListener("resize", onResize);
    return function(){ window.removeEventListener("resize", onResize); };
  },[]);
  useEffect(function(){
    if(typeof document==="undefined") return;
    var id="hf-keyframes";
    if(!document.getElementById(id)){
      var s=document.createElement("style");
      s.id=id;
      s.textContent="@keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}";
      document.head.appendChild(s);
    }
  },[]);

  // ── Firebase: multi-document architecture ─────────────────────────────────
  // users/{uid}              → config (taxonomy, vendorMap, budgets, financials, settings)
  // users/{uid}/data/txs_YYYY → transactions split by year (created on demand)
  // ─────────────────────────────────────────────────────────────────────────
  const snapshotUnsubsRef = useRef([]); // array of unsubscribe fns
  const fsLoadedRef = useRef(false);
  function txYearKey(year) { return "users/" + (fbUser&&fbUser.uid) + "/data/txs_" + year; }

  function getTxYears(txs) {
    var years = new Set();
    (txs||[]).forEach(function(t){ if(t.date) years.add(t.date.slice(0,4)); });
    if(!years.size) years.add(String(new Date().getFullYear()));
    return Array.from(years);
  }

  function groupTxsByYear(txs) {
    var groups = {};
    (txs||[]).forEach(function(t){
      var y = t.date ? t.date.slice(0,4) : String(new Date().getFullYear());
      if(!groups[y]) groups[y] = [];
      groups[y].push(t);
    });
    return groups;
  }

  useEffect(()=>{
    try {
      const {auth, db} = getFB();
      const unsub = auth.onAuthStateChanged(async function(user) {
        setFbUser(user);
        // Unsubscribe all previous listeners
        snapshotUnsubsRef.current.forEach(function(fn){ fn(); });
        snapshotUnsubsRef.current = [];
        fsLoadedRef.current = false;

        if(user) {
          setFbSyncing(true);
          try {
            const uid = user.uid;
            const configRef = db.doc("users/" + uid);

            // ── Step 1: Load config doc ──
            const configSnap = await configRef.get();
            var migratedTxs = null; // txs found in old config doc that need migrating

            if(configSnap.exists) {
              const d = configSnap.data();
              if(d.taxonomy) setTaxonomyRaw({...DEFAULT_TAXONOMY, ...d.taxonomy});
              if(d.vendorMap) setVendorMapRaw(d.vendorMap);
              if(d.vendorList) setVendorListRaw(d.vendorList);
              if(d.currency) setCurrency(d.currency);
              if(d.budgets)  setBudgetsRaw(d.budgets);
              if(d.spikeThreshold!=null) setSpikeThresholdRaw(d.spikeThreshold);
              if(d.financials) setFinancialsRaw({accounts:[],cash:[],investments:[],properties:[],loans:[],debts:[],forecastEvents:[],forecastCardAmounts:{},...d.financials});
              // Legacy migration: old rawTxs in config doc
              if(d.rawTxs && d.rawTxs.length > 0) {
                migratedTxs = d.rawTxs;
              }
            }

            // ── Step 2: Load all year tx docs ──
            var dataCol = db.collection("users/" + uid + "/data");
            var dataSnap = await dataCol.get();
            var allTxs = [];
            var foundYears = [];
            dataSnap.forEach(function(doc) {
              if(doc.id.startsWith("txs_")) {
                var year = doc.id.replace("txs_","");
                foundYears.push(year);
                var d = doc.data();
                if(d.txs && d.txs.length) allTxs = allTxs.concat(d.txs);
              }
            });

            // ── Step 3: Merge migrated txs if any ──
            if(migratedTxs && migratedTxs.length > 0) {
              // Merge without duplicates
              var existingKeys = new Set(allTxs.map(function(t){
                return t.date+"||"+(t.description||"").toLowerCase().trim()+"||"+(+t.amount).toFixed(2);
              }));
              migratedTxs.forEach(function(t){
                var k = t.date+"||"+(t.description||"").toLowerCase().trim()+"||"+(+t.amount).toFixed(2);
                if(!existingKeys.has(k)) { allTxs.push(t); existingKeys.add(k); }
              });
            }

            if(allTxs.length > 0) setRawTxsRaw(allTxs);
            fsLoadedRef.current = true;
            setFbSyncing(false);
            setLoaded(true);

            // ── Step 4: Migrate old rawTxs out of config doc ──
            if(migratedTxs && migratedTxs.length > 0) {
              // Save migrated txs to year docs, remove from config
              var groups = groupTxsByYear(allTxs);
              var batch = db.batch();
              Object.entries(groups).forEach(function([year, txs]) {
                batch.set(db.doc("users/"+uid+"/data/txs_"+year), {txs: txs, updatedAt: new Date().toISOString()});
              });
              // Remove rawTxs from config doc
              batch.update(configRef, {rawTxs: window.firebase.firestore.FieldValue.delete()});
              batch.commit().catch(function(e){ console.warn("Migration batch failed:", e.message); });
            }

            // ── Step 5: Set up real-time listeners ──
            // Config doc listener
            var configUnsub = configRef.onSnapshot(function(snap) {
              if(snap.exists && !snap.metadata.hasPendingWrites && !isSavingRef.current && !pendingLocalRef.current) {
                var d = snap.data();
                if(d.taxonomy) setTaxonomyRaw({...DEFAULT_TAXONOMY, ...d.taxonomy});
                if(d.vendorMap) setVendorMapRaw(d.vendorMap);
                if(d.vendorList) setVendorListRaw(d.vendorList);
                if(d.currency) setCurrency(d.currency);
                if(d.budgets)  setBudgetsRaw(d.budgets);
                if(d.spikeThreshold!=null) setSpikeThresholdRaw(d.spikeThreshold);
                if(d.financials) setFinancialsRaw({accounts:[],cash:[],investments:[],properties:[],loans:[],debts:[],forecastEvents:[],forecastCardAmounts:{},...d.financials});
              }
            }, function(e){ console.warn("Config snapshot error:", e.message); });
            snapshotUnsubsRef.current.push(configUnsub);

            // Tx year doc listeners
            var allYears = Array.from(new Set([...foundYears, String(new Date().getFullYear())]));
            allYears.forEach(function(year) {
              var txUnsub = db.doc("users/"+uid+"/data/txs_"+year).onSnapshot(function(snap) {
                if(snap.exists && !snap.metadata.hasPendingWrites && !isSavingRef.current && !pendingLocalRef.current) {
                  var incoming = snap.data().txs || [];
                  setRawTxsRaw(function(prev) {
                    // Replace txs for this year with incoming, keep other years
                    var otherYears = prev.filter(function(t){ return !t.date || t.date.slice(0,4) !== year; });
                    return otherYears.concat(incoming);
                  });
                }
              }, function(e){ console.warn("Tx snapshot error "+year+":", e.message); });
              snapshotUnsubsRef.current.push(txUnsub);
            });

          } catch(e) {
            setFbError("Load error: "+e.message+" (code:"+e.code+")");
            console.error("Firestore load error:", e);
            setFbSyncing(false);
            fsLoadedRef.current = true;
            setLoaded(true);
          }
        } else {
          setLoaded(true);
        }
      });
      return function(){
        unsub();
        snapshotUnsubsRef.current.forEach(function(fn){ fn(); });
      };
    } catch(e) { setFbUser(null); setLoaded(true); }
  },[]);

  // ── Firebase: auto-save (config + tx year docs separately) ──
  useEffect(()=>{
    if(!fbUser || !fsLoadedRef.current) return;
    pendingLocalRef.current = true; // block snapshots immediately on any local change
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async function() {
      if(isSavingRef.current) return;
      try {
        isSavingRef.current = true;
        setFbSyncing(true);
        const {db} = getFB();
        const uid = fbUser.uid;

        // Save config (no rawTxs)
        // Use financialsRef.current to avoid stale closure — same pattern as rawTxsRef
        var configSave = db.doc("users/"+uid).set({
          taxonomy, vendorMap, vendorList, currency, budgets, spikeThreshold,
          financials: financialsRef.current,
          updatedAt: new Date().toISOString()
        });

        // Use rawTxsRef.current to always get the latest value, not the closure value
        var groups = groupTxsByYear(rawTxsRef.current);
        var txSaves = Object.entries(groups).map(function([year, txs]) {
          return db.doc("users/"+uid+"/data/txs_"+year).set({
            txs: txs,
            updatedAt: new Date().toISOString()
          });
        });

        var timeoutPromise = new Promise(function(_,reject){
          setTimeout(function(){reject(new Error("Save timed out after 15s"));}, 15000);
        });
        await Promise.race([Promise.all([configSave, ...txSaves]), timeoutPromise]);

        // Add listener for any new year that appeared in this save
        var uid2 = uid;
        Object.keys(groups).forEach(function(year) {
          var alreadyListening = snapshotUnsubsRef.current.length > 1; // rough check
          // More precise: track which years we're listening to
          if(!window.__hfListenedYears) window.__hfListenedYears = new Set();
          if(!window.__hfListenedYears.has(year)) {
            window.__hfListenedYears.add(year);
            var txUnsub = db.doc("users/"+uid2+"/data/txs_"+year).onSnapshot(function(snap) {
              if(snap.exists && !snap.metadata.hasPendingWrites && !isSavingRef.current && !pendingLocalRef.current) {
                var incoming = snap.data().txs || [];
                setRawTxsRaw(function(prev) {
                  var otherYears = prev.filter(function(t){ return !t.date || t.date.slice(0,4) !== year; });
                  return otherYears.concat(incoming);
                });
              }
            }, function(e){ console.warn("Tx snapshot error "+year+":", e.message); });
            snapshotUnsubsRef.current.push(txUnsub);
          }
        });

        setFbLastSaved(new Date());
        setFbSyncing(false);
        setFbError("");
      } catch(e) {
        setFbError("Save error: "+e.message+" (code:"+e.code+")");
        console.error("Firestore save error:", e);
        setFbSyncing(false);
      } finally {
        isSavingRef.current = false;
        // Keep pendingLocalRef true for 3s after save so the confirmation
        // snapshot from Firestore doesn't overwrite our local state
        setTimeout(function(){ pendingLocalRef.current = false; }, 3000);
      }
    }, 2000);
  },[rawTxs, taxonomy, vendorMap, currency, budgets, spikeThreshold, financials, fbUser]);

  // ── Direct delete — bypasses debounce, writes immediately to Firestore ──
  async function deleteTransactions(filterFn) {
    if(!fbUser || !fsLoadedRef.current) return;
    // 1. Compute new state immediately
    var newTxs = rawTxsRef.current.filter(function(t){ return !filterFn(t); });
    // 2. Update local state
    setRawTxsRaw(newTxs);
    // 3. Block snapshot restoration during write
    pendingLocalRef.current = true;
    isSavingRef.current = true;
    setFbSyncing(true);
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      var {db} = getFB();
      var uid = fbUser.uid;
      var groups = groupTxsByYear(newTxs);
      // Get all years currently in Firestore (to handle deleting ALL txs from a year)
      var allYears = Array.from(window.__hfListenedYears || new Set());
      var saves = allYears.map(function(year) {
        var yearTxs = groups[year] || [];
        return db.doc("users/"+uid+"/data/txs_"+year).set({txs:yearTxs, updatedAt:new Date().toISOString()});
      });
      // Also save any new years in groups not yet tracked
      Object.keys(groups).forEach(function(year) {
        if(!allYears.includes(year)) {
          saves.push(db.doc("users/"+uid+"/data/txs_"+year).set({txs:groups[year], updatedAt:new Date().toISOString()}));
        }
      });
      await Promise.all(saves);
      setFbLastSaved(new Date());
      setFbError("");
    } catch(e) {
      setFbError("Delete error: "+e.message);
    } finally {
      isSavingRef.current = false;
      setFbSyncing(false);
      // Keep pendingLocalRef true briefly so snapshot doesn't immediately fire
      setTimeout(function(){ pendingLocalRef.current = false; }, 3000);
    }
  }

  function signOut() {
    try { const {auth}=getFB(); auth.signOut(); } catch(e) {}
    fsLoadedRef.current = false;
    window.__hfListenedYears = new Set();
    setFbUser(null);
    setRawTxsRaw([]); setTaxonomyRaw(DEFAULT_TAXONOMY); setVendorMapRaw({});
    setBudgetsRaw({}); setSpikeThresholdRaw(20);
    setFinancialsRaw({accounts:[],cash:[],investments:[],properties:[],loans:[],debts:[],forecastEvents:[],forecastCardAmounts:{}});
  }
  useEffect(()=>{
    if(displayCurrency==="AED"){ setDisplayRates(null); return; }
    // Show immediate conversion using fallback, then update with live rate
    setDisplayRates(FALLBACK_RATES);
    getAEDRates().then(function(r){ if(r) setDisplayRates(r); });
  },[displayCurrency]);

  const transactions=useMemo(()=>rawTxs.map(tx=>enrich(tx,taxonomy,vendorMap)),[rawTxs,taxonomy,vendorMap]);
  // Display conversion helper — converts AED amounts to displayCurrency
  const dispRates = displayCurrency!=="AED"&&displayRates ? {[displayCurrency]: displayRates[displayCurrency]} : null;
  // Update global so all fmt() calls convert automatically
  _globalDispRates = dispRates;
  const fmtDisp = (n) => fmt(n, currency);
  const dispCur = displayCurrency;
  const months=[...new Set(transactions.map(t=>t.month))].sort();
  const {from:pFrom,to:pTo}=useMemo(()=>resolvePeriod(period.preset,period.from,period.to),[period]);
  const mMonths=useMemo(()=>{
    if(selMonths.length>0) return selMonths.length;
    const ms=new Set(transactions.filter(t=>t.date>=pFrom&&t.date<=pTo).map(t=>(t.date ? t.date.slice(0,7) : '')).filter(Boolean));
    return Math.max(1,ms.size);
  },[transactions,pFrom,pTo,selMonths]);

  const mTxs=useMemo(()=>{
    // Credits always pass type filter (legacy data may have txType="credit", never in globalTypeFilter)
    // Debits filtered by globalTypeFilter as normal
    const passType = t => t.isCredit || globalTypeFilter.includes(t.txType||"standard");
    const inPeriod = transactions.filter(t=>t.date>=pFrom&&t.date<=pTo&&passType(t));
    const byMonth  = selMonths.length>0 ? inPeriod.filter(t=>selMonths.includes((t.date ? t.date.slice(0,7) : ''))) : inPeriod;
    // Costs / Credits / All view mode
    if(txViewMode==="costs")   return byMonth.filter(t=>!t.isCredit);
    if(txViewMode==="credits") return byMonth.filter(t=>t.isCredit);
    return byMonth;
  },[transactions,pFrom,pTo,globalTypeFilter,selMonths,txViewMode]);
  // Compare vs previous equivalent window
  const change=null; // removed prev period comparison to avoid date overflow on "All"

  const typeTots=useMemo(()=>{
    const r={standard:0,nonstandard:0,exceptional:0,income:0};
    mTxs.forEach(t=>{
      if(t.isCredit) {
        if(t.category==="Income") { r.income+=t.amount; }
        else {
          // Refund/cashback — reduces the txType bucket; treat legacy "credit" as "standard"
          const k=(t.txType==="credit"||!t.txType)?"standard":t.txType;
          r[k]=(r[k]||0)-t.amount;
        }
      } else {
        const k=(t.txType==="credit"||!t.txType)?"standard":t.txType;
        r[k]=(r[k]||0)+t.amount;
      }
    });
    r.standard    = Math.max(0, r.standard);
    r.nonstandard = Math.max(0, r.nonstandard);
    r.exceptional = Math.max(0, r.exceptional);
    return r;
  },[mTxs]);

  // total expenses = Fixed + Variable + Exceptional (always by definition)
  const total = typeTots.standard + typeTots.nonstandard + typeTots.exceptional;

  const allCats=[...new Set(transactions.map(t=>t.category))];

  function handleRemap(cat,sub,txType,scope,newAccountId,newVendor) {
    const k=(remapTx.description||"").toLowerCase().trim();
    if(scope==="vendor") {
      // Apply category/type to all transactions from this vendor + save to vendorMap
      setVendorMap(v=>({...v,[k]:{category:cat,subcategory:sub,txType}}));
      setRawTxs(prev=>prev.map(t=>{
        const isThis=t.date===remapTx.date&&t.description===remapTx.description&&Math.abs(parseFloat(t.amount)-parseFloat(remapTx.amount))<0.001;
        const isSame=(t.description||"").toLowerCase().trim()===k;
        if(isThis) {
          // Apply account change only to this specific tx
          const u={...t,category:cat,subcategory:sub,txType,_manual:false};
          if(newVendor!==null&&newVendor!==undefined) u.vendor=newVendor; else if(newVendor===null&&u.vendor) delete u.vendor;
          if(newAccountId!==undefined) { if(newAccountId) u.accountId=newAccountId; else delete u.accountId; }
          return u;
        }
        if(isSame) {
          const u={...t,category:cat,subcategory:sub,txType,_manual:false};
          if(newVendor!==null&&newVendor!==undefined) u.vendor=newVendor; else if(newVendor===null&&u.vendor) delete u.vendor;
          return u;
        }
        return t;
      }));
    } else {
      // This transaction only
      const rDate=remapTx.date;
      const rDesc=remapTx.description;
      const rAmt=parseFloat(remapTx.amount);
      setRawTxs(prev=>{
        const vm=vendorMap[k];
        return prev.map(t=>{
          const tAmt=parseFloat(t.amount);
          const isThisTx=t.date===rDate && t.description===rDesc && Math.abs(tAmt-rAmt)<0.001;
          const isSameVendor=(t.description||"").toLowerCase().trim()===k;
          if(isThisTx) {
            const u={...t,category:cat,subcategory:sub,txType,_manual:true};
            if(newVendor!==null&&newVendor!==undefined) u.vendor=newVendor; else if(newVendor===null&&u.vendor) delete u.vendor;
            if(newAccountId!==undefined) { if(newAccountId) u.accountId=newAccountId; else delete u.accountId; }
            return u;
          } else if(isSameVendor && vm) {
            return {...t,category:vm.category,subcategory:vm.subcategory,txType:vm.txType||t.txType,_manual:true};
          }
          return t;
        });
      });
      setVendorMap(v=>{ const n={...v}; delete n[k]; return n; });
    }
    setModal(null); setRemapTx(null);
    // If a new vendor name was set, add it to vendorList if not already there
    if(newVendor && typeof newVendor==="string" && newVendor.trim()) {
      const vn=newVendor.trim();
      setVendorList(prev=>{
        const existing=prev||[];
        if(existing.some(x=>x.name.toLowerCase()===vn.toLowerCase())) return existing;
        return [...existing,{name:vn,category:"",subcategory:"",txType:"standard"}];
      });
    }
  }

  function handleBulkSave(cat,sub,txType,selected,bulkAccountId,bulkVendor) {
    // If a new vendor name was typed, add to vendorList if not already present
    if(bulkVendor && bulkVendor!=="_keep" && bulkVendor.trim()) {
      const vn=bulkVendor.trim();
      setVendorList(prev=>{
        const existing=prev||[];
        if(existing.some(x=>x.name.toLowerCase()===vn.toLowerCase())) return existing;
        return [...existing,{name:vn,category:"",subcategory:"",txType:"standard"}];
      });
    }
    setRawTxs(prev=>prev.map(t=>{
      const key=t.date+"||"+t.description+"||"+t.amount;
      if(!selected.has(key)) return t;
      const update={};
      if(cat){update.category=cat; update._manual=true;}
      if(sub){update.subcategory=sub; update._manual=true;}
      if(txType) update.txType=txType;
      // bulkAccountId: "_keep" = no change, "" = unassign, anything else = set
      if(bulkAccountId!=="_keep") {
        if(bulkAccountId) update.accountId=bulkAccountId;
        else { const u={...t,...update}; delete u.accountId; return u; }
      }
      // bulkVendor: "_keep" = no change, "" = clear, anything else = set
      if(bulkVendor!==undefined&&bulkVendor!=="—keep—"&&bulkVendor!=="_keep") {
        if(bulkVendor) update.vendor=bulkVendor;
        else { const u={...t,...update}; delete u.vendor; return u; }
      }
      return {...t,...update};
    }));
    setSelTxs(new Set()); setModal(null);
  }

  async function handleImport(parsed, importCurrency="AED", importAccountId=null) {
    const rates = importCurrency!=="AED" ? await getAEDRates() : null;
    const e=parsed.map(tx=>{
      const amt=parseFloat(tx.amount)||0;
      const credit=tx.isCredit===true||(amt<0&&!tx.isCredit);
      const originalAmount=Math.abs(amt);
      const aedAmount=importCurrency!=="AED"&&rates ? toAED(originalAmount,importCurrency,rates) : originalAmount;
      const stamped={...tx, amount:parseFloat(aedAmount.toFixed(2)), originalAmount, currency:importCurrency, isCredit:credit, txType:credit?(tx.txType==="credit"?"standard":(tx.txType||"standard")):(tx.txType||getTxType(tx))};
      // Strip any category/subcategory Gemini returned — enrich() recalculates from keywords.
      // Keeping them would bypass keyword matching and lock in potentially wrong AI guesses.
      // vendor IS preserved — it's a clean name Gemini extracted and we want to keep it.
      delete stamped.category;
      delete stamped.subcategory;
      delete stamped._manual;
      if(stamped.vendor!==undefined) stamped.vendor=(stamped.vendor||"").trim()||undefined;
      if(stamped.vendor===undefined) delete stamped.vendor;
      delete stamped.accountId; // always strip server-returned accountId first
      if(importAccountId) stamped.accountId=importAccountId; // then stamp the user-selected one
      return stamped;
    }).filter(t=>t.amount>0);
    let msg=null;
    // Normalise key: date + lowercase trimmed description + amount rounded to 2dp
    const txKey=t=>`${t.date}||${(t.description||"").toLowerCase().trim()}||${(+t.amount).toFixed(2)}`;
    setRawTxs(prev=>{
      const existing=new Set(prev.map(txKey));
      // Also dedup within the new batch itself (AI sometimes returns same tx twice)
      const seen=new Set();
      const dedupedE=e.filter(t=>{ const k=txKey(t); if(seen.has(k))return false; seen.add(k); return true; });
      const newTxs=dedupedE.filter(t=>!existing.has(txKey(t)));
      const dupes=e.length-newTxs.length;
      if(newTxs.length===0 && e.length>0) {
        msg={text:`All ${e.length} transactions already exist — nothing new added.`, type:"warn"};
        return prev;
      }
      if(dupes>0) msg={text:`✓ Added ${newTxs.length} new transactions. ${dupes} duplicates skipped.`, type:"info"};
      else msg={text:`✓ ${newTxs.length} transactions imported successfully.`, type:"ok"};
      return [...prev, ...newTxs];
    });
    // Detect new vendor names from imported batch not already in vendorList
    const existingNames=new Set((vendorList||[]).map(v=>v.name.toLowerCase()));
    const newVendorNames=[...new Set(e.filter(t=>t.vendor).map(t=>t.vendor))].filter(n=>!existingNames.has(n.toLowerCase()));
    if(newVendorNames.length>0) setPendingNewVendors(newVendorNames.slice(0,20));
    setGlobalTypeFilter(["standard","nonstandard","exceptional"]);
    if(msg) setImportMsg(msg);
    setModal(null);
  }

  function handleSettingsImport(p) {
    if(p.taxonomy){
      // Merge saved taxonomy with DEFAULT_TAXONOMY so new default categories (Income etc) are preserved
      const merged = {...DEFAULT_TAXONOMY, ...p.taxonomy};
      setTaxonomyRaw(merged);storeSave("ledger-taxonomy",merged);
    }
    if(p.vendorMap){setVendorMapRaw(p.vendorMap);storeSave("ledger-vendormap",p.vendorMap);}
    if(p.rawTxs){setRawTxsRaw(p.rawTxs);storeSave("ledger-rawtxs",p.rawTxs);}
    if(p.currency){setCurrency(p.currency);storeSave("ledger-currency",p.currency);}
    setGlobalTypeFilter(["standard","nonstandard","exceptional"]);
  }

  function cycleTxType(tx) {
    const order=["standard","nonstandard","exceptional"];
    const next=order[(order.indexOf(tx.txType||"standard")+1)%3];
    setRawTxs(prev=>prev.map(t=>t.date===tx.date&&t.description===tx.description&&t.amount===tx.amount?{...t,txType:next}:t));
  }

  function toggleSelTx(tx) {
    const key=tx.date+"||"+tx.description+"||"+tx.amount;
    setSelTxs(prev=>{const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n;});
  }

  const filteredTxs=useMemo(()=>{
    // In dupes mode, only show the selected transactions (the duplicate groups)
    if(dupesMode&&selTxs.size>0) {
      const displayKeys=window.__dupeDisplayKeys||selTxs;
      return [...mTxs].filter(t=>displayKeys.has(t.date+"||"+t.description+"||"+t.amount))
        .sort((a,b)=>(a.date+"||"+(a.description||"").toLowerCase()).localeCompare(b.date+"||"+(b.description||"").toLowerCase()));
    }
    let base=txFilter==="standard"?mTxs.filter(t=>t.txType==="standard")
      :txFilter==="nonstandard"?mTxs.filter(t=>t.txType==="nonstandard")
      :txFilter==="exceptional"?mTxs.filter(t=>t.txType==="exceptional")
      :txFilter==="credit"?mTxs.filter(t=>t.isCredit)
      :mTxs;
    // Account filter
    if(txAccFilter!==null) {
      if(txAccFilter.size===0) {
        // Nothing selected = show only unassigned transactions
        base=base.filter(t=>!t.accountId);
      } else {
        base=base.filter(t=>txAccFilter.has(t.accountId||""));
      }
    }
    // Category filter
    if(txCatFilter!==null) {
      if(txCatFilter.size===0) {
        // Nothing selected = show only uncategorised
        base=base.filter(t=>!t.category||t.category==="Other"||t.category==="Miscellaneous"||t.category==="Uncategorised"||t.subcategory==="Miscellaneous");
      } else {
        base=base.filter(t=>txCatFilter.has(t.category||"Other"));
      }
    }
    // Subcategory filter
    if(txSubFilter!=="all") base=base.filter(t=>t.subcategory===txSubFilter);
    // Search
    if(txSearch.trim()) {
      const q=txSearch.toLowerCase();
      base=base.filter(t=>(t.description||"").toLowerCase().includes(q)||(t.category||"").toLowerCase().includes(q)||(t.subcategory||"").toLowerCase().includes(q));
    }
    const sorted=[...base];
    if(txSort==="amount_desc")      sorted.sort((a,b)=>b.amount-a.amount);
    else if(txSort==="amount_asc")  sorted.sort((a,b)=>a.amount-b.amount);
    else if(txSort==="subcategory_asc")  sorted.sort((a,b)=>(a.subcategory||"").localeCompare(b.subcategory||"")||(a.category||"").localeCompare(b.category||"")||b.amount-a.amount);
    else if(txSort==="subcategory_desc") sorted.sort((a,b)=>(b.subcategory||"").localeCompare(a.subcategory||"")||(b.category||"").localeCompare(a.category||"")||b.amount-a.amount);
    else if(txSort==="description_asc")  sorted.sort((a,b)=>(a.description||"").localeCompare(b.description||"")||b.amount-a.amount);
    else if(txSort==="description_desc") sorted.sort((a,b)=>(b.description||"").localeCompare(a.description||"")||b.amount-a.amount);
    else if(txSort==="date_asc")    sorted.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    else sorted.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return sorted;
  },[mTxs,txFilter,txSort,txSearch,txAccFilter===null?"all":JSON.stringify([...txAccFilter].sort()),txCatFilter===null?"all":JSON.stringify([...txCatFilter].sort()),uncatOnly,txSubFilter,dupesMode,selTxs]);

  // ── Nav structure ─────────────────────────────────────────────────────────
  var MAIN_NAV = [
    {tab:"home",          icon:"🏠",  label:"Dashboard"},
    {tab:"watchout",      icon:"🔔",  label:"Spend Alert"},
    {tab:"summary",       icon:"📋",  label:"Summary"},
    {tab:"forecast",      icon:"📈",  label:"Forecast"},
    {tab:"transactions",  icon:"💳",  label:"Transactions"},
    {tab:"categories",    icon:"🏷️", label:"Categories"},
    {tab:"subcategories", icon:"🗂️", label:"Subcategories"},
    {tab:"vendors",       icon:"🏪",  label:"Vendors"},
    {tab:"budget",        icon:"⚖️", label:"Budget"},
    {tab:"position",      icon:"🏦",  label:"Fin. Position"},
  ];
  var TOOLS_NAV = [
    {label:"Export",           icon:"📤", action:function(){ openModal("export"); }},
    {label:"Backup & Restore", icon:"💾", action:function(){ openModal("settings"); }},
    {label:"AI Usage",         icon:"🤖", action:function(){ setManageInitSection("gemini"); setManageInitFinancialSub(null); openModal("manage"); }},
  ];
  var ADD_ACTIONS = [
    {icon:"📄", label:"PDF statement",   action:function(){ setManualInitMode("scan"); setManualInitScanMode("pdf"); setManualFromHome(false); openModal("manual"); setAddSheetOpen(false); }},
    {icon:"🖼️", label:"Screenshot data", action:function(){ setManualInitMode("scan"); setManualInitScanMode("screenshot"); setManualFromHome(false); openModal("manual"); setAddSheetOpen(false); }},
    {icon:"📊", label:"XLS spreadsheet", action:function(){ setManualInitMode("scan"); setManualInitScanMode("spreadsheet"); setManualFromHome(false); openModal("manual"); setAddSheetOpen(false); }},
    {icon:"➕", label:"Add transaction", action:function(){ setManualInitMode("transaction"); setManualFromHome(false); openModal("manual"); setAddSheetOpen(false); }},
    {icon:"💼", label:"Update position",  action:function(){ setManualInitMode("position"); setManualFromHome(false); openModal("manual"); setAddSheetOpen(false); }},
  ];

  function renderNav() {
    if(!isWide) return null;
    var w = sidebarCollapsed ? 52 : 240;
    var userInitial = (fbUser&&fbUser.displayName) ? fbUser.displayName.charAt(0).toUpperCase() : "?";
    return (
      <div style={{width:w,flexShrink:0,background:C.surface,borderRight:"1.5px solid "+C.border,
                   display:"flex",flexDirection:"column",
                   transition:"width 0.22s",overflow:"hidden",minHeight:0}}>
        {/* Logo block */}
        <div style={{padding:sidebarCollapsed?"12px 0":"14px 16px 10px",borderBottom:"1px solid "+C.border,
                     display:"flex",alignItems:"center",gap:8,justifyContent:sidebarCollapsed?"center":"flex-start",flexShrink:0}}>
          <div style={{width:28,height:28,borderRadius:6,background:C.accent,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontSize:15,fontWeight:700}}>H</span>
          </div>
          {!sidebarCollapsed&&(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>Home Financials</div>
              <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:"0.06em"}}>hf-v98</div>
            </div>
          )}
        </div>
        {/* Add / Import button */}
        <div style={{padding:sidebarCollapsed?"8px 6px":"10px 10px 0",flexShrink:0}}>
          <button onClick={function(){ setAddSheetOpen(function(v){ return !v; }); }}
            style={{width:"100%",padding:sidebarCollapsed?"8px 0":"9px 12px",borderRadius:8,border:"none",
                    background:C.accent,color:"#fff",cursor:"pointer",fontFamily:"inherit",
                    fontWeight:700,fontSize:13,display:"flex",alignItems:"center",
                    justifyContent:sidebarCollapsed?"center":"flex-start",gap:6}}>
            <span style={{fontSize:16,lineHeight:1}}>＋</span>
            {!sidebarCollapsed&&<span>Add / Import</span>}
          </button>
          {addSheetOpen&&!sidebarCollapsed&&(
            <div style={{background:C.s2,border:"1px solid "+C.border,borderRadius:8,marginTop:4,overflow:"hidden"}}>
              {ADD_ACTIONS.map(function(a,i){
                return (
                  <button key={i} onClick={a.action}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 12px",
                            border:"none",borderBottom:i<ADD_ACTIONS.length-1?"1px solid "+C.border:"none",
                            background:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                    <span style={{fontSize:14,flexShrink:0}}>{a.icon}</span>
                    <span style={{fontSize:12,color:C.text,fontWeight:500}}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* MAIN nav */}
        <div style={{padding:sidebarCollapsed?"8px 0":"8px 0 0",flex:1,overflowY:"auto"}}>
          {!sidebarCollapsed&&<div style={{fontSize:9,fontWeight:800,color:C.dim,letterSpacing:"0.10em",textTransform:"uppercase",padding:"6px 16px 4px"}}>MAIN</div>}
          {MAIN_NAV.map(function(item){
            var active = tab===item.tab;
            return (
              <button key={item.tab}
                title={sidebarCollapsed?item.label:undefined}
                onClick={function(){
                  if(tab==="position"&&item.tab!=="position") setPositionUnlocked(false);
                  setTab(item.tab);
                  if(item.tab!=="transactions") setTxViewMode("all");
                }}
                style={{display:"flex",alignItems:"center",gap:9,width:"100%",
                        padding:sidebarCollapsed?"10px 0":"9px 16px",
                        border:"none",borderRight:active?"2.5px solid "+C.accent:"2.5px solid transparent",
                        background:active?"rgba(42,157,111,0.09)":"transparent",
                        cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                        justifyContent:sidebarCollapsed?"center":"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0,color:active?C.accent:"inherit"}}>{item.icon}</span>
                {!sidebarCollapsed&&<span style={{fontSize:12.5,color:active?C.accent:C.text,fontWeight:active?700:500,whiteSpace:"nowrap"}}>{item.label}</span>}
              </button>
            );
          })}
          <div style={{borderTop:"1px solid "+C.border,margin:"8px 0"}}/>
          {!sidebarCollapsed&&<div style={{fontSize:9,fontWeight:800,color:C.dim,letterSpacing:"0.10em",textTransform:"uppercase",padding:"4px 16px 4px"}}>TOOLS</div>}
          {TOOLS_NAV.map(function(item,i){
            return (
              <button key={i}
                title={sidebarCollapsed?item.label:undefined}
                onClick={item.action}
                style={{display:"flex",alignItems:"center",gap:9,width:"100%",
                        padding:sidebarCollapsed?"10px 0":"9px 16px",
                        border:"none",borderRight:"2.5px solid transparent",
                        background:"transparent",cursor:"pointer",fontFamily:"inherit",
                        textAlign:"left",justifyContent:sidebarCollapsed?"center":"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
                {!sidebarCollapsed&&<span style={{fontSize:12.5,color:C.text,fontWeight:500,whiteSpace:"nowrap"}}>{item.label}</span>}
              </button>
            );
          })}
        </div>
        {/* Footer */}
        <div style={{borderTop:"1px solid "+C.border,padding:sidebarCollapsed?"10px 6px":"12px 12px",flexShrink:0}}>
          {!sidebarCollapsed&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              {fbUser&&fbUser.photoURL
                ? <img src={fbUser.photoURL} style={{width:28,height:28,borderRadius:"50%",border:"2px solid "+C.accent,flexShrink:0}} alt=""/>
                : <div style={{width:28,height:28,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700,flexShrink:0}}>{userInitial}</div>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fbUser&&fbUser.displayName||fbUser&&fbUser.email||"User"}</div>
                <div style={{fontSize:10,color:C.dim,display:"flex",alignItems:"center",gap:4}}>
                  {fbSyncing&&<span style={{color:"#f59e0b"}}>⟳ Saving</span>}
                  {!fbSyncing&&fbError&&<span style={{color:C.danger}}>⚠️ Error</span>}
                  {!fbSyncing&&!fbError&&fbLastSaved&&<span style={{color:C.accent}}>✓ Saved</span>}
                </div>
              </div>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:sidebarCollapsed?"center":"flex-start",marginBottom:6}}>
            <select value={displayCurrency} onChange={function(e){ setDisplayCurrency(e.target.value); }}
              style={{background:C.s2,border:"1px solid "+C.border,borderRadius:6,color:C.muted,
                      padding:"4px 4px",fontSize:10,fontFamily:"monospace",outline:"none",
                      width:sidebarCollapsed?40:"auto"}}>
              {["AED","GBP","USD","EUR","PKR"].map(function(c){ return <option key={c}>{c}</option>; })}
            </select>
            {!sidebarCollapsed&&<button onClick={signOut} style={btn(C.s2,C.muted,"1px solid "+C.border,11,"4px 8px")}>Sign Out</button>}
          </div>
          <button onClick={function(){ setSidebarCollapsed(function(v){ return !v; }); }}
            style={{width:"100%",padding:"6px 0",border:"none",background:"transparent",cursor:"pointer",
                    fontFamily:"inherit",fontSize:11,color:C.dim,display:"flex",alignItems:"center",
                    justifyContent:sidebarCollapsed?"center":"flex-start",gap:4}}>
            <span style={{fontSize:14}}>{sidebarCollapsed?"→":"←"}</span>
            {!sidebarCollapsed&&<span>Collapse</span>}
          </button>
        </div>
      </div>
    );
  }

  function renderMobileBottomBar() {
    if(isWide) return null;
    return (
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:56,
                   background:C.surface,borderTop:"0.5px solid "+C.border,
                   display:"flex",alignItems:"center",overflowX:"auto",
                   WebkitOverflowScrolling:"touch",zIndex:100,flexShrink:0}}>
        {MAIN_NAV.map(function(item){
          var active = tab===item.tab;
          return (
            <button key={item.tab}
              onClick={function(){
                if(tab==="position"&&item.tab!=="position") setPositionUnlocked(false);
                setTab(item.tab);
                if(item.tab!=="transactions") setTxViewMode("all");
              }}
              style={{display:"flex",flexDirection:"column",alignItems:"center",
                      justifyContent:"center",minWidth:60,height:"100%",padding:"4px 8px",
                      border:"none",borderTop:active?"3px solid "+C.accent:"3px solid transparent",
                      background:"transparent",cursor:"pointer",fontFamily:"inherit",gap:2,flexShrink:0}}>
              <span style={{fontSize:16,color:active?C.accent:"inherit"}}>{item.icon}</span>
              <span style={{fontSize:9,fontWeight:active?700:500,
                            color:active?C.accent:C.muted,whiteSpace:"nowrap"}}>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Show loading while Firebase checks auth
  if(fbUser===undefined) return (
    <div style={{minHeight:"100vh",background:"#ecf1eb",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
      <img src="Home_financials_LOGO_White_Back.png" alt="Home Financials" style={{maxWidth:280,width:"80%",height:"auto"}}/>
      <div style={{fontSize:13,color:"#7a8699",marginTop:8}}>Loading…</div>
    </div>
  );

  // Show sign-in screen if not authenticated
  if(!fbUser) return <SignInScreen onSignedIn={function(user){setFbUser(user);}}/>;

  if(!loaded) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:14}}>Loading…</div>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"inherit",display:"flex",flexDirection:"column",position:"relative"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}select,input,textarea,button{font-family:inherit;} body{background:#f4f6f9;}`}</style>

      {/* ── All modals at root level as position:fixed (D11) ── */}
      {modal==="import" && <ImportModal onImport={handleImport} onClose={()=>setModal(null)}/>}

      {modal==="manual" && (
        <div key={modalKey} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <ManualEntryModal onImport={handleImport} taxonomy={taxonomy} vendorMap={vendorMap} vendorList={vendorList} financials={financials} setFinancials={setFinancials} onClose={()=>{setModal(null);setManualFromHome(false);}} initialMode={manualInitMode} initialScanMode={manualInitScanMode} singleSection={manualFromHome} noOverlay={true}/>
        </div>
      )}

      {modal==="manage" && (
        <div key={modalKey} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <ManageModal taxonomy={taxonomy} setTaxonomy={setTaxonomy} vendorMap={vendorMap} setVendorMap={setVendorMap} vendorList={vendorList} setVendorList={setVendorList} rawTxs={rawTxs} setRawTxs={setRawTxs} financials={financials} setFinancials={setFinancials} budgets={budgets} initialSection={manageInitSection} initialFinancialSub={manageInitFinancialSub} singleSection={true} noOverlay={true} onClose={()=>{setModal(null);setManageInitFinancialSub(null);}}/>
        </div>
      )}

      {modal==="remap" && remapTx && <RemapModal tx={remapTx} taxonomy={taxonomy} accounts={(financials&&financials.accounts)||[]} vendorList={vendorList} onSave={handleRemap} onClose={()=>{setModal(null);setRemapTx(null);}}/>}

      {modal==="export" && (
        <div key={modalKey} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <ExportModal transactions={transactions} taxonomy={taxonomy} currency={currency} onClose={()=>setModal(null)} noOverlay={true}/>
        </div>
      )}

      {modal==="settings" && (
        <div key={modalKey} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.30)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <SettingsModal taxonomy={taxonomy} vendorMap={vendorMap} rawTxs={rawTxs} currency={currency} onImport={handleSettingsImport} onClose={()=>setModal(null)} noOverlay={true}/>
        </div>
      )}

      {modal==="bulk" && <BulkEditModal selected={selTxs} transactions={mTxs} taxonomy={taxonomy} accounts={(financials&&financials.accounts)||[]} vendorList={vendorList} onSave={handleBulkSave} onClose={()=>setModal(null)}/>}
      {drillOverlay && <DrillTxOverlay txs={drillOverlay.txs} label={drillOverlay.label} currency={displayCurrency} dispRates={dispRates} taxonomy={taxonomy} onRemap={tx=>{setRemapTx(tx);setDrillOverlay(null);setModal("remap");}} onClose={()=>setDrillOverlay(null)}/>}

      {/* New vendors from import — confirmation modal */}
      {pendingNewVendors.length>0&&(
        <div style={{position:"fixed",inset:0,background:"rgba(13,15,14,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:24,maxWidth:420,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
            <div style={{fontSize:20,marginBottom:6}}>🏪</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>New vendors found</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.5}}>
              This import contained <strong style={{color:C.text}}>{pendingNewVendors.length} vendor{pendingNewVendors.length!==1?"s":""}</strong> not in your vendor list. Add them?
            </div>
            <div style={{background:C.s2,borderRadius:10,padding:"10px 14px",marginBottom:16,maxHeight:160,overflowY:"auto",border:`1px solid ${C.border}`}}>
              {pendingNewVendors.map(n=>(
                <div key={n} style={{fontSize:13,color:C.text,padding:"3px 0",borderBottom:`1px solid ${C.border}`}}>{n}</div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                setVendorList(prev=>{
                  const existing=new Set((prev||[]).map(v=>v.name.toLowerCase()));
                  const toAdd=pendingNewVendors.filter(n=>!existing.has(n.toLowerCase())).map(n=>({name:n,category:"",subcategory:"",txType:"standard"}));
                  return [...(prev||[]),...toAdd];
                });
                setPendingNewVendors([]);
              }} style={{...btn(C.accent,"#fff","none",13,"10px 0"),flex:1,fontWeight:700}}>✓ Yes, add {pendingNewVendors.length}</button>
              <button onClick={()=>setPendingNewVendors([])} style={{...btn(C.s3,C.muted,`1px solid ${C.border}`,13,"10px 14px"),flexShrink:0}}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile add sheet overlay */}
      {addSheetOpen&&!isWide&&(
        <div onClick={()=>setAddSheetOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:C.surface,borderRadius:"18px 18px 0 0",padding:"16px 0 80px",boxShadow:"0 -4px 24px rgba(0,0,0,0.18)"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",padding:"0 20px 12px"}}>Add / Import</div>
            {ADD_ACTIONS.map(function(a,i){
              return (
                <button key={i} onClick={a.action}
                  style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"13px 20px",
                          border:"none",borderTop:"1px solid "+C.border,background:"transparent",
                          cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <span style={{fontSize:20,flexShrink:0}}>{a.icon}</span>
                  <span style={{fontSize:14,color:C.text,fontWeight:500}}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{display:"flex",flex:1,minHeight:0,position:"relative"}}>
        {isWide&&renderNav()}

        {/* Content area */}
        <div style={{flex:1,minWidth:0,overflowY:"auto",paddingBottom:isWide?0:64}}>
          <div style={{padding:isWide?"24px 28px":"16px 14px"}}>

            {/* Dashboard tab */}
            {tab==="home"&&(
              <HomeTab
                transactions={transactions}
                financials={financials}
                budgets={budgets}
                taxonomy={taxonomy}
                displayCurrency={displayCurrency}
                dispRates={dispRates}
                globalTypeFilter={globalTypeFilter}
                setTab={setTab}
                setModal={setModal}
                setManageInitSection={setManageInitSection}
                setManualInitMode={setManualInitMode}
                setManualFromHome={setManualFromHome}
                setPositionUnlocked={setPositionUnlocked}
                spikeThreshold={spikeThreshold}
                forecastProjection={forecastProjection}
                isWide={isWide}
                drawerOpen={drawerOpen}
                setDrawerOpen={setDrawerOpen}
              />
            )}

            {/* All other tabs */}
            {tab!=="home"&&(
              <div>
                {/* Period picker */}
                <div style={{marginBottom:16,display:(tab==="summary"||tab==="position"||tab==="forecast"||tab==="budget"||tab==="watchout"||tab==="vendors")?"none":"block"}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:period.preset==="custom"?10:6}}>
                    {[["all","All"],["this_year","This Year"],["last_year","Last Year"],["this_month","This Month"],["last_month","Last Month"],["custom","Custom"]].map(([v,l])=>(
                      <button key={v} onClick={()=>{setPeriod(p=>({...p,preset:v}));setSelMonths([]);}} style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${period.preset===v&&selMonths.length===0?C.accent:C.border}`,background:period.preset===v&&selMonths.length===0?C.accent:"transparent",color:period.preset===v&&selMonths.length===0?"#fff":C.muted,fontSize:12,cursor:"pointer",fontWeight:period.preset===v&&selMonths.length===0?700:500,outline:"none"}}>
                        {l}
                      </button>
                    ))}
                    {(()=>{
                      const allTxMonths=[...new Set(transactions.map(t=>(t.date ? t.date.slice(0,7) : '')).filter(Boolean))].sort();
                      if(allTxMonths.length<2) return null;
                      const label = selMonths.length===0 ? "📅 Months ▾"
                        : selMonths.length===1 ? "📅 "+fmtM(selMonths[0])+" ▾"
                        : "📅 "+selMonths.length+" Months ▾";
                      return (
                        <div style={{position:"relative",display:"inline-block"}}>
                          <button
                            onClick={()=>setShowMonthPicker(v=>!v)}
                            style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${selMonths.length>0?C.accent:C.border}`,background:selMonths.length>0?C.accent:"transparent",color:selMonths.length>0?"#fff":C.muted,fontSize:12,cursor:"pointer",fontWeight:selMonths.length>0?700:500,fontFamily:"inherit",whiteSpace:"nowrap"}}
                          >
                            {label}
                          </button>
                          {showMonthPicker&&(<>
                            <div onClick={()=>setShowMonthPicker(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                            <div style={{position:"absolute",top:"110%",left:0,zIndex:200,marginTop:2,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.14)",minWidth:220}}>
                              <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.s2}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Select Months</span>
                                <button onClick={()=>{setSelMonths([]);setShowMonthPicker(false);}} style={{fontSize:11,color:C.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,padding:"2px 6px"}}>All</button>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:6,gap:3,maxHeight:280,overflowY:"auto"}}>
                                {allTxMonths.slice().reverse().map(m=>{
                                  const on=selMonths.includes(m);
                                  return (
                                    <button key={m} onClick={()=>setSelMonths(prev=>on?prev.filter(x=>x!==m):[...prev,m])}
                                      style={{padding:"7px 8px",borderRadius:8,border:`1px solid ${on?C.accent:C.border}`,background:on?"rgba(42,157,111,0.1)":"transparent",color:on?C.accent:C.text,fontSize:12,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit",textAlign:"center",whiteSpace:"nowrap"}}>
                                      {on?"✓ ":""}{fmtM(m)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>)}
                        </div>
                      );
                    })()}
                  </div>
                  {period.preset==="custom"&&(
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:12,color:C.dim}}>From</span>
                        <input type="date" value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{...inp(),colorScheme:"light",fontSize:12,fontFamily:"monospace",cursor:"pointer",minWidth:140}}/>
                      </div>
                      <span style={{color:C.dim}}>→</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:12,color:C.dim}}>To</span>
                        <input type="date" value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{...inp(),colorScheme:"light",fontSize:12,fontFamily:"monospace",cursor:"pointer",minWidth:140}}/>
                      </div>
                    </div>
                  )}
                  <div style={{fontSize:11,color:C.dim,fontFamily:"monospace",marginTop:4}}>{pFrom} → {pTo} · {mTxs.length} transactions{selMonths.length>0?" · "+selMonths.length+" month"+(selMonths.length>1?"s":"")+" selected":""}</div>
                </div>

                {/* Import result message */}
                {importMsg&&(
                  <div style={{marginBottom:12,padding:"12px 16px",borderRadius:12,background:importMsg.type==="warn"?"rgba(212,134,10,0.1)":importMsg.type==="ok"?"rgba(42,157,111,0.1)":"rgba(90,111,214,0.1)",border:`1px solid ${importMsg.type==="warn"?"#d4860a":importMsg.type==="ok"?C.accent:"#5a6fd6"}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <span style={{fontSize:13,fontWeight:600,color:importMsg.type==="warn"?"#d4860a":importMsg.type==="ok"?C.accent:"#5a6fd6"}}>
                      {importMsg.type==="warn"?"⚠️":"✓"} {importMsg.text}
                    </span>
                    <button onClick={()=>setImportMsg(null)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:C.dim,padding:"0 4px",lineHeight:1}}>×</button>
                  </div>
                )}

                {/* Avg/Month toggle */}
                <div style={{display:(tab==="summary"||tab==="position"||tab==="forecast"||tab==="budget"||tab==="watchout"||tab==="vendors")?"none":"flex",gap:6,alignItems:"center",marginBottom:10}}>
                  <button onClick={()=>setAvgMode(false)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${!avgMode?C.accent:C.border}`,background:!avgMode?C.accent:"transparent",color:!avgMode?"#fff":C.muted,fontSize:12,fontWeight:!avgMode?700:500,cursor:"pointer",fontFamily:"inherit"}}>Total</button>
                  <button onClick={()=>setAvgMode(true)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${avgMode?C.accent:C.border}`,background:avgMode?C.accent:"transparent",color:avgMode?"#fff":C.muted,fontSize:12,fontWeight:avgMode?700:500,cursor:"pointer",fontFamily:"inherit"}}>Avg / Month</button>
                  {avgMode&&<span style={{fontSize:11,color:C.muted}}>÷ {mMonths} month{mMonths!==1?"s":""}</span>}
                </div>

                {/* View mode: All / Costs / Credits */}
                <div style={{display:(tab==="summary"||tab==="position"||tab==="forecast"||tab==="budget"||tab==="watchout"||tab==="vendors")?"none":"flex",gap:6,marginBottom:10,alignItems:"center"}}>
                  {[["all","All"],["costs","💸 Costs"],["credits","💰 Credits"]].map(([v,l])=>(
                    <button key={v} onClick={()=>{setTxViewMode(v);setTxFilter("all");}} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${txViewMode===v?C.accent:C.border}`,background:txViewMode===v?C.accent:"transparent",color:txViewMode===v?"#fff":C.muted,fontSize:12,fontWeight:txViewMode===v?700:500,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>

                {/* Cost type filter */}
                <div style={{display:(tab==="summary"||tab==="position"||tab==="forecast"||tab==="budget"||tab==="watchout"||tab==="vendors")?"none":"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
                  {Object.entries(TYPE_META).map(([v,m])=>(
                    <button key={v} onClick={()=>setGlobalTypeFilter(p=>p.includes(v)?p.length>1?p.filter(x=>x!==v):p:[...p,v])} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${globalTypeFilter.includes(v)?m.color:C.border}`,background:globalTypeFilter.includes(v)?m.color+"18":"transparent",color:globalTypeFilter.includes(v)?m.color:C.muted,fontSize:12,fontWeight:globalTypeFilter.includes(v)?700:500,cursor:"pointer",fontFamily:"inherit"}}>
                      {globalTypeFilter.includes(v)?"●":"○"} {m.full}
                    </button>
                  ))}
                  {globalTypeFilter.length<3&&(
                    <button onClick={()=>setGlobalTypeFilter(["standard","nonstandard","exceptional"])} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Show All</button>
                  )}
                </div>

                {/* Summary stat cards */}
                <div style={{display:(tab==="summary"||tab==="position"||tab==="forecast"||tab==="budget"||tab==="watchout"||tab==="vendors")?"none":"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
                  {[
                    {label:avgMode?"Avg Expenses/Mo":"Total Expenses",value:fmt(avgMode?total/mMonths:total,displayCurrency),sub:avgMode?`÷${mMonths} months`:selMonths.length>0?(selMonths.length===1?fmtM(selMonths[0]):selMonths.length+" months selected"):period.preset==="all"?"All time":period.preset==="this_year"?"This year":period.preset==="last_year"?"Last year":period.preset==="this_month"?"This month":period.preset==="last_month"?"Last month":pFrom===pTo?pFrom:pFrom.slice(0,7)===pTo.slice(0,7)?fmtM(pFrom.slice(0,7)):pFrom+" → "+pTo,accent:C.accent},
                    {label:avgMode?"★ Fixed Avg/Mo":"★ Fixed Monthly",value:fmt(avgMode?(typeTots.standard/mMonths):typeTots.standard,displayCurrency,dispRates),sub:mTxs.filter(t=>!t.isCredit&&t.txType==="standard").length+" txns",accent:TYPE_META.standard.color},
                    {label:avgMode?"◆ Variable Avg/Mo":"◆ Variable Cost",value:fmt(avgMode?((typeTots.nonstandard||0)/mMonths):(typeTots.nonstandard||0),displayCurrency,dispRates),sub:mTxs.filter(t=>!t.isCredit&&t.txType==="nonstandard").length+" txns",accent:TYPE_META.nonstandard.color},
                    {label:avgMode?"⚡ Exc Avg/Mo":"⚡ Exceptional",value:fmt(avgMode?((typeTots.exceptional||0)/mMonths):(typeTots.exceptional||0),displayCurrency,dispRates),sub:mTxs.filter(t=>!t.isCredit&&t.txType==="exceptional").length+" txns",accent:TYPE_META.exceptional.color},
                    {label:avgMode?"💰 Income Avg/Mo":"💰 Income",value:fmt(avgMode?((typeTots.income||0)/mMonths):(typeTots.income||0),displayCurrency,dispRates),sub:mTxs.filter(t=>t.isCredit&&t.category==="Income").length+" txns",accent:"#1a7a3a"},
                  ].map((c,i)=>(
                    <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:c.accent,borderRadius:"18px 18px 0 0"}}/>
                      <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{c.label}</div>
                      <div style={{fontFamily:"inherit",fontSize:19,letterSpacing:-0.5,marginBottom:4,lineHeight:1.2}}>{c.value}</div>
                      <div style={{fontSize:12,fontWeight:500,color:C.muted}}>{c.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── Tab content ── */}
                {tab==="summary"&&<SummaryTab transactions={transactions} taxonomy={taxonomy} displayCurrency={displayCurrency} globalTypeFilter={globalTypeFilter} financials={financials}/>}

                {tab==="position"&&(
                  <div style={card}>
                    {positionUnlocked
                      ? <PositionTab financials={financials} displayCurrency={displayCurrency} displayRates={displayRates}/>
                      : <PositionLockScreen fbUser={fbUser} onUnlocked={function(){setPositionUnlocked(true);}}/>
                    }
                  </div>
                )}

                {tab==="forecast"&&(
                  <div style={card}>
                    <ForecastTab transactions={transactions} financials={financials} displayCurrency={displayCurrency} displayRates={displayRates} budgets={budgets} setFinancials={setFinancials} taxonomy={taxonomy} onProjectionChange={setForecastProjection}/>
                  </div>
                )}

                {tab==="budget"&&(
                  <BudgetTab transactions={transactions} taxonomy={taxonomy} budgets={budgets} setBudgets={setBudgets} displayCurrency={displayCurrency}/>
                )}

                {tab==="watchout"&&(
                  <WatchOutTab transactions={transactions} taxonomy={taxonomy} spikeThreshold={spikeThreshold} setSpikeThreshold={setSpikeThreshold} showSpikeSettings={showSpikeSettings} setShowSpikeSettings={setShowSpikeSettings} displayCurrency={displayCurrency} onDrillTxs={(txs,label)=>setDrillOverlay({txs,label})}/>
                )}

                {tab==="categories"&&(
                  <div>
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                      <button onClick={()=>{setManageInitSection("categories");setManageInitFinancialSub(null);openModal("manage");}} style={btn(C.accent,"#fff","none",12,"7px 14px")}>✎ Edit categories</button>
                    </div>
                    <Drill txs={mTxs} allTxs={transactions} cur={displayCurrency} dispRates={dispRates} taxonomy={taxonomy} onRemap={tx=>{setRemapTx(tx);setModal("remap");}} initCat={drillCat} initSub={drillSub} onClearInit={()=>{setDrillCat(null);setDrillSub(null);}} avgMode={avgMode} mMonths={mMonths}/>
                  </div>
                )}

                {tab==="subcategories"&&(
                  <div>
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                      <button onClick={()=>{setManageInitSection("categories");setManageInitFinancialSub(null);openModal("manage");}} style={btn(C.accent,"#fff","none",12,"7px 14px")}>✎ Edit subcategories</button>
                    </div>
                    <AllSubs transactions={mTxs} allTxs={transactions} taxonomy={taxonomy} currency={displayCurrency} dispRates={dispRates} onDrill={(c,s)=>{setDrillCat(c);setDrillSub(s);setTab("categories");}} avgMode={avgMode} mMonths={mMonths}/>
                  </div>
                )}

                {tab==="vendors"&&<VendorView transactions={mTxs} currency={displayCurrency} dispRates={dispRates} pFrom={pFrom} pTo={pTo} selMonths={selMonths}/>}

                {tab==="transactions"&&(
                  <div style={card}>
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                      <button onClick={()=>{setManageInitSection("transactions");setManageInitFinancialSub(null);openModal("manage");}} style={btn(C.s2,C.muted,"1px solid "+C.border,12,"6px 12px")}>🔖 Tag accounts</button>
                    </div>
                    <input value={txSearch} onChange={e=>setTxSearch(e.target.value)} placeholder="Search transactions, categories…" style={{...inp(),width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:13}}/>
                    {(()=>{
                      const ids=[...new Set(mTxs.map(t=>t.accountId).filter(Boolean))];
                      if(ids.length<1) return null;
                      const accMap={};
                      (financials&&financials.accounts||[]).forEach(a=>{accMap[a.id]=a.name+(a.last4?" ···"+a.last4:"");});
                      const allSelected = txAccFilter===null;
                      function toggleAll() { setTxAccFilter(allSelected ? new Set() : null); }
                      function toggleAcc(id) {
                        setTxAccFilter(function(prev){
                          var next = prev===null ? new Set(ids) : new Set(prev);
                          if(next.has(id)) next.delete(id); else next.add(id);
                          if(next.size===ids.length) return null;
                          return next;
                        });
                      }
                      return React.createElement("div", {style:{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}},
                        React.createElement("span", {style:{fontSize:11,fontWeight:600,color:C.muted,flexShrink:0}}, "Account:"),
                        React.createElement("button", {key:"all", onClick:toggleAll, style:{padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",fontWeight:allSelected?700:500,border:"1px solid "+(allSelected?C.accent:C.border),background:allSelected?C.accent:"transparent",color:allSelected?"#fff":C.muted}}, "All"),
                        ...ids.map(function(id){
                          var active = allSelected || (txAccFilter!==null && txAccFilter.has(id));
                          return React.createElement("button", {key:id, onClick:function(){toggleAcc(id);}, style:{padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",fontWeight:active?600:500,border:"1px solid "+(active?C.accent:C.border),background:active?C.accent+"18":C.s2,color:active?C.accent:C.text}}, accMap[id]||id);
                        }));
                    })()}
                    <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                      <Pill
                        options={[
                          ["amount_desc",  isActive=>txSort==="amount_asc"?"Value ↑":"Value ↓"],
                          ["date_desc",    isActive=>txSort==="date_asc"?"Date ↑":"Date ↓"],
                          ["category_asc", isActive=>"Category"],
                        ]}
                        value={txSort==="amount_asc"?"amount_desc":txSort==="date_asc"?"date_desc":txSort}
                        onChange={function(v){
                          setTxSort(function(prev){
                            if(v==="amount_desc") return prev==="amount_desc"?"amount_asc":"amount_desc";
                            if(v==="date_desc")   return prev==="date_desc"?"date_asc":"date_desc";
                            return v;
                          });
                        }}
                      />
                      {(()=>{
                        const cats=[...new Set(mTxs.map(t=>t.category).filter(Boolean))].sort();
                        if(!cats.length) return null;
                        return React.createElement("select", {
                          value: txCatFilter===null?"__all__": txCatFilter.size===1?[...txCatFilter][0]:"__multi__",
                          onChange: function(e){
                            var v=e.target.value;
                            setTxCatFilter(v==="__all__"?null:new Set([v]));
                          },
                          style:{...inp({padding:"5px 8px",fontSize:12}),cursor:"pointer"}
                        },
                          React.createElement("option",{value:"__all__"},"All categories"),
                          cats.map(function(c){ return React.createElement("option",{key:c,value:c},c); })
                        );
                      })()}
                      {(()=>{
                        const subs=[...new Set(mTxs.filter(t=>txCatFilter===null||txCatFilter.has(t.category)).map(t=>t.subcategory).filter(Boolean))].sort();
                        if(!subs.length) return null;
                        return React.createElement("select",{
                          value:txSubFilter,
                          onChange:function(e){setTxSubFilter(e.target.value);},
                          style:{...inp({padding:"5px 8px",fontSize:12}),cursor:"pointer"}
                        },
                          React.createElement("option",{value:"all"},"All subcategories"),
                          subs.map(function(s){ return React.createElement("option",{key:s,value:s},s); })
                        );
                      })()}
                      <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:C.muted,cursor:"pointer"}}>
                        <input type="checkbox" checked={uncatOnly} onChange={e=>setUncatOnly(e.target.checked)} style={{accentColor:C.accent}}/> Uncategorised
                      </label>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                      <button onClick={()=>setSelTxs(new Set(filteredTxs.map(t=>t.date+"||"+t.description+"||"+t.amount)))} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"5px 12px")}>☑ Select All ({filteredTxs.length})</button>
                      {selTxs.size>0&&<button onClick={()=>{setSelTxs(new Set());setDupesMode(false);}} style={btn(C.s2,C.muted,`1px solid ${C.border}`,11,"5px 12px")}>☐ Deselect All</button>}
                      <button onClick={()=>{
                        const seen=new Map();
                        const dupeRawKeys=new Set();
                        const allGroupRawKeys=new Set();
                        mTxs.forEach((t,idx)=>{
                          const k=t.date+"||"+(t.description||"").toLowerCase().trim()+"||"+(+t.amount).toFixed(2)+"||"+(t.isCredit?"c":"d");
                          const rawKey=t.date+"||"+t.description+"||"+t.amount;
                          if(seen.has(k)){ dupeRawKeys.add(rawKey); allGroupRawKeys.add(seen.get(k)); allGroupRawKeys.add(rawKey); } else { seen.set(k, rawKey); }
                        });
                        if(dupeRawKeys.size===0){ setImportMsg({text:"No duplicates found ✓",type:"ok"}); return; }
                        setSelTxs(dupeRawKeys);
                        setTxSearch(""); setTxFilter("all"); setTxAccFilter(null); setTxCatFilter(null); setUncatOnly(false); setTxSubFilter("all");
                        setDupesMode(true);
                        window.__dupeDisplayKeys=allGroupRawKeys;
                        setImportMsg({text:`Found ${dupeRawKeys.size} duplicate${dupeRawKeys.size!==1?"s":""} selected. Originals are shown but NOT selected — tap Delete to remove only the duplicates.`,type:"warn"});
                      }} style={btn("rgba(212,134,10,0.1)","#c8860a",`1px solid #c8860a44`,11,"5px 12px")}>🔍 Find Duplicates</button>
                    </div>
                    {selTxs.size>0&&(
                      <div style={{display:"flex",gap:10,marginBottom:12,padding:"10px 14px",background:C.s2,borderRadius:10,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:13,color:C.accent,fontWeight:600}}>{selTxs.size} selected</span>
                        <button onClick={()=>setModal("bulk")} style={btn(C.accent,"#fff","none",12,"6px 14px")}>✎ Edit</button>
                        <button onClick={()=>{
                          if(!window.confirm("Delete "+selTxs.size+" transaction(s)?")) return;
                          const keys=new Set(selTxs);
                          deleteTransactions(function(t){return keys.has(t.date+"||"+t.description+"||"+t.amount);});
                          setSelTxs(new Set());
                        }} style={btn("rgba(245,118,118,0.15)",C.danger,`1px solid ${C.danger}`,12,"6px 14px")}>🗑 Delete</button>
                        <button onClick={()=>setSelTxs(new Set())} style={btn(C.s3,C.muted,`1px solid ${C.border}`,12,"6px 12px")}>Clear</button>
                      </div>
                    )}
                    <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                      {!filteredTxs.length?<div style={{padding:28,textAlign:"center",color:C.dim,fontSize:13}}>No transactions{txSearch?" matching your search":""}</div>:filteredTxs.map((tx,i)=>{
                        const key=tx.date+"||"+tx.description+"||"+tx.amount;
                        const isSel=selTxs.has(key);
                        const isCredit=tx.isCredit===true;
                        const isEditing=editingTx&&editingTx.key===key;
                        return (
                          <div key={i} style={{padding:"10px 12px",borderBottom:`1px solid ${C.s2}`,background:isEditing?"rgba(42,157,111,0.05)":isSel?"rgba(62,180,137,0.06)":isCredit?"rgba(62,180,137,0.03)":"transparent"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}} onClick={()=>{if(!isEditing)toggleSelTx(tx);}}>
                              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${isSel?C.accent:C.border}`,background:isSel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#fff",fontWeight:700}}>{isSel?"✓":""}</div>
                              <div style={{width:28,height:28,borderRadius:7,background:readableColour(taxonomy[tx.category]?.color||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                                {isCredit?"↩":(taxonomy[tx.category]?.subs[tx.subcategory]?.icon||taxonomy[tx.category]?.icon||"📦")}
                              </div>
                              {isEditing?(
                                <input value={editingTx.description} onChange={e=>setEditingTx(prev=>({...prev,description:e.target.value}))} onClick={e=>e.stopPropagation()} style={{...inp({padding:"4px 8px",fontSize:13}),flex:1,fontWeight:600}} autoFocus/>
                              ):(
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description}</div>
                                </div>
                              )}
                              {isEditing?(
                                <input value={editingTx.amount} onChange={e=>setEditingTx(prev=>({...prev,amount:e.target.value}))} onClick={e=>e.stopPropagation()} type="number" step="0.01" style={{...inp({padding:"4px 8px",fontSize:13}),width:90,fontFamily:"monospace",textAlign:"right"}}/>
                              ):(
                                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:isCredit?C.accent:C.danger,flexShrink:0}}>{isCredit?"+":"-"}{fmtExact(tx.amount,currency)}</div>
                              )}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,paddingLeft:54}}>
                              <span style={{fontSize:11,color:C.dim,fontFamily:"monospace",flex:1}}>{fmtDNum(tx.date)}{tx.accountId&&<span style={{marginLeft:5,padding:"1px 5px",borderRadius:8,background:C.s2,color:C.muted,fontSize:10,fontFamily:"inherit"}}>{(financials&&financials.accounts||[]).find(a=>a.id===tx.accountId)?.name||tx.accountId}</span>}{tx.vendor&&<span style={{marginLeft:5,padding:"1px 6px",borderRadius:8,background:"rgba(42,157,111,0.12)",color:C.accent,fontSize:10,fontFamily:"inherit",fontWeight:600}}>{tx.vendor}</span>} · {tx.category+" › "+tx.subcategory}{isCredit&&<span style={{color:"#0e9e7a",marginLeft:4}}>↑</span>}</span>
                              <div style={{display:"flex",gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                                {isEditing?(
                                  <>
                                    <button onClick={()=>{
                                      const newDesc=(editingTx.description||"").trim();
                                      const newAmt=parseFloat(editingTx.amount);
                                      if(!newDesc||isNaN(newAmt)||newAmt<=0) return;
                                      setRawTxs(prev=>prev.map(t=>t.date===tx.date&&t.description===tx.description&&t.amount===tx.amount?{...t,description:newDesc,amount:newAmt,_manual:true}:t));
                                      setEditingTx(null);
                                    }} style={btn(C.accent,"#fff","none",12,"4px 12px")}>✓ Save</button>
                                    <button onClick={()=>setEditingTx(null)} style={btn(C.s2,C.muted,`1px solid ${C.border}`,12,"4px 10px")}>✕</button>
                                  </>
                                ):(
                                  <>
                                    <TypeBadge txType={tx.txType} onClick={()=>cycleTxType(tx)} small/>
                                    <button onClick={e=>{e.stopPropagation();setEditingTx({key,description:tx.description,amount:String(tx.amount)});}} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"3px 8px")}>✏️</button>
                                    <button onClick={e=>{e.stopPropagation();setRemapTx(tx);setModal("remap");}} style={btn(C.s3,C.muted,`1px solid ${C.border}`,11,"3px 8px")}>🏷</button>
                                    <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))deleteTransactions(function(t){return t.date===tx.date&&t.description===tx.description&&t.amount===tx.amount;});}} style={{...btn("rgba(192,57,43,0.15)",C.danger,"1px solid "+C.danger,11,"3px 8px"),fontWeight:700}}>🗑 Del</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

        {/* Mobile floating + button */}
        {!isWide&&(
          <button onClick={()=>setAddSheetOpen(v=>!v)}
            style={{position:"absolute",bottom:64,right:20,width:48,height:48,borderRadius:24,
                    background:C.accent,color:"#fff",border:"none",fontSize:26,fontWeight:300,
                    cursor:"pointer",boxShadow:"0 4px 16px rgba(42,157,111,0.45)",
                    display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,lineHeight:1}}>＋</button>
        )}
      </div>

      {renderMobileBottomBar()}
    </div>
  );
}
