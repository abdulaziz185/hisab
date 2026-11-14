'use strict';
const DAY=864e5,KEY='hisab_v2';
const key=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
const cap=s=>s.trim().replace(/\b\w/g,c=>c.toUpperCase());
const num=s=>{const m=String(s).trim().match(/^(?:rs\.?\s*)?(\d+(?:\.\d+)?)$/i);return m?parseFloat(m[1]):null};
const money=n=>'Rs '+Math.round(n*100)/100;
function emptyDB(){return{sales:[],pays:[],costs:{}}}
function knownProducts(db){const s=new Set(Object.keys(db.costs));db.sales.forEach(x=>x.items.forEach(i=>s.add(key(i.name))));return[...s].sort((a,b)=>b.length-a.length)}
function knownCustomers(db){const s=new Set();db.sales.forEach(x=>x.customer&&s.add(key(x.customer)));db.pays.forEach(x=>s.add(key(x.customer)));return s}

function lev(a,b){const m=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)m[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return m[a.length][b.length]}
function near(w,list,d){w=key(w);if(w.length<4)return null;let best=null,bd=d+1;for(const x of list){const k=lev(w,x);if(k<bd){bd=k;best=x}}return best}
function fixCust(c,db){const k=key(c),cs=knownCustomers(db);return cap(cs.has(k)?k:(near(k,[...cs],k.length>=6?2:1)||c))}
function answer(t,db){const b=balances(db),cs=Object.keys(b).concat([...knownCustomers(db)]),words=t.split(' ');
  const c=cs.find(x=>t.includes(key(x)))||words.map(w=>near(w,cs.map(key),1)).find(Boolean);
  if(c&&/kitna|balance|owe|baqaya|baaqi|pending|udhaar|udhar|\?/.test(t)){const n=Object.keys(b).find(x=>key(x)===key(c))||c;return cap(n)+' owes '+money(Math.max(b[n]||0,0))}
  if(/udhaar|udhar|pending|baqaya|baaqi/.test(t)){const L=Object.entries(b).filter(e=>e[1]>0).sort((x,y)=>y[1]-x[1]);return L.length?'Pending: '+money(L.reduce((a,e)=>a+e[1],0))+'\n'+L.slice(0,5).map(e=>e[0]+' '+money(e[1])).join('\n'):'No pending udhaar 🎉'}
  const d=new Date(),p=/month|mahina/.test(t)?['This month',+new Date(d.getFullYear(),d.getMonth(),1)]:/week|hafta/.test(t)?['Last 7 days',+new Date(new Date().setHours(0,0,0,0))-6*DAY]:/total|all/.test(t)?['All time',0]:['Today',+new Date(new Date().setHours(0,0,0,0))];
  const s=stats(db,p[1]);return p[0]+': '+money(s.sales)+' from '+s.n+' sale'+(s.n==1?'':'s')+'\nProfit: '+money(s.profit)+(s.unk?' ('+s.unk+' without cost)':'')}
