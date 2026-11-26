import type { Lang } from './i18n.js';
import { cssVars, palettes, THRESHOLDS } from './theme.js';

const strings = {
  fr: {
    subtitle: 'Tes limites Claude, en local',
    five: 'Fenêtre 5 h',
    week: 'Semaine',
    left: 'restant',
    used: 'utilisé',
    levels: { normal: 'Normal', warning: 'Attention', critical: 'Limite proche' },
    noData: 'Pas encore de données. Installe la statusLine (npx claude-jauge install) puis utilise Claude Code.',
    usageChart: 'Utilisation des limites',
    tokensChart: 'Jetons par jour',
    byModel: 'Jetons par modèle',
    model: 'Modèle',
    tokens: 'Jetons',
    share: 'Part',
    theme: 'Changer de thème',
    privacy: "Tout est lu sur ta machine (historique claude-jauge et fichiers de session Claude Code, en lecture seule). Rien n'est envoyé sur Internet.",
    empty: 'Aucune session sur la période.',
    other: 'autres',
    loading: 'chargement',
  },
  en: {
    subtitle: 'Your Claude limits, locally',
    five: '5-hour window',
    week: 'Week',
    left: 'left',
    used: 'used',
    levels: { normal: 'Normal', warning: 'Watch out', critical: 'Near limit' },
    noData: 'No data yet. Install the status line (npx claude-jauge install), then use Claude Code.',
    usageChart: 'Limit usage',
    tokensChart: 'Tokens per day',
    byModel: 'Tokens by model',
    model: 'Model',
    tokens: 'Tokens',
    share: 'Share',
    theme: 'Switch theme',
    privacy: 'Everything is read on your machine (claude-jauge history and Claude Code session files, read only). Nothing is sent over the Internet.',
    empty: 'No session in this period.',
    other: 'other',
    loading: 'loading',
  },
};

const DARK = cssVars(palettes.dark);
const LIGHT = cssVars(palettes.light);

