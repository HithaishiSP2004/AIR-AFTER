import { createAtmosphere } from './atmosphere.js';
/* AIR / AFTER — interaction layer. No framework runtime, no fabricated metrics. */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const PRESETS = [
  { name:'New Delhi', region:'Delhi', latitude:28.6139, longitude:77.2090 },
  { name:'Bengaluru', region:'Karnataka', latitude:12.9716, longitude:77.5946 },
  { name:'Mumbai', region:'Maharashtra', latitude:19.0760, longitude:72.8777 },
  { name:'Kolkata', region:'West Bengal', latitude:22.5726, longitude:88.3639 },
  { name:'Hyderabad', region:'Telangana', latitude:17.3850, longitude:78.4867 },
  { name:'Chennai', region:'Tamil Nadu', latitude:13.0827, longitude:80.2707 },
];
const DEFAULT_PROFILE = {audience:'family', children:true, older_adults:false, sensitive:false, commuting:'mixed', purifier:false};
function readLocal(key, fallback) {try {const v=localStorage.getItem(key);return v? JSON.parse(v):fallback;}catch{return fallback;}}
function saveLocal(key, value) {try {localStorage.setItem(key, JSON.stringify(value));}catch { /* local storage may be blocked */ }}
function validLocation(value) {
  return value && typeof value.name === 'string' && value.name.length>1 && typeof value.region==='string'
    && Number.isFinite(value.latitude) && value.latitude>=6 && value.latitude<=38
    && Number.isFinite(value.longitude) && value.longitude>=67 && value.longitude<=98;
}
function validProfile(value){return value && ['family','individual','community'].includes(value.audience)
  && ['car','carpool','transit','walk','cycle','mixed'].includes(value.commuting)
  && ['children','older_adults','sensitive','purifier'].every(k=>typeof value[k]==='boolean');}
const storedLoc = readLocal('air-after:location', PRESETS[0]);
const storedProfile = readLocal('air-after:household', DEFAULT_PROFILE);
const state = { location:validLocation(storedLoc)?storedLoc:PRESETS[0],
  household:validProfile(storedProfile)?storedProfile:{...DEFAULT_PROFILE},
  air:null, loading:false, view:'intelligence', scenario:'commute' };