function parse(text,db){
  let t=text.trim().replace(/\s+/g,' ');
  let m=t.match(/^(.+?)\s+(?:paid|gave|diye|diya|returned)\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)$/i);
  if(!m)m=t.match(/^(.+?)\s+ne\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rs|rupees?)?\s*(?:diye|diya|di|dey|de\s*diye|jama|paid)?$/i);
  if(m)return{type:'pay',customer:fixCust(m[1],db),amount:parseFloat(m[2])};
  const low=key(t);
  if(/^(undo|delete last|last delete|galat)$/.test(low))return{type:'undo'};
  if(/^(hi+|hello+|hey+|salam|salaam|assalam[ -]?o[ -]?alaikum|aoa|thanks?|thank you|shukriya)$/.test(low))return{type:'chat',reply:'Hi! Type what you sold, e.g. OG glass Shahgee'};
  if(!/\d/.test(low)&&/\?$|\b(kitna|kitne|balance|owes?|baqaya|baaqi|pending|today|aaj|hafta|week|month|mahina|total|profit|munafa|sales?|udhaar|udhar)\b/.test(low))return{type:'chat',reply:answer(low.replace(/\?/g,''),db)};
  if(!/\d/.test(low)&&/^(is|are|what|how|who|why|can|do|does|kya|kaise|kab|kon)\b/.test(low))return{type:'chat',reply:"I'm in offline mode, so I only understand sales and balances. Turn on AI in the Backup tab for general chat."};
  const paidExplicit=/\b(paid|cash|received|naqad)\b/i.test(t);
  t=t.replace(/\b(paid|cash|received|naqad)\b/ig,'').replace(/\s+/g,' ').trim();
  let price=null;m=t.match(/\b(?:for|rs\.?|rate|price)\s*(\d+(?:\.\d+)?)|@\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|mein|me)\b/i);
  if(m){price=parseFloat(m[1]||m[2]||m[3]);t=t.replace(m[0],' ').replace(/\s+/g,' ').trim()}
  let customer='';
  m=t.match(/\b(?:to|for)\s+([a-z][\w]*)\s*$/i);
  if(m){customer=cap(m[1]);t=t.slice(0,m.index).trim()}
  const segs=t.split(/\s*(?:,|\+|&|\band\b)\s*/i).filter(Boolean);
  if(!segs.length)return{type:'unknown'};
  const prods=knownProducts(db),custs=knownCustomers(db);
  if(!customer){
    const last=segs[segs.length-1],lk=key(last),w=last.split(' '),lw=key(w[w.length-1]);
    const hit=prods.find(p=>lk.startsWith(p+' ')&&!/^\d+$/.test(lk.slice(p.length+1)));
    if(hit&&!/^(x?\d+)$/.test(lk.slice(hit.length+1))){const rest=last.slice(hit.length+1),mm=rest.match(/^(x?\d+)\s+(.+)$/i);customer=cap(mm?mm[2]:rest);segs[segs.length-1]=last.slice(0,hit.length)+(mm?' '+mm[1]:'')}
    else if(w.length>=2&&custs.has(lw)&&!prods.includes(lk)){customer=cap(w[w.length-1]);segs[segs.length-1]=w.slice(0,-1).join(' ')}
    else if(w.length>=2&&!/\d$/.test(last)&&!prods.includes(lk)){customer=cap(w[w.length-1]);segs[segs.length-1]=w.slice(0,-1).join(' ')}
  }
  if(customer)customer=fixCust(customer,db);
  const items=segs.map(s=>{let q=1,n=s,x;
    if(x=s.match(/^(.*?)\s*(?:x|qty)?\s*(\d+)\s*(?:pcs?|pieces?)?$/i)){if(x[1]){n=x[1];q=+x[2]}}
    else if(x=s.match(/^(\d+)\s*(?:x|pcs?)?\s+(.+)$/i)){q=+x[1];n=x[2]}
    return{name:n.replace(/\bx$/i,'').trim(),qty:q}}).filter(i=>i.name);
  if(!items.length)return{type:'unknown'};
  items.forEach(i=>{const kn=key(i.name),k=prods.find(p=>p===kn)||near(kn,prods,kn.length>6?2:1);if(k){let o;db.sales.some(x=>x.items.some(y=>key(y.name)===k&&(o=y.name)));i.name=o||cap(k)}else i.name=i.name.length<=3?i.name.toUpperCase():i.name.charAt(0).toUpperCase()+i.name.slice(1)});
  return{type:'sale',items,customer,paid:customer?paidExplicit:true,price};
}
function costFor(db,items){let t=0;for(const i of items){const c=db.costs[key(i.name)];if(c==null)return null;t+=c*i.qty}return t}
function addSale(db,d,price,ts){const s={id:ts+'-'+Math.random().toString(36).slice(2,6),ts,items:d.items,customer:d.customer,paid:d.paid,price,cost:costFor(db,d.items)};db.sales.unshift(s);return s}
function balances(db){const b={};db.sales.forEach(s=>{if(s.customer&&!s.paid)b[s.customer]=(b[s.customer]||0)+s.price});db.pays.forEach(p=>b[p.customer]=(b[p.customer]||0)-p.amount);return b}
function stats(db,since){const r={sales:0,profit:0,n:0,unk:0};db.sales.forEach(s=>{if(s.ts>=since){r.sales+=s.price;r.n++;if(s.cost==null)r.unk++;else r.profit+=s.price-s.cost}});return r}
function csv(db){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['Date','Items','Customer','Status','Price','Cost','Profit']];
  db.sales.forEach(s=>rows.push([new Date(s.ts).toLocaleString(),itemsTxt(s.items),s.customer,s.paid?'Paid':'Pending',s.price,s.cost??'',s.cost==null?'':s.price-s.cost]));
  db.pays.forEach(p=>rows.push([new Date(p.ts).toLocaleString(),'Payment received',p.customer,'Payment',p.amount,'','']));
  return rows.map(r=>r.map(q).join(',')).join('\n')}
