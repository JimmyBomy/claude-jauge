import type { Lang } from './i18n.js';

const strings = {
  fr: {
    title: 'claude-jauge',
    subtitle: 'Tes limites Claude, en local',
    five: 'Fenêtre 5 h',
    week: 'Semaine',
    left: 'restant',
    used: 'utilisé',
    noData: "Pas encore de données. Installe la statusLine (npx claude-jauge install) puis utilise Claude Code.",
    usageChart: 'Utilisation des limites',
    tokensChart: 'Jetons par jour',
    byModel: 'Jetons par modèle',
    model: 'Modèle',
    tokens: 'Jetons',
    share: 'Part',
    updated: 'Mise à jour',
    theme: 'Clair / sombre',
    privacy: "Tout est lu sur ta machine (historique claude-jauge et fichiers de session Claude Code, en lecture seule). Rien n'est envoyé sur Internet.",
    empty: 'Aucune session sur la période.',
    other: 'autres',
  },
  en: {
    title: 'claude-jauge',
    subtitle: 'Your Claude limits, locally',
    five: '5-hour window',
    week: 'Week',
    left: 'left',
    used: 'used',
    noData: 'No data yet. Install the status line (npx claude-jauge install), then use Claude Code.',
    usageChart: 'Limit usage',
    tokensChart: 'Tokens per day',
    byModel: 'Tokens by model',
    model: 'Model',
    tokens: 'Tokens',
    share: 'Share',
    updated: 'Updated',
    theme: 'Light / dark',
    privacy: 'Everything is read on your machine (claude-jauge history and Claude Code session files, read only). Nothing is sent over the Internet.',
    empty: 'No session in this period.',
    other: 'other',
  },
};