function setText(id, text){const e=document.getElementById(id);if(e)e.textContent=String(text);}
function create(tag, cls='', text=''){const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;}
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true;},4000);}
function dateText(date, options){return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',...options}).format(new Date(date));}
async function jsonRequest(url, options = {}) {
  const { timeoutMs = 20000, ...fetchOptions } = options;
  const controller = new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {const response=await fetch(url,{...fetchOptions,signal:controller.signal,headers:{'Accept':'application/json',...(fetchOptions.body?{'Content-Type':'application/json'}:{}),...fetchOptions.headers}});
    if(!response.ok)throw new Error(response.status===429?'Too many requests. Please try again in a minute.':`Service unavailable (${response.status})`);
    return await response.json();
  }finally{clearTimeout(timer);}
}
function post(url, body, timeoutMs = 20000){return jsonRequest(url,{method:'POST',body:JSON.stringify(body),timeoutMs});}
function updateDate(){setText('today-label',dateText(new Date(),{weekday:'long',month:'short',day:'numeric',year:'numeric'}).toUpperCase());}
function openView(name){
  if(!['intelligence','decisions','home','assistant'].includes(name))return;
  state.view=name;$$('.view').forEach(v=>{const selected=v.id===`view-${name}`;v.hidden=!selected;v.classList.toggle('is-visible',selected);});
  $$('.nav-link,.mobile-nav button').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  const titles={intelligence:'Air Intelligence',decisions:'Decision Studio',home:'Home Air Lab',assistant:'Ask AIR'};
  document.title=`${titles[name]} — AIR / AFTER`;
  if(location.hash!==`#${name}`) history.replaceState(null,'',`#${name}`);
  window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  atmosphere.drawOnce();
}
function initNavigation(){
  $$('[data-view],[data-open-view]').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view||b.dataset.openView)));
  addEventListener('hashchange',()=>openView(location.hash.slice(1)||'intelligence'));
  openView(location.hash.slice(1)||'intelligence');
}
function renderActions(actions){const root=$('#daily-actions');root.replaceChildren();
  (actions||[]).forEach((text,index)=>{const item=create('div','action-item');item.append(create('span','',String(index+1).padStart(2,'0')),create('p','',text));root.append(item);});
}
function displayEvidence(snapshot){
  const e=snapshot.primary;const primaryType=e?.kind==='observation'?'STATION OBSERVATION':'MODEL ESTIMATE';
  setText('hero-status',e?'ENVIRONMENTAL CONTEXT AVAILABLE':'LOCAL DATA CURRENTLY UNAVAILABLE');
  setText('measurement-kind',e?primaryType:'NO CURRENT VALUE');
  setText('pm-value',e?Number(e.value).toFixed(e.value<10?1:0):'—');
  setText('measure-caption',e?`${dateText(e.measured_at,{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})} IST · ${e.kind==='model'?'not a station reading':'nearby monitoring station'}`:'This display never invents readings');
  const evidence=$('#evidence-summary');
  evidence.textContent=e?(e.kind==='observation'
    ?`Nearby monitoring station “${e.station||'unnamed'}” reported PM2.5 of ${e.value} µg/m³. This is an observed value, not an official Indian AQI.`
    :`The atmospheric model estimates PM2.5 at ${e.value} µg/m³ around ${snapshot.location.name}. This is not a live sensor reading or a CPCB India AQI.`)
    :'We could not retrieve a sufficiently recent PM2.5 observation or model estimate. We will not display a fabricated number.';
  const metadata=$('#source-details');metadata.replaceChildren();
  if(e){const stamp=create('span','',`AS OF ${dateText(e.measured_at,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} IST`);
    const type=create('span','',e.kind==='model'?'ATMOSPHERIC MODEL':'SENSOR OBSERVATION');
    metadata.append(stamp,type);
    if(e.distance_km!==null && e.distance_km!==undefined)metadata.append(create('span','',`${e.distance_km} KM FROM SELECTED POINT`));
    try{const u=new URL(e.source_url);if(u.protocol==='https:'){
      const link=create('a','',`VIEW SOURCE ↗`);link.href=u.href;link.rel='noopener noreferrer';link.target='_blank';metadata.append(link);
    }}catch{/* ignore invalid source */}
  }
  setText('evidence-warnings',snapshot.warnings?.join(' · ')||'Data availability changes. Check timestamps before making a decision.');
  setText('play-guidance',e?`The ${e.kind==='model'?'model estimate':'station reading'} currently shows PM₂.₅ of ${e.value} µg/m³ around ${snapshot.location.name}. It does not measure your child's individual dose. Consider intensity, duration, local advice, and alternatives; never treat a single value as a safety guarantee.`:'Local PM₂.₅ evidence is unavailable. Choose a flexible activity plan and review official local advice before strenuous outdoor play.');
  atmosphere.setDensity(e?e.value:undefined);
}
async function refreshAir(){
  state.loading=true;state.air=null;setText('hero-status','CHECKING THE ATMOSPHERE');setText('pm-value','—');setText('measure-caption','Retrieving source information…');
  setText('city-label',state.location.name);setText('evidence-summary','Requesting current source information…');
  const requestId=JSON.stringify(state.location);const params=new URLSearchParams(state.location);
  try{const air=await jsonRequest(`/api/air?${params}`);if(requestId!==JSON.stringify(state.location))return;
    state.air=air;displayEvidence(air);renderForecast(air.forecast||[]);await refreshGuidance();
  }catch(error){if(requestId!==JSON.stringify(state.location))return;
    displayEvidence({primary:null,location:state.location,warnings:[`Provider request could not be completed: ${error.message}`]});
    renderForecast([]);setText('daily-note-title','We cannot confirm conditions right now.');
    setText('daily-note-summary','The environmental service did not respond. This app never substitutes example numbers for current air-quality readings. Try refreshing or choose another location.');
    renderActions(['Check an official local advisory','Retry once connectivity returns','Choose a flexible indoor option']);toast('Environmental data unavailable; no simulated readings shown.');
  }finally{state.loading=false;}
}
async function refreshGuidance(){if(!state.air)return;
  try{const data=await post('/api/guidance',{location:state.location,household:state.household});
    setText('decision-label',data.eyebrow);setText('daily-note-title',data.title);setText('daily-note-summary',data.summary);renderActions(data.actions);
  }catch{setText('daily-note-title','Consider the evidence, then the person.');
    setText('daily-note-summary','Personalized guidance is temporarily unavailable. The environmental data and source information remain visible.');renderActions(['Check the source timestamp','Adapt activity to household needs']);}
}
function renderForecast(forecast){const plot=$('#forecast-plot');plot.replaceChildren();
  const now=Date.now();const entries=forecast.filter(p=>p.pm2_5!==null&&new Date(p.time).getTime()>=now-60*60*1000).slice(0,24);
  if(!entries.length){plot.append(create('p','plot-loading','Forecast not available — no example values shown.'));setText('forecast-detail','We cannot confirm hourly modeled concentrations.');return;}
  const values=entries.map(p=>Number(p.pm2_5));const max=Math.max(15,...values);const min=Math.min(...values);
  entries.forEach((p,i)=>{const button=create('button');button.type='button';
    button.setAttribute('aria-label',`${dateText(p.time,{weekday:'short',hour:'numeric',hour12:true})}: modeled PM2.5 ${p.pm2_5} micrograms per cubic metre`);
    button.title=`${p.pm2_5} µg/m³`;
    const bar=create('span');bar.style.height=`${Math.max(5,(Number(p.pm2_5)/max)*100)}%`;
    const label=create('small','',i%4===0?dateText(p.time,{hour:'numeric',hour12:true}).replace(' ',''): '');
    button.append(bar,label);button.addEventListener('click',()=>{
      $$('.forecast-plot button').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});
      button.classList.add('selected');button.setAttribute('aria-pressed','true');
      setText('forecast-detail',`${dateText(p.time,{weekday:'short',hour:'numeric',hour12:true})} IST · Modelled PM₂.₅ ${p.pm2_5} µg/m³ · not a station observation`);
    });plot.append(button);
    if(i===0)queueMicrotask(()=>button.click());
  });
}
function initCityDialog(){const dialog=$('#city-dialog');$('#location-trigger').addEventListener('click',()=>{dialog.showModal();$('#city-search').value='';renderCities(PRESETS);setText('city-search-status','Quick selections · or search across India');$('#city-search').focus();});
  let pending=null;const input=$('#city-search');input.addEventListener('input',()=>{
    clearTimeout(pending);const query=input.value.trim();if(query.length<2){renderCities(PRESETS);setText('city-search-status','Quick selections');return;}
    setText('city-search-status','Searching locations in India…');pending=setTimeout(async()=>{
      try{const data=await jsonRequest(`/api/cities?q=${encodeURIComponent(query)}`);
        if(input.value.trim()!==query)return;renderCities(data.results||[]);
        setText('city-search-status',data.results?.length?`${data.results.length} matching locations`:'No matching Indian locations found');
      }catch{if(input.value.trim()===query){renderCities([]);setText('city-search-status','Location search temporarily unavailable. Try a quick city selection.');}}
    },320);
  });
  function renderCities(cities){const root=$('#city-results');root.replaceChildren();
    cities.forEach(city=>{if(!validLocation(city))return;const b=create('button');b.type='button';
      const label=create('span');label.append(create('strong','',city.name),create('small','',city.region||'India'));b.append(label,create('i','','↗'));
      b.addEventListener('click',()=>{state.location=city;saveLocal('air-after:location',city);dialog.close();refreshAir();toast(`Location set to ${city.name}`);});root.append(b);
    });
  }
}
function initProfile(){const dialog=$('#profile-dialog');function fill(){
  $('#audience').value=state.household.audience;$('#has-children').checked=state.household.children;
  $('#has-older').checked=state.household.older_adults;$('#is-sensitive').checked=state.household.sensitive;
  $('#has-purifier').checked=state.household.purifier;$('#commuting').value=state.household.commuting;
}
  $('#profile-trigger').addEventListener('click',()=>{fill();dialog.showModal();});
  $('#profile-form').addEventListener('submit',event=>{event.preventDefault();state.household={audience:$('#audience').value,
    children:$('#has-children').checked,older_adults:$('#has-older').checked,sensitive:$('#is-sensitive').checked,
    purifier:$('#has-purifier').checked,commuting:$('#commuting').value};saveLocal('air-after:household',state.household);
    dialog.close();refreshGuidance();toast('Household preferences saved in this browser.');});
  $('#clear-profile').addEventListener('click',()=>{state.household={...DEFAULT_PROFILE};try{localStorage.removeItem('air-after:household');}catch{}fill();dialog.close();refreshGuidance();toast('Local household preferences cleared.');});
}
function initScenarios(){function show(name){state.scenario=name;$$('.scenario-tab').forEach(button=>{const yes=button.dataset.scenario===name;button.classList.toggle('active',yes);button.setAttribute('aria-selected',String(yes));});
    $$('[id^="scenario-"]').forEach(panel=>{panel.hidden=panel.id!==`scenario-${name}`;});}
  $$('.scenario-tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.scenario)));
  for(const id of ['trip-distance','trip-frequency','occupancy'])$(`#${id}`).addEventListener('input',updateCommute);
  for(const id of ['errand-distance','errand-combined'])$(`#${id}`).addEventListener('input',updateErrands);
  updateCommute();updateErrands();show('commute');
}
let impactSeq=0;
async function updateCommute(){const dist=Number($('#trip-distance').value),trips=Number($('#trip-frequency').value),occupants=Number($('#occupancy').value);
  setText('distance-output',`${dist} km`);setText('frequency-output',trips);setText('occupancy-output',occupants);
  const seq=++impactSeq;
  try{const result=await post('/api/impact',{distance_km:dist,trips_per_week:trips,occupants});if(seq!==impactSeq)return;
    setText('solo-value',result.solo_kg_co2_week.toFixed(1));setText('shared-value',result.shared_kg_co2_person_week.toFixed(1));
    $('#solo-bar').style.width='100%';$('#shared-bar').style.width=`${100/occupants}%`;
    setText('commute-impact',occupants===1? 'With one occupant the full vehicle-emissions allocation remains with you.':
      `Illustrative share difference: ${result.saved_kg_co2_person_week.toFixed(1)} kg CO₂ per person each week. Total vehicle emissions are unchanged for this same trip.`);
  }catch{setText('solo-value','—');setText('shared-value','—');setText('commute-impact','Calculation unavailable. Please try again.');}
}
function updateErrands(){const dist=Number($('#errand-distance').value),combined=Number($('#errand-combined').value),before=3*dist,delta=before-combined;
  setText('errand-distance-output',`${dist} km`);setText('errand-combined-output',`${combined} km`);
  setText('errand-before',before);setText('errand-after',combined);
  setText('errand-impact',delta>=0?`${delta} km less distance if your combined route replaces three separate trips.`:
    `The combined route is ${-delta} km longer in your scenario. Combining trips does not automatically reduce distance.`);
}
let roomSeq=0;
async function updateRoom(){const area=Number($('#room-area').value),ceiling=Number($('#room-height').value),ach=Number($('#room-ach').value);
  setText('room-area-output',`${area} m²`);setText('room-height-output',`${ceiling.toFixed(1)} m`);setText('room-ach-output',ach);
  const seq=++roomSeq;
  try{const result=await post('/api/room',{area_m2:area,ceiling_m:ceiling,clean_air_changes_hour:ach});
    if(seq!==roomSeq)return;setText('room-cadr',Math.round(result.target_cadr_m3h));setText('room-note',result.note);
  }catch{setText('room-cadr','—');setText('room-note','Sizing service unavailable.');}
}
function initRoom(){for(const id of ['room-area','room-height','room-ach'])$(`#${id}`).addEventListener('input',updateRoom);updateRoom();}
function addResponse(text, type){const root=$('#conversation-stream');if($('.welcome-response',root))$('.welcome-response',root).remove();
  const div=create('div',type==='user'?'chat-question':'chat-response');div.append(create('p','',text));root.append(div);root.scrollTop=root.scrollHeight;return div;}
function formatReply(data){const root=$('#conversation-stream');const article=create('div','chat-response');article.append(create('span','response-label',data.mode==='gemini'?'AI EXPLANATION':'RULE-BASED GUIDANCE'),create('h3','',data.title),create('p','',data.answer));
  const list=create('ul');(data.actions||[]).forEach(action=>{const li=create('li','',action);list.append(li);});article.append(list);
  article.append(create('p','meta',`EVIDENCE / ${data.evidence}`),create('p','caveat',`${data.caveat} · ${data.source}`));root.append(article);root.scrollTop=root.scrollHeight;
  setText('assistant-mode',data.mode==='gemini'?'GEMINI / VERIFIED INPUT':'TRANSPARENT RULES FALLBACK');
}
function initAssistant(){const input=$('#question-input'),send=$('#send-button');
  $$('#view-assistant [data-question]').forEach(b=>b.addEventListener('click',()=>{openView('assistant');input.value=b.dataset.question;input.focus();}));
  $('#ask-form').addEventListener('submit',async event=>{event.preventDefault();const question=input.value.trim();if(question.length<3)return;
    addResponse(question,'user');input.value='';input.disabled=true;send.disabled=true;setText('assistant-mode','THINKING WITH EVIDENCE…');
    try{const result=await post('/api/ask',{question,location:state.location,household:state.household},30000);formatReply(result);}
    catch(error){const row=addResponse(`I couldn't retrieve a response (${error.message}). Please retry; I won't pretend I checked live data.`,'assistant');row.classList.add('caveat');setText('assistant-mode','TEMPORARILY UNAVAILABLE');}
    finally{input.disabled=false;send.disabled=false;input.focus();}
  });
}
const atmosphere = createAtmosphere($('#air-canvas'), () => state.view === 'intelligence');
function boot(){initNavigation();initCityDialog();initProfile();initScenarios();initRoom();initAssistant();updateDate();refreshAir();}
boot();