const itemsTxt=it=>it.map(i=>i.name+(i.qty>1?' ×'+i.qty:'')).join(', ');
if(typeof module!=='undefined')module.exports={parse,lev,near,addSale,balances,stats,csv,emptyDB,costFor,key};

if(typeof document!=='undefined'){
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let DB;try{DB=Object.assign(emptyDB(),JSON.parse(localStorage.getItem(KEY)))}catch(e){DB=emptyDB()}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){say('⚠️ Could not save! Storage full or blocked.')}};
let pending=null,filter='today';
const sod=()=>{const d=new Date();d.setHours(0,0,0,0);return+d};
const since={today:()=>sod(),week:()=>sod()-6*DAY,month:()=>{const d=new Date();return+new Date(d.getFullYear(),d.getMonth(),1)},all:()=>0};
function say(t,who='a',chips){const d=document.createElement('div');d.className='b '+who;d.textContent=t;
  (chips||[]).forEach(c=>{const b=document.createElement('span');b.className='chip';b.textContent=c[0];b.onclick=c[1];d.append(document.createElement('br'),b)});
  $('#msgs').append(d);const m=$('main');m.scrollTop=m.scrollHeight}

const AIC=()=>{try{return JSON.parse(localStorage.getItem('hisab_ai'))||{}}catch(e){return{}}};
function finishSale(d,n){const s=addSale(DB,d,n,Date.now());save();say('✅ Saved: '+saleLine(s)+'\n'+(s.cost==null?'Profit: unknown':'Profit: '+money(s.price-s.cost)),'a',s.cost==null?[['Add cost',()=>askCost(s)]]:null)}
async function callAI(c,p){
  const groq=/^gsk_/.test(c.key),models=[...new Set([c.model,...(groq?['llama-3.3-70b-versatile','llama-3.1-8b-instant']:['gemini-3.1-flash-lite','gemini-3.8-flash','gemini-4-hydrogen'])].filter(Boolean))];let r;
  for(const mo of models){
    r=groq?await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:JSON.stringify({model:mo,messages:[{role:'user',content:p}],response_format:{type:'json_object'},temperature:0})})
      :await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+mo+':generateContent?key='+encodeURIComponent(c.key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}],generationConfig:{responseMimeType:'application/json'}})});
    if(r.ok){if(mo!==c.model)localStorage.setItem('hisab_ai',JSON.stringify({key:c.key,model:mo}));const j=await r.json();return groq?j.choices[0].message.content:j.candidates[0].content.parts[0].text}
    if(r.status!==404&&r.status!==400)break}
  let m='';try{m=((await r.json()).error||{}).message||''}catch(e){}throw new Error(r.status+' '+(groq?'Groq':'Gemini')+' '+String(m).slice(0,110))}