/** One self-contained HTML page: inline CSS and JS, hand-made SVG charts, no external request. */
export function renderPage(lang: Lang): string {
  const s = strings[lang];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>claude-jauge</title>
<style>
:root{${DARK};--edge:rgba(255,255,255,.10);--grid:rgba(255,255,255,.08);--hi:rgba(255,255,255,.09);
--rim:linear-gradient(150deg,rgba(255,255,255,.55),rgba(255,255,255,.12) 22%,rgba(255,255,255,0) 48%,rgba(255,255,255,.05) 72%,rgba(255,255,255,.30));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.22),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.20),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.14),transparent 60%),linear-gradient(160deg,#0b0d16,#07080e 70%);
color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){${LIGHT};--edge:rgba(0,0,0,.08);--grid:rgba(0,0,0,.08);--hi:rgba(255,255,255,.6);
--rim:linear-gradient(150deg,rgba(255,255,255,.95),rgba(255,255,255,.5) 30%,rgba(255,255,255,.1) 60%,rgba(255,255,255,.7));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.35),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.22),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.20),transparent 60%),linear-gradient(160deg,#eef1f8,#e6e8f0 70%);
color-scheme:light}}
:root[data-theme=light]{${LIGHT};--edge:rgba(0,0,0,.08);--grid:rgba(0,0,0,.08);--hi:rgba(255,255,255,.6);
--rim:linear-gradient(150deg,rgba(255,255,255,.95),rgba(255,255,255,.5) 30%,rgba(255,255,255,.1) 60%,rgba(255,255,255,.7));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.35),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.22),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.20),transparent 60%),linear-gradient(160deg,#eef1f8,#e6e8f0 70%);
color-scheme:light}
*{box-sizing:border-box}
html{min-height:100%;background:var(--wall)}
body{margin:0;min-height:100vh;color:var(--ink);
font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI","Inter",system-ui,sans-serif;
letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
main{max-width:1000px;margin:0 auto;padding:28px 16px 56px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#c6ff4e,#7cc4ff);display:grid;place-items:center;box-shadow:0 6px 18px -6px rgba(124,196,255,.6)}
.mark span{width:18px;height:6px;border-radius:3px;background:#0d0f14;position:relative;overflow:hidden}
.mark span::after{content:"";position:absolute;inset:0 40% 0 0;background:#30d158}
h1{font:650 21px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display","Segoe UI","Inter",system-ui,sans-serif;margin:0;letter-spacing:-.02em}
h1 small{display:block;font-size:13px;font-weight:450;color:var(--muted);letter-spacing:0;margin-top:2px}
h2{font-size:14px;margin:0 0 14px;font-weight:600;color:var(--muted);letter-spacing:.01em}
.tools{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.glass{position:relative;background:linear-gradient(180deg,var(--hi),transparent 45%),var(--card);
-webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);
border:1px solid var(--edge);border-radius:24px;
box-shadow:0 1px 1px rgba(0,0,0,.10),0 12px 28px -12px rgba(0,0,0,.35),0 40px 80px -36px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.16)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:var(--rim);
-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
@media (prefers-reduced-transparency:reduce){.glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--card)}}
button.icon{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--edge);border-radius:12px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer}
button.icon:focus-visible{outline:2px solid #7cc4ff;outline-offset:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin-bottom:16px}
.card{padding:20px 22px}
.gauge-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.gauge-top h2{margin:0}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:650;padding:3px 10px 3px 8px;border-radius:999px;color:var(--lv);background:color-mix(in srgb,var(--lv) 14%,transparent);border:1px solid color-mix(in srgb,var(--lv) 35%,transparent)}
.badge svg{width:14px;height:14px}
.big{display:flex;align-items:baseline;gap:8px;font:700 52px/1.05 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display","Segoe UI","Inter",system-ui,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.big span{font-size:16px;font-weight:500;letter-spacing:0;color:var(--muted)}
.track{height:14px;border-radius:7px;background:var(--track);overflow:hidden;margin:14px 0 12px;box-shadow:inset 0 1px 2px rgba(0,0,0,.18)}
.fill{height:100%;border-radius:7px;background:var(--lv);box-shadow:0 0 14px color-mix(in srgb,var(--lv) 55%,transparent);transition:width .6s cubic-bezier(.2,.9,.3,1)}
@media (prefers-reduced-motion:reduce){.fill{transition:none}}
.meta{color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums}
.meta b{color:var(--ink);font-weight:600}
.fc{margin-top:6px;font-size:14px;color:var(--muted)}
.fc.alert{color:var(--critical);font-weight:600}
section.card{margin-bottom:16px}
svg.chart{display:block;width:100%;height:auto}
svg.chart text{fill:var(--muted);font-size:11px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-top:10px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:8px 4px;border-bottom:1px solid var(--grid);text-align:right}
th:first-child,td:first-child{text-align:left;font-variant-numeric:normal}
tr:last-child td{border-bottom:0}
th{font-weight:600;color:var(--muted);font-size:13px}
footer{margin-top:22px;font-size:13px;color:var(--muted);text-align:center}
.tip{position:fixed;pointer-events:none;padding:6px 10px;font-size:12px;display:none;border-radius:12px;z-index:10}
</style>
</head>
<body>
<main>
<header>
  <div class="brand"><div class="mark" aria-hidden="true"><span></span></div><h1>claude-jauge<small>${s.subtitle}</small></h1></div>
  <div class="tools"><span id="upd">${s.loading}</span>
    <button class="icon glass" id="theme" type="button" aria-label="${s.theme}" title="${s.theme}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>
    </button></div>
</header>
<section class="grid" id="gauges" aria-live="polite"></section>
<section class="card glass"><h2>${s.usageChart}</h2><div id="usage"></div></section>
<section class="card glass"><h2>${s.tokensChart}</h2><div id="tokens"></div></section>
<section class="card glass"><h2>${s.byModel}</h2><div id="models"></div></section>
<footer>${s.privacy}</footer>
</main>
<div class="tip glass" id="tip"></div>
<script>
const S=${JSON.stringify(s)};
const LOCALE=${JSON.stringify(lang === 'fr' ? 'fr-FR' : 'en-US')};
const TH=${JSON.stringify(THRESHOLDS)};
const ICONS={
  normal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/></svg>',
  warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/></svg>',
  critical:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16.5h.01"/></svg>'};
const root=document.documentElement;
try{const th=localStorage.getItem('claude-jauge-theme');if(th)root.dataset.theme=th;}catch(e){}
document.getElementById('theme').onclick=()=>{
  const dark=root.dataset.theme?root.dataset.theme==='dark':!matchMedia('(prefers-color-scheme: light)').matches;
  root.dataset.theme=dark?'light':'dark';
  try{localStorage.setItem('claude-jauge-theme',root.dataset.theme);}catch(e){}
};
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function esc(x){return String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const nf=new Intl.NumberFormat(LOCALE);
const cf=new Intl.NumberFormat(LOCALE,{notation:'compact',maximumFractionDigits:1});
const pctTxt=v=>LOCALE==='fr-FR'?Math.round(v)+'\\u00a0%':Math.round(v)+'%';
const tip=document.getElementById('tip');
function showTip(ev,html){tip.innerHTML=html;tip.style.display='block';tip.style.left=(ev.clientX+14)+'px';tip.style.top=(ev.clientY+14)+'px';}
function hideTip(){tip.style.display='none';}

function gauges(d){
  const box=document.getElementById('gauges');box.innerHTML='';
  if(!d.gauges.length){box.innerHTML='<div class="card glass">'+esc(S.noData)+'</div>';return;}
  for(const g of d.gauges){
    const used=g.used,left=100-used,lv=g.level;
    box.insertAdjacentHTML('beforeend','<article class="card glass" style="--lv:var(--'+lv+')">'+
      '<div class="gauge-top"><h2>'+esc(g.key==='five'?S.five:S.week)+'</h2><span class="badge">'+ICONS[lv]+esc(S.levels[lv])+'</span></div>'+
      '<div class="big">'+pctTxt(left)+'<span>'+esc(S.left)+'</span></div>'+
      '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(used)+'"><div class="fill" style="width:'+Math.min(100,used)+'%"></div></div>'+
      '<div class="meta"><b>'+pctTxt(used)+'</b> '+esc(S.used)+' · '+esc(g.resetText)+'</div>'+
      (g.forecastText?'<div class="fc'+(g.forecastKind==='hit'||g.forecastKind==='reached'?' alert':'')+'">'+esc(g.forecastText)+'</div>':'')+'</article>');
  }
}

function usageChart(d){
  const box=document.getElementById('usage');box.innerHTML='';
  const pts=d.history;
  if(pts.length<2){box.innerHTML='<p class="meta">'+esc(S.noData)+'</p>';return;}
  const W=900,H=260,L=40,R=12,T=12,B=28;
  const svg=el('svg',{class:'chart',viewBox:'0 0 '+W+' '+H,role:'img','aria-label':S.usageChart},box);
  const t0=pts[0].t,t1=Math.max(pts[pts.length-1].t,t0+1);
  const x=t=>L+(t-t0)/(t1-t0)*(W-L-R), y=v=>T+(1-v/100)*(H-T-B);
  el('rect',{x:L,y:y(100),width:W-L-R,height:y(TH.critical)-y(100),fill:'var(--critical)',opacity:.07},svg);
  el('rect',{x:L,y:y(TH.critical),width:W-L-R,height:y(TH.warning)-y(TH.critical),fill:'var(--warning)',opacity:.06},svg);
  for(const v of [0,25,50,75,100]){
    el('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),stroke:'var(--grid)','stroke-width':1},svg);
    const tx=el('text',{x:L-6,y:y(v)+4,'text-anchor':'end'},svg);tx.textContent=v+'%';
  }
  const span=t1-t0, fmt=new Intl.DateTimeFormat(LOCALE,span>2*86400?{weekday:'short',day:'numeric'}:{hour:'2-digit',minute:'2-digit'});
  for(let i=0;i<=5;i++){const t=t0+span*i/5;const tx=el('text',{x:x(t),y:H-8,'text-anchor':i===0?'start':i===5?'end':'middle'},svg);tx.textContent=fmt.format(new Date(t*1000));}
  const series=[['five','var(--s1)',S.five],['week','var(--s2)',S.week]];
  for(const [k,color] of series){
    let dPath='',prevReset=null;
    for(const p of pts){const s=p[k];if(!s){prevReset=null;continue;}
      const cmd=(prevReset===null||Math.abs(s.reset-prevReset)>120)?'M':'L';
      dPath+=cmd+x(p.t).toFixed(1)+' '+y(s.pct).toFixed(1)+' ';prevReset=s.reset;}
    if(dPath)el('path',{d:dPath,fill:'none',stroke:color,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round'},svg);
  }
  const hover=el('rect',{x:L,y:T,width:W-L-R,height:H-T-B,fill:'transparent'},svg);
  const guide=el('line',{y1:T,y2:H-B,stroke:'var(--muted)','stroke-dasharray':'3 3',visibility:'hidden'},svg);
  const df=new Intl.DateTimeFormat(LOCALE,{weekday:'short',hour:'2-digit',minute:'2-digit'});
  hover.addEventListener('mousemove',ev=>{
    const r=svg.getBoundingClientRect();const tx=t0+((ev.clientX-r.left)/r.width*W-L)/(W-L-R)*(t1-t0);
    let best=pts[0];for(const p of pts)if(Math.abs(p.t-tx)<Math.abs(best.t-tx))best=p;
    guide.setAttribute('x1',x(best.t));guide.setAttribute('x2',x(best.t));guide.setAttribute('visibility','visible');
    showTip(ev,esc(df.format(new Date(best.t*1000)))+'<br>'+(best.five?esc(S.five)+' : '+pctTxt(best.five.pct)+'<br>':'')+(best.week?esc(S.week)+' : '+pctTxt(best.week.pct):''));
  });
  hover.addEventListener('mouseleave',()=>{guide.setAttribute('visibility','hidden');hideTip();});
  box.insertAdjacentHTML('beforeend','<div class="legend">'+series.map(s=>'<span><i style="background:'+s[1]+'"></i>'+esc(s[2])+'</span>').join('')+'</div>');
}

function tokenChart(d){
  const box=document.getElementById('tokens');box.innerHTML='';
  const rows=d.daily;
  if(!rows.length){box.innerHTML='<p class="meta">'+esc(S.empty)+'</p>';return;}
  const top=d.models.slice(0,4).map(m=>m.key);
  const colors=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];
  const hasOther=d.models.length>top.length;
  const keys=hasOther?[...top,S.other]:top;
  const W=900,H=240,L=48,R=8,T=10,B=28;
  const svg=el('svg',{class:'chart',viewBox:'0 0 '+W+' '+H,role:'img','aria-label':S.tokensChart},box);
  const max=Math.max(...rows.map(r=>r.total),1);
  const y=v=>T+(1-v/max)*(H-T-B);
  for(const f of [0,.5,1]){el('line',{x1:L,x2:W-R,y1:y(max*f),y2:y(max*f),stroke:'var(--grid)'},svg);const tx=el('text',{x:L-6,y:y(max*f)+4,'text-anchor':'end'},svg);tx.textContent=cf.format(max*f);}
  const bw=(W-L-R)/rows.length, gap=Math.min(8,bw*.25);
  const dfmt=new Intl.DateTimeFormat(LOCALE,{day:'numeric',month:'short',timeZone:'UTC'});
  rows.forEach((r,i)=>{
    let acc=0;const x0=L+i*bw+gap/2;
    const parts=keys.map((k,j)=>{const v=j<top.length?(r.models[k]||0):Object.entries(r.models).filter(([m])=>!top.includes(m)).reduce((a,[,v])=>a+v,0);return [k,v,colors[j]];});
    const visible=parts.filter(p=>p[1]);
    visible.forEach(([,v,c],j)=>{const h=(H-T-B)*v/max;const isTop=j===visible.length-1;
      el('rect',{x:x0,y:y(acc)-h,width:Math.max(1,bw-gap),height:h,fill:c,rx:isTop?4:0},svg);acc+=v;});
    const hit=el('rect',{x:L+i*bw,y:T,width:bw,height:H-T-B,fill:'transparent'},svg);
    const [yy,mm,dd]=r.key.split('-').map(Number);const label=dfmt.format(new Date(Date.UTC(yy,mm-1,dd)));
    hit.addEventListener('mousemove',ev=>showTip(ev,'<b>'+esc(label)+'</b> · '+nf.format(r.total)+'<br>'+visible.map(p=>esc(p[0])+' : '+cf.format(p[1])).join('<br>')));
    hit.addEventListener('mouseleave',hideTip);
    if(rows.length<=16||i%Math.ceil(rows.length/12)===0){const tx=el('text',{x:L+i*bw+bw/2,y:H-8,'text-anchor':'middle'},svg);tx.textContent=label;}
  });
  box.insertAdjacentHTML('beforeend','<div class="legend">'+keys.map((k,j)=>'<span><i style="background:'+colors[j]+'"></i>'+esc(k)+'</span>').join('')+'</div>');
}

function modelTable(d){
  const box=document.getElementById('models');
  if(!d.models.length){box.innerHTML='<p class="meta">'+esc(S.empty)+'</p>';return;}
  const total=d.models.reduce((a,m)=>a+m.total,0)||1;
  box.innerHTML='<table><thead><tr><th>'+esc(S.model)+'</th><th>'+esc(S.tokens)+'</th><th>'+esc(S.share)+'</th></tr></thead><tbody>'+
    d.models.map(m=>'<tr><td>'+esc(m.key)+'</td><td>'+nf.format(m.total)+'</td><td>'+pctTxt(m.total/total*100)+'</td></tr>').join('')+'</tbody></table>';
}

async function load(){
  try{
    const r=await fetch('/api/data',{cache:'no-store'});const d=await r.json();
    gauges(d);usageChart(d);tokenChart(d);modelTable(d);
    document.getElementById('upd').textContent=d.updatedText||'';
  }catch(e){document.getElementById('upd').textContent='';}
}
load();setInterval(load,60000);
</script>
</body>
</html>`;
}