/** A single self-contained HTML page: inline CSS and JS, hand-made SVG charts, no external request. */
export function renderPage(lang: Lang): string {
  const s = strings[lang];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>claude-jauge</title>
<style>
:root{--bg:#f7f6f3;--card:#ffffff;--fg:#1d1c1a;--muted:#6b6862;--line:#e4e1da;--track:#ecebe6;
--ok:#2f8f5b;--warn:#c98a12;--bad:#c4402f;--s1:#3e6ae1;--s2:#d9772b;--s3:#8a5cd1;--s4:#2a9d8f;--s5:#9a9890;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#151514;--card:#1f1f1d;--fg:#ecebe6;--muted:#a19e96;--line:#33322f;--track:#2b2a28;
--ok:#4fbf82;--warn:#e0a83a;--bad:#e86a58;--s1:#7b9cf0;--s2:#f0995a;--s3:#b08ae6;--s4:#4cc2b3;--s5:#77756f;color-scheme:dark}}
:root[data-theme=dark]{--bg:#151514;--card:#1f1f1d;--fg:#ecebe6;--muted:#a19e96;--line:#33322f;--track:#2b2a28;
--ok:#4fbf82;--warn:#e0a83a;--bad:#e86a58;--s1:#7b9cf0;--s2:#f0995a;--s3:#b08ae6;--s4:#4cc2b3;--s5:#77756f;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 48px}
header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}
h1{font-size:22px;margin:0;letter-spacing:-.01em}
h1 small{font-weight:400;color:var(--muted);font-size:15px;margin-left:8px}
h2{font-size:15px;margin:0 0 12px;font-weight:600}
button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:4px 10px;cursor:pointer}
.muted{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.big{font-size:40px;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}
.big span{font-size:15px;font-weight:400;color:var(--muted);margin-left:6px}
.track{height:10px;border-radius:5px;background:var(--track);overflow:hidden;margin:12px 0 10px}
.fill{height:100%;border-radius:5px}
.fc{margin-top:4px}
.fc.hit{color:var(--bad);font-weight:600}
svg{display:block;width:100%;height:auto}
svg text{fill:var(--muted);font-size:11px}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-top:8px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:6px 4px;border-bottom:1px solid var(--line);text-align:right}
th:first-child,td:first-child{text-align:left;font-variant-numeric:normal}
th{font-weight:600;color:var(--muted);font-size:13px}
footer{margin-top:20px;font-size:13px}
.tip{position:fixed;pointer-events:none;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-size:12px;display:none}
</style>
</head>
<body>
<main>
<header>
  <h1>${s.title}<small>${s.subtitle}</small></h1>
  <div><span class="muted" id="upd"></span> <button id="theme" type="button">${s.theme}</button></div>
</header>
<section class="grid" id="gauges"></section>
<section class="card" style="margin-bottom:16px"><h2>${s.usageChart}</h2><div id="usage"></div></section>
<section class="card" style="margin-bottom:16px"><h2>${s.tokensChart}</h2><div id="tokens"></div></section>
<section class="card"><h2>${s.byModel}</h2><div id="models"></div></section>
<footer class="muted">${s.privacy}</footer>
</main>
<div class="tip" id="tip"></div>
<script>
const S=${JSON.stringify(s)};
const LOCALE=${JSON.stringify(lang === 'fr' ? 'fr-FR' : 'en-US')};
const root=document.documentElement;
try{const th=localStorage.getItem('claude-jauge-theme');if(th)root.dataset.theme=th;}catch(e){}
document.getElementById('theme').onclick=()=>{
  const dark=root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme=dark?'light':'dark';
  try{localStorage.setItem('claude-jauge-theme',root.dataset.theme);}catch(e){}
};
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function esc(x){return String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const nf=new Intl.NumberFormat(LOCALE);
const cf=new Intl.NumberFormat(LOCALE,{notation:'compact',maximumFractionDigits:1});
const pctTxt=v=>LOCALE==='fr-FR'?Math.round(v)+'\\u00a0%':Math.round(v)+'%';
const level=v=>v>=80?'var(--bad)':v>=50?'var(--warn)':'var(--ok)';
const tip=document.getElementById('tip');
function showTip(ev,html){tip.innerHTML=html;tip.style.display='block';tip.style.left=(ev.clientX+12)+'px';tip.style.top=(ev.clientY+12)+'px';}
function hideTip(){tip.style.display='none';}

function gauges(d){
  const box=document.getElementById('gauges');box.innerHTML='';
  if(!d.gauges.length){box.innerHTML='<div class="card">'+esc(S.noData)+'</div>';return;}
  for(const g of d.gauges){
    const used=g.used,left=100-used;
    box.insertAdjacentHTML('beforeend','<div class="card"><h2>'+esc(g.key==='five'?S.five:S.week)+'</h2>'+
      '<div class="big">'+pctTxt(left)+'<span>'+esc(S.left)+' · '+pctTxt(used)+' '+esc(S.used)+'</span></div>'+
      '<div class="track"><div class="fill" style="width:'+Math.min(100,used)+'%;background:'+level(used)+'"></div></div>'+
      '<div class="muted">'+esc(g.resetText)+'</div><div class="fc '+(g.forecastKind==='hit'||g.forecastKind==='reached'?'hit':'muted')+'">'+esc(g.forecastText)+'</div></div>');
  }
}

function usageChart(d){
  const box=document.getElementById('usage');box.innerHTML='';
  const pts=d.history;
  if(pts.length<2){box.innerHTML='<p class="muted">'+esc(S.noData)+'</p>';return;}
  const W=900,H=260,L=40,R=12,T=12,B=28;
  const svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':S.usageChart},box);
  const t0=pts[0].t,t1=Math.max(pts[pts.length-1].t,t0+1);
  const x=t=>L+(t-t0)/(t1-t0)*(W-L-R), y=v=>T+(1-v/100)*(H-T-B);
  for(const v of [0,25,50,75,100]){
    el('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),stroke:'var(--line)','stroke-width':1},svg);
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
    if(dPath)el('path',{d:dPath,fill:'none',stroke:color,'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'},svg);
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
  if(!rows.length){box.innerHTML='<p class="muted">'+esc(S.empty)+'</p>';return;}
  const top=d.models.slice(0,4).map(m=>m.key);
  const colors=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];
  const hasOther=d.models.length>top.length;
  const keys=hasOther?[...top,S.other]:top;
  const W=900,H=240,L=48,R=8,T=10,B=28;
  const svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':S.tokensChart},box);
  const max=Math.max(...rows.map(r=>r.total),1);
  const y=v=>T+(1-v/max)*(H-T-B);
  for(const f of [0,.5,1]){el('line',{x1:L,x2:W-R,y1:y(max*f),y2:y(max*f),stroke:'var(--line)'},svg);const tx=el('text',{x:L-6,y:y(max*f)+4,'text-anchor':'end'},svg);tx.textContent=cf.format(max*f);}
  const bw=(W-L-R)/rows.length, gap=Math.min(6,bw*.2);
  const dfmt=new Intl.DateTimeFormat(LOCALE,{day:'numeric',month:'short',timeZone:'UTC'});
  rows.forEach((r,i)=>{
    let acc=0;const x0=L+i*bw+gap/2;
    const parts=keys.map((k,j)=>{const v=j<top.length?(r.models[k]||0):Object.entries(r.models).filter(([m])=>!top.includes(m)).reduce((a,[,v])=>a+v,0);return [k,v,colors[j]];});
    for(const [,v,c] of parts){if(!v)continue;const h=(H-T-B)*v/max;el('rect',{x:x0,y:y(acc)-h,width:Math.max(1,bw-gap),height:h,fill:c},svg);acc+=v;}
    const hit=el('rect',{x:L+i*bw,y:T,width:bw,height:H-T-B,fill:'transparent'},svg);
    const [yy,mm,dd]=r.key.split('-').map(Number);const label=dfmt.format(new Date(Date.UTC(yy,mm-1,dd)));
    hit.addEventListener('mousemove',ev=>showTip(ev,'<b>'+esc(label)+'</b> · '+nf.format(r.total)+'<br>'+parts.filter(p=>p[1]).map(p=>esc(p[0])+' : '+cf.format(p[1])).join('<br>')));
    hit.addEventListener('mouseleave',hideTip);
    if(rows.length<=16||i%Math.ceil(rows.length/12)===0){const tx=el('text',{x:L+i*bw+bw/2,y:H-8,'text-anchor':'middle'},svg);tx.textContent=label;}
  });
  box.insertAdjacentHTML('beforeend','<div class="legend">'+keys.map((k,j)=>'<span><i style="background:'+colors[j]+'"></i>'+esc(k)+'</span>').join('')+'</div>');
}

function modelTable(d){
  const box=document.getElementById('models');
  if(!d.models.length){box.innerHTML='<p class="muted">'+esc(S.empty)+'</p>';return;}
  const total=d.models.reduce((a,m)=>a+m.total,0)||1;
  box.innerHTML='<table><thead><tr><th>'+esc(S.model)+'</th><th>'+esc(S.tokens)+'</th><th>'+esc(S.share)+'</th></tr></thead><tbody>'+
    d.models.map(m=>'<tr><td>'+esc(m.key)+'</td><td>'+nf.format(m.total)+'</td><td>'+pctTxt(m.total/total*100)+'</td></tr>').join('')+'</tbody></table>';
}

async function load(){
  try{
    const r=await fetch('/api/data',{cache:'no-store'});const d=await r.json();
    gauges(d);usageChart(d);tokenChart(d);modelTable(d);
    document.getElementById('upd').textContent=d.updatedText||'';
  }catch(e){document.getElementById('upd').textContent='…';}
}
load();setInterval(load,60000);
</script>
</body>
</html>`;
}