async function smart(text){const c=AIC();if(!c.key)return parse(text,DB);
  const th=document.createElement('div');th.className='b a';th.textContent='…';$('#msgs').append(th);$('main').scrollTop=1e9;
  try{const data={products:knownProducts(DB).slice(0,50),customers:[...knownCustomers(DB)].slice(0,80),pendingBalances:balances(DB),today:stats(DB,sod()),week:stats(DB,since.week()),month:stats(DB,since.month()),allTime:stats(DB,0)};
    const p='You are the sales assistant of a small shop. The owner types in English, Urdu or Roman Urdu, with typos. Reply with ONLY one JSON object: {"type":"sale"|"pay"|"chat","items":[{"name":"","qty":1}],"customer":"","paid":true,"price":null,"amount":0,"reply":""}. Rules: "sale" = something sold. A customer name means paid=false (udhaar) unless text says paid/cash/received/naqad; no customer means paid=true. A bare number after a product is the QUANTITY. Set price only if explicitly stated as a selling price (Rs, rate, for, @); NEVER guess, otherwise null. "pay" = customer paid back money (customer, amount). "chat" = a question or anything else: answer briefly in "reply" using DATA only; if unclear ask ONE short question. Reuse exact spelling of known products/customers when they match despite typos.\nDATA: '+JSON.stringify(data)+'\nOWNER SAID: '+text;
    const j=JSON.parse(((await callAI(c,p)).match(/\{[\s\S]*\}/)||[''])[0]);th.remove();
    if(j.type==='pay'&&j.customer&&+j.amount>0)return{type:'pay',customer:fixCust(String(j.customer),DB),amount:+j.amount};
    if(j.type==='sale'&&Array.isArray(j.items)){const items=j.items.filter(i=>i&&i.name).map(i=>({name:String(i.name).trim(),qty:Math.max(1,+i.qty||1)}));
      if(items.length){const cu=j.customer?fixCust(String(j.customer),DB):'';return{type:'sale',items,customer:cu,paid:cu?j.paid===true:true,price:+j.price>0?+j.price:null}}}
    return{type:'chat',reply:j.reply||'Sorry, say that again?'}
  }catch(e){th.remove();say('AI unavailable ('+(e.message||e)+'), using smart offline mode.');return parse(text,DB)}}
function saleLine(s){return itemsTxt(s.items)+' · '+money(s.price)+(s.customer?' · '+s.customer:'')+' · '+(s.paid?'Paid':'Pending')}
async function submit(text){
  text=text.trim();if(!text)return;say(text,'u');
  if(pending){const n=num(text);
    if(pending.kind==='price'&&n!=null){const d=pending.d;pending=null;finishSale(d,n);return}
    if(pending.kind==='cost'&&n!=null){const s=DB.sales.find(x=>x.id===pending.id),it=s.items.find(i=>DB.costs[key(i.name)]==null);
      DB.costs[key(it.name)]=n;DB.sales.forEach(x=>{if(x.cost==null){const c=costFor(DB,x.items);if(c!=null)x.cost=c}});pending=null;save();
      const p=s.price-s.cost;say('Saved cost '+money(n)+' per '+it.name+'. Profit on that sale: '+(s.cost==null?'unknown':money(p)));return}
    if(/^(skip|no|cancel)$/i.test(text)){pending=null;say('OK, skipped.');return}
    pending=null}
  const r=await smart(text);
  if(r.type==='pay'){DB.pays.push({id:Date.now()+'',ts:Date.now(),customer:r.customer,amount:r.amount});save();
    const b=balances(DB)[r.customer]||0;say('✅ '+r.customer+' paid '+money(r.amount)+'. Pending balance: '+money(b));return}
  if(r.type==='chat'){say(r.reply||'OK');return}
  if(r.type==='undo'){const u=DB.sales.shift();save();say(u?'↩️ Removed: '+saleLine(u):'Nothing to undo');return}
  if(r.type==='sale'){if(r.price!=null){finishSale(r,r.price);return}pending={kind:'price',d:r};
    const q=r.items.length>1||r.items[0].qty>1?'What was the total selling price?':'How much did you sell it for?';
    say((r.customer&&!r.paid?'📒 Udhaar for '+r.customer:'💵 Paid')+' · '+itemsTxt(r.items)+'\n'+q);return}
  say("Sorry, I didn't get that. Try: OG glass Shahgee");
}
function askCost(s){const it=s.items.find(i=>DB.costs[key(i.name)]==null);pending={kind:'cost',id:s.id};say('What is the cost of one '+it.name+'? (or type skip)')}
$('#f').onsubmit=e=>{e.preventDefault();const i=$('#in');const v=i.value;i.value='';submit(v);i.focus()};

function show(v){document.querySelectorAll('.v').forEach(x=>x.classList.toggle('on',x.id===v));document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));$('.row').style.display=v==='chat'?'flex':'none';
  ({home:renderHome,sales:renderSales,cust:renderCust,data:renderData}[v]||(()=>{}))()}
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>show(a.dataset.v));

function card(l,p){const s=stats(DB,since[p]());return`<div class="c"><div class="k">${l}</div><div class="n">${money(s.sales)}</div><div class="sub ok">Profit ${money(s.profit)}${s.unk?' <span class="sub">('+s.unk+' unknown cost)</span>':''}</div></div>`}
function renderHome(){const t=stats(DB,sod()),pend=Object.values(balances(DB)).reduce((a,b)=>a+Math.max(b,0),0);
  $('#home').innerHTML=`<div class="c big"><div class="k">Today's sales</div><div class="n" style="font-size:32px">${money(t.sales)}</div><div class="sub">Profit ${money(t.profit)} · ${t.n} sale${t.n==1?'':'s'}</div></div>
  <div class="grid"><div class="c"><div class="k">Pending udhaar</div><div class="n pend">${money(pend)}</div></div><div class="c"><div class="k">Sales today</div><div class="n">${t.n}</div></div></div>
  ${card('Last 7 days','week')}${card('This month','month')}${card('All time','all')}`}
function renderSales(){const ft=[['today','Today'],['week','7 days'],['month','Month'],['all','All']];
  $('#ft').innerHTML=ft.map(f=>`<button class="${filter===f[0]?'on':''}" data-f="${f[0]}">${f[1]}</button>`).join('');
  $('#ft').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;renderSales()});
  const q=key($('#q').value),min=since[filter]();
  const L=DB.sales.filter(s=>s.ts>=min&&(!q||key(itemsTxt(s.items)+' '+s.customer).includes(q)));
  $('#sl').innerHTML=L.length?L.map(s=>`<div class="li" data-id="${s.id}"><div><div>${esc(itemsTxt(s.items))}</div><div class="sub">${esc(s.customer||'Walk-in')} · ${new Date(s.ts).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</div></div><div style="text-align:right"><div>${money(s.price)}</div><div class="sub ${s.paid?'ok':'pend'}">${s.paid?'Paid':'Pending'}</div></div></div>`).join(''):'<p class="sub" style="padding:20px">No sales here yet.</p>';
  $('#sl').querySelectorAll('.li').forEach(e=>e.onclick=()=>detail(e.dataset.id))}
$('#q').oninput=renderSales;
function renderCust(){const b=balances(DB),L=Object.entries(b).filter(e=>Math.abs(e[1])>0.001).sort((x,y)=>y[1]-x[1]);
  $('#cust').innerHTML='<div class="c"><div class="k">Customer balances</div></div>'+(L.length?L.map(e=>`<div class="li"><div>${esc(e[0])}</div><div class="${e[1]>0?'pend':'ok'}">${e[1]>0?money(e[1]):'Advance '+money(-e[1])}</div></div>`).join(''):'<p class="sub" style="padding:20px">No pending udhaar 🎉</p>')+'<p class="sub" style="padding:12px">To clear: type “Shahgee paid 150”.</p>'}
function modal(h){const m=$('#modal');m.innerHTML='<div>'+h+'</div>';m.classList.add('on');m.onclick=e=>{if(e.target===m)m.classList.remove('on')};return m}
function detail(id){const s=DB.sales.find(x=>x.id===id);if(!s)return;
  const m=modal(`<b>${esc(itemsTxt(s.items))}</b><div class="sub">${new Date(s.ts).toLocaleString()}</div>
  <label>Customer (blank = walk-in)</label><input id="ec" value="${esc(s.customer)}">
  <label>Selling price (total)</label><input id="ep" type="number" inputmode="decimal" value="${s.price}">
  <label>Total cost (blank = unknown)</label><input id="ek" type="number" inputmode="decimal" value="${s.cost??''}">
  <label>Payment</label><select id="es"><option value="1" ${s.paid?'selected':''}>Paid</option><option value="0" ${s.paid?'':'selected'}>Pending (udhaar)</option></select>
  <div class="sub">Profit: ${s.cost==null?'unknown':money(s.price-s.cost)}</div>
  <div class="grid"><button id="sv">Save</button><button id="dl" class="d">Delete</button></div>`);
  $('#sv').onclick=()=>{const p=parseFloat($('#ep').value);if(isNaN(p))return;s.price=p;s.customer=cap($('#ec').value);const k=$('#ek').value;s.cost=k===''?null:parseFloat(k);s.paid=s.customer?$('#es').value==='1':true;save();m.classList.remove('on');renderSales()};
  $('#dl').onclick=()=>{if(confirm('Delete this sale?')){DB.sales=DB.sales.filter(x=>x.id!==id);save();m.classList.remove('on');renderSales()}}}
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove()}
function renderData(){$('#data').innerHTML=`<div class="c"><b>Your data lives on this phone</b><p class="sub" style="margin-top:6px">Saved automatically after every sale. Refreshing Chrome never erases it. But <b>clearing Chrome's site data/cache or uninstalling can</b>. Back up often.</p></div>
  <div class="c grid"><button id="bj">⬇ Backup (JSON)</button><button id="bc" class="s">⬇ Export CSV</button></div>
  <div class="c"><label>Restore from a JSON backup (replaces current data)</label><input id="rf" type="file" accept=".json,application/json" style="margin-top:8px"></div>
  <div class="c"><b>How to back up</b><p class="sub" style="margin-top:6px">1. Tap “Backup (JSON)” at the end of each day.<br>2. File saves to Downloads. Send it to yourself on WhatsApp/Google Drive.<br>3. To restore on a new phone: open the app, Backup tab, choose the file.</p></div>
  <div class="c"><b>✨ Optional: real AI (free) · v3</b><p class="sub" style="margin:6px 0">For ChatGPT-style AI, paste a free key: Groq (console.groq.com/keys, recommended, fast) or Gemini (aistudio.google.com/apikey). Stored only on this phone.</p><input id="ak" type="password" placeholder="API key (Groq gsk_… or Gemini AIza…)"><input id="am" placeholder="Model (leave empty)" style="margin-top:8px"><button id="as" style="margin-top:8px">Save AI settings</button></div>`;
  {const c=AIC();$('#ak').value=c.key||'';$('#am').value=c.model||'';$('#as').onclick=()=>{localStorage.setItem('hisab_ai',JSON.stringify({key:$('#ak').value.trim(),model:$('#ak').value.trim()===c.key?$('#am').value.trim():''}));say($('#ak').value.trim()?'✨ AI mode on.':'AI off. Using smart offline mode.')}}
  const d=new Date().toISOString().slice(0,10);
  $('#bj').onclick=()=>dl('hisab-backup-'+d+'.json',JSON.stringify(DB),'application/json');
  $('#bc').onclick=()=>dl('hisab-sales-'+d+'.csv',csv(DB),'text/csv');
  $('#rf').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.sales))throw 0;if(confirm('Replace current data with this backup?')){DB=Object.assign(emptyDB(),x);save();say('✅ Backup restored: '+DB.sales.length+' sales.');show('chat')}}catch(_){alert('Not a valid Hisab backup file.')}};r.readAsText(f)}}
say('Hi! Type what you sold, e.g.\n• OG glass Shahgee\n• OG glass 2 cash\n• Shahgee ne 150 diye\n• Shahgee kitna?  •  aaj ki sale  •  undo');
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
