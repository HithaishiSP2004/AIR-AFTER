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
  return value && typeof value.name === 'string' && value.name.trim().length>1 && value.name.length<=90
    && typeof value.region==='string' && value.region.length<=90
    && Object.keys(value).every(k => ['name','region','latitude','longitude'].includes(k))
    && Number.isFinite(value.latitude) && value.latitude>=6 && value.latitude<=38
    && Number.isFinite(value.longitude) && value.longitude>=67 && value.longitude<=98;
}
function validProfile(value){return value && ['family','individual','community'].includes(value.audience)
  && Object.keys(value).every(k => Object.hasOwn(DEFAULT_PROFILE, k))
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
function updateDate(){setText('today-label',dateText(new Date(),{weekday:'long',month:'short',day:'numeric',year:'numeric'}));}
const viewTitles = {
  intelligence: 'Air Intelligence',
  decisions: 'Decision Studio',
  home: 'Home Air Lab',
  assistant: 'Ask AIR',
};

function openView(name, { record = true, focus = true } = {}) {
  if (!Object.hasOwn(viewTitles, name)) name = 'intelligence';
  if (name === 'assistant' && state.view !== 'assistant') {
    state.askScenario = state.view === 'home' ? 'home' : state.view === 'decisions' ? state.scenario : null;
  }
  state.view = name;
  for (const view of $$('.view')) {
    const selected = view.id === `view-${name}`;
    view.hidden = !selected;
    view.classList.toggle('is-visible', selected);
  }
  for (const link of $$('[data-view]')) {
    const active = link.dataset.view === name;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${viewTitles[name]} — AIR / AFTER`;
  if (location.hash !== `#${name}`) {
    history[record ? 'pushState' : 'replaceState'](null, '', `#${name}`);
  }
  if (focus) {
    $('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  if (name === 'assistant') refreshAssistantContext();
  atmosphere.drawOnce();
}

function initNavigation() {
  for (const link of $$('[data-view], [data-open-view]')) {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openView(link.dataset.view || link.dataset.openView);
    });
  }
  $('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('#main').focus();
  });
  addEventListener('hashchange', () => openView(location.hash.slice(1), { record: false }));
  openView(location.hash.slice(1), { record: false, focus: false });
}
function renderActions(actions) {
  $('#daily-actions').replaceChildren(...actions.map(action => create('li', '', action)));
}

function localStamp(time) {
  return dateText(time, {day:'numeric', month:'short', hour:'numeric', minute:'2-digit'}) + ' IST';
}

function showCurrentReading(e) {
  setText('measurement-kind', !e ? 'Current PM₂.₅ unavailable' :
    e.kind === 'observation' ? 'Station observation' : 'Atmospheric model estimate');
  setText('pm-value', e ? String(e.value) : '—');
  setText('measure-caption', e ? localStamp(e.measured_at) + ' · ' + e.provider :
    'No recent station or model value for this location.');
  atmosphere.setDensity(e?.value);
}

function displayEvidence(snapshot) {
  const e = snapshot.primary;
  showCurrentReading(e);
  const source = e?.kind === 'observation' ? (e.station || 'Nearby monitoring station') : 'Regional atmospheric model';
  setText('evidence-summary', e ?
    source + ' · ' + e.provider + ' · ' + e.value + ' µg/m³ PM₂.₅. The concentration describes outdoor air around ' + state.location.name + '.' :
    'A recent outdoor PM₂.₅ concentration could not be confirmed for ' + state.location.name + '.');
  const meta = $('#source-details');
  meta.replaceChildren();
  if (e) {
    meta.append(create('span', '', 'Valid ' + localStamp(e.measured_at)));
    if (Number.isFinite(e.distance_km)) meta.append(create('span', '', e.distance_km + ' km from selected point'));
    const url = new URL(e.source_url);
    if (url.protocol === 'https:') {
      const link = create('a', '', 'Provider source ↗');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      meta.append(link);
    }
  }
  if (snapshot.fetched_at) meta.append(create('span', '', 'Checked ' + localStamp(snapshot.fetched_at)));
  setText('evidence-warnings', (snapshot.warnings || []).join(' '));
}

let airGeneration = 0;
let guidanceGeneration = 0;
let evidenceTimer;
function refreshExpiredEvidence() {
  const primary = state.air?.primary;
  if (!document.hidden && primary && Date.now() >= Date.parse(primary.measured_at) + 6 * 3600000) refreshAir();
}
document.addEventListener('visibilitychange', refreshExpiredEvidence);
async function refreshAir() {
  clearTimeout(evidenceTimer);
  const version = ++airGeneration;
  ++guidanceGeneration;
  state.air = null;
  state.loading = true;
  refreshStudioContext();
  refreshAssistantContext();
  setText('city-label', state.location.name);
  setText('atlas-city', state.location.name);
  showCurrentReading(null);
  setText('measurement-kind', 'Checking local sources');
  setText('measure-caption', 'Retrieving the latest available evidence.');
  setText('evidence-summary', 'Contacting environmental providers.');
  setText('source-details', '');
  setText('evidence-warnings', '');
  setText('daily-note-title', 'Checking your local context');
  setText('daily-note-summary', 'Retrieving guidance for ' + state.location.name + '.');
  setText('decision-label', 'For your household');
  renderActions([]);
  $('#forecast-controls').hidden = true;
  $('#forecast-plot').replaceChildren();
  setText('forecast-detail', 'Looking for hourly estimates.');
  try {
    const params = new URLSearchParams(state.location);
    const air = await jsonRequest('/api/air?' + params);
    if (version !== airGeneration) return;
    state.air = air;
    state.loading = false;
    displayEvidence(air);
    if (air.primary) {
      const expires = Date.parse(air.primary.measured_at) + 6 * 3600000;
      evidenceTimer = setTimeout(refreshExpiredEvidence, Math.max(1000, expires - Date.now() + 100));
    }
    renderForecast(air.forecast);
    refreshStudioContext();
    refreshAssistantContext();
    await refreshGuidance();
  } catch {
    if (version !== airGeneration) return;
    state.loading = false;
    displayEvidence({primary:null, warnings:['The environmental service could not be reached. Use Refresh local evidence to try again.']});
    renderForecast([]);
    refreshStudioContext();
    refreshAssistantContext();
    setText('daily-note-title', 'Keep an indoor option available');
    setText('daily-note-summary', 'Check the latest official local advisory before planning prolonged outdoor activity.');
    renderActions(['Review local advice before strenuous outdoor plans.', 'Check back for a current concentration.']);
  }
}

async function refreshGuidance() {
  const version = ++guidanceGeneration;
  refreshStudioContext();
  refreshAssistantContext();
  if (!state.air) return;
  setText('daily-note-title', 'Preparing household guidance');
  setText('daily-note-summary', '');
  renderActions([]);
  try {
    const data = await post('/api/guidance', {location:state.location, household:state.household});
    if (version !== guidanceGeneration) return;
    setText('decision-label', data.eyebrow);
    setText('daily-note-title', data.title);
    setText('daily-note-summary', data.summary);
    renderActions(data.actions);
  } catch {
    if (version !== guidanceGeneration) return;
    setText('decision-label', 'For your household');
    setText('daily-note-title', 'Household guidance unavailable');
    setText('daily-note-summary', 'Review the local evidence and check official advice before making outdoor plans.');
    renderActions(['Check the source timestamp.', 'Adapt activity to household needs.']);
  }
}

function chartElement(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function renderForecast(points) {
  const plot = $('#forecast-plot');
  const slider = $('#forecast-hour');
  const reset = $('#forecast-reset');
  const hour = 3600000;
  const first = Math.ceil(Date.now() / hour) * hour;
  const byTime = new Map(points.map(p => [Date.parse(p.time), p.pm2_5]));
  const entries = Array.from({length:24}, (_, i) => {
    const time = first + i * hour;
    return {time, value:byTime.get(time)};
  });
  plot.replaceChildren();
  reset.hidden = true;
  const values = entries.map(p => p.value).filter(Number.isFinite);
  $('#forecast-controls').hidden = !values.length;
  if (!values.length) {
    setText('forecast-detail', 'No hourly PM₂.₅ estimates are available for the next 24 hours.');
    return;
  }
  const max = Math.max(1, ...values);
  const x = i => 5 + i * 350 / 23;
  const y = v => 68 - v / max * 60;
  const graphic = chartElement('svg', {viewBox:'0 0 360 76', preserveAspectRatio:'none', 'aria-hidden':'true'});
  graphic.append(chartElement('path', {d:'M5 68H355 M5 37H355 M5 7H355', stroke:'#bcc7c2', 'stroke-dasharray':'2 4', fill:'none'}));
  let path = '';
  entries.forEach(({value}, index) => {
    if (!Number.isFinite(value)) return;
    path += (index && Number.isFinite(entries[index - 1].value) ? 'L' : 'M') + x(index) + ' ' + y(value) + ' ';
    graphic.append(chartElement('circle', {cx:x(index), cy:y(value), r:2.4, class:'forecast-point'}));
  });
  graphic.append(chartElement('path', {d:path, fill:'none', stroke:'#497269', 'stroke-width':2}));
  const marker = chartElement('circle', {r:4.5, class:'forecast-selected'});
  graphic.append(marker);
  plot.append(create('small', 'atlas-scale', 'Scale 0–' + max + ' µg/m³ PM₂.₅'), graphic);
  const preview = (index, apply) => {
    const {time, value} = entries[index];
    const available = Number.isFinite(value);
    const label = localStamp(time) + ' · ' + (available ? value + ' µg/m³ PM₂.₅' : 'PM₂.₅ unavailable');
    slider.value = index;
    slider.setAttribute('aria-valuetext', label);
    setText('forecast-detail', label);
    marker.setAttribute('cx', x(index));
    marker.setAttribute('cy', available ? y(value) : 0);
    marker.setAttribute('visibility', available ? 'visible' : 'hidden');
    if (!apply) return;
    reset.hidden = false;
    setText('measurement-kind', 'Selected hourly forecast');
    setText('pm-value', available ? value : '—');
    setText('measure-caption', localStamp(time) + ' · Open-Meteo / CAMS');
    atmosphere.setDensity(available ? value : undefined);
  };
  setText('forecast-start', localStamp(first));
  setText('forecast-end', localStamp(entries[23].time));
  slider.oninput = () => preview(Number(slider.value), true);
  graphic.onclick = event => {
    const bounds = graphic.getBoundingClientRect();
    preview(Math.max(0, Math.min(23, Math.round(((event.clientX - bounds.left) / bounds.width * 360 - 5) / 350 * 23))), true);
  };
  reset.onclick = () => {
    showCurrentReading(state.air?.primary);
    preview(0, false);
    reset.hidden = true;
    slider.focus();
  };
  preview(0, false);
}
function initCityDialog(){
  $('#air-retry').addEventListener('click', refreshAir);const dialog=$('#city-dialog');$('#location-trigger').addEventListener('click',()=>{dialog.showModal();$('#city-search').value='';renderCities(PRESETS);setText('city-search-status','Quick selections · or search across India');$('#city-search').focus();});
  let pending=null;const input=$('#city-search');input.addEventListener('input',()=>{
    clearTimeout(pending);const query=input.value.trim();if(query.length<2){renderCities(PRESETS);setText('city-search-status','Quick selections');return;}
    setText('city-search-status','Searching locations in India…');pending=setTimeout(async()=>{
      try{const data=await jsonRequest(`/api/cities?q=${encodeURIComponent(query)}`);
        if(input.value.trim()!==query)return;renderCities(data.results||[]);
        setText('city-search-status',data.results?.length?`${data.results.length} matching locations`:'No matching Indian locations found');
      }catch{if(input.value.trim()===query){renderCities(PRESETS);setText('city-search-status','Search unavailable. Choose one of these cities or try again.');}}
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
function initScenarios() {
  const tabs = $$('.scenario-tab');
  function show(tab) {
    state.scenario = tab.dataset.scenario;
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    }
    if (state.scenario === 'play') refreshStudioContext();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab));
    tab.addEventListener('keydown', event => {
      const targets = {ArrowLeft: (index + tabs.length - 1) % tabs.length,
        ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1};
      if (!(event.key in targets)) return;
      event.preventDefault();
      const next = tabs[targets[event.key]];
      show(next);
      next.focus();
    });
  });
  $('#suggested-fork').addEventListener('click', () => {
    show(document.getElementById(`tab-${$('#suggested-fork').dataset.scenario}`));
  });
  for (const id of ['trip-distance', 'trip-frequency', 'occupancy', 'replaces-trips']) {
    document.getElementById(id).addEventListener('input', updateCommute);
  }
  for (const id of ['errand-distance', 'errand-combined']) {
    document.getElementById(id).addEventListener('input', updateErrands);
  }
  $('#play-hour').addEventListener('change', renderPlay);
  $('#play-plan').addEventListener('change', renderPlay);
  updateCommute();
  updateErrands();
  show(tabs[0]);
}

let impactSeq = 0;
let impactTimer;
function updateCommute() {
  const dist = $('#trip-distance').valueAsNumber;
  const trips = $('#trip-frequency').valueAsNumber;
  const occupants = $('#occupancy').valueAsNumber;
  const replaces = $('#replaces-trips').checked;
  setText('distance-output', `${dist} km`);
  setText('frequency-output', trips);
  setText('occupancy-output', occupants);
  drawRideSeats('fork-solo-seats', 1, 7);
  drawRideSeats('fork-shared-seats', occupants, 39);
  const seq = ++impactSeq;
  clearTimeout(impactTimer);
  setText('solo-value', '…');
  setText('shared-value', '…');
  $('#solo-bar').value = 0;
  $('#shared-bar').value = 0;
  setText('commute-impact', 'Calculating…');
  setText('avoided-impact', '—');
  impactTimer = setTimeout(async () => {
    try {
      const result = await post('/api/impact', {distance_km: dist, trips_per_week: trips,
        occupants, replaces_solo_trips: replaces});
      if (seq !== impactSeq) return;
      setText('solo-value', result.solo_kg_co2_week.toFixed(1));
      setText('shared-value', result.shared_kg_co2_person_week.toFixed(1));
      $('#solo-bar').value = 1;
      $('#shared-bar').value = 1 / occupants;
      setText('commute-impact', occupants === 1 ? 'One occupant carries the full allocation.' :
        `Sharing divides one car’s emissions among ${occupants} people. Your weekly allocation falls by ${result.allocation_difference_kg_person_week.toFixed(1)} kg CO₂.`);
      setText('avoided-impact', replaces ?
        `Replacing ${occupants} solo ${occupants === 1 ? 'journey' : 'journeys'} with one shared drive avoids an estimated ${result.avoided_vehicle_km_week} vehicle-km and ${result.avoided_tailpipe_kg_week.toFixed(1)} kg tailpipe CO₂ each week.` :
        'To estimate group savings, confirm that sharing replaces separate car journeys.');
    } catch {
      if (seq !== impactSeq) return;
      setText('solo-value', '—');
      setText('shared-value', '—');
      setText('commute-impact', 'Calculation unavailable. Change a control to try again.');
    }
  }, 120);
}

function drawRideSeats(id, count, y) {
  const group = document.getElementById(id);
  group.replaceChildren();
  for (let seat = 0; seat < count; seat++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', 171 + seat * 29);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 5);
    group.append(circle);
  }
}

function updateErrands() {
  const dist = $('#errand-distance').valueAsNumber;
  const combined = $('#errand-combined').valueAsNumber;
  const separate = 3 * dist;
  const delta = separate - combined;
  setText('errand-distance-output', `${dist} km`);
  setText('errand-combined-output', `${combined} km`);
  setText('errand-before', separate);
  setText('errand-after', combined);
  $('#errand-a-bar').max = $('#errand-b-bar').max = Math.max(separate, combined);
  $('#errand-a-bar').value = separate;
  $('#errand-b-bar').value = combined;
  setText('errand-impact', delta === 0 ? 'Both options cover the same distance.' :
    `The combined trip is ${Math.abs(delta)} km ${delta > 0 ? 'shorter' : 'longer'} than three separate trips.`);
}

function refreshStudioContext() {
  let scenario = 'errands';
  if (['car', 'carpool'].includes(state.household.commuting)) scenario = 'commute';
  else if (state.household.children) scenario = 'play';
  const labels = {commute: 'Compare shared journeys', errands: 'Compare errand trips', play: 'Compare playtime options'};
  $('#suggested-fork').dataset.scenario = scenario;
  setText('suggested-fork-label', labels[scenario]);
  const hour = $('#play-hour');
  const previous = hour.value;
  hour.replaceChildren(new Option('Latest available', ''));
  for (const point of state.air?.forecast || []) {
    if (!Number.isFinite(point.pm2_5)) continue;
    hour.add(new Option(dateText(point.time, {day:'numeric', month:'short', hour:'numeric', minute:'2-digit'}) + ' IST · forecast', point.time));
  }
  hour.value = [...hour.options].some(option => option.value === previous) ? previous : '';
  renderPlay();
  renderRoomPractice();
}

function renderPlay() {
  const selection = $('#play-plan');
  const plan = selection.value;
  const suggestions = {
    active: 'For a full game, review the outdoor context again at the field. Keep a shorter session or indoor game available if conditions change.',
    short: 'Try a short skills session with breaks. Practise catching or gentle footwork and choose a spot away from busy traffic.',
    indoor: 'Try a dance circuit or soft-ball catching indoors. Pick a room away from smoke and active cooking.'
  };
  const family = state.household.children ? ' Let the child help choose the alternative.' : '';
  const sensitive = state.household.sensitive || state.household.older_adults ? ' Account for individual needs and follow any personal care plan.' : '';
  setText('play-option-title', selection.selectedOptions[0].textContent);
  setText('play-choice', suggestions[plan] + family + sensitive);
  const selectedHour = $('#play-hour').value;
  const point = state.air?.forecast?.find(item => item.time === selectedHour);
  const reading = state.air?.primary;
  const dateFormat = {day:'numeric', month:'short', hour:'numeric', minute:'2-digit'};
  let context = `Current PM₂.₅ evidence is unavailable for ${state.location.name}. Check local advisories when planning outdoor play.`;
  if (point) {
    context = `${state.location.name} · Open-Meteo / CAMS forecast for ${dateText(point.time, dateFormat)} IST: ${point.pm2_5} µg/m³ PM₂.₅. Future conditions can change.`;
  } else if (reading) {
    const type = reading.kind === 'observation' ? 'Station observation' : 'Model estimate';
    context = `${state.location.name} · ${type} from ${reading.provider}, ${dateText(reading.measured_at, dateFormat)} IST: ${reading.value} µg/m³ PM₂.₅. Exposure also depends on where, how long and how intensely you play.`;
  }
  setText('play-context', context);
}

let roomSeq = 0;
let roomTimer;
function updateRoom() {
  const area = $('#room-area').valueAsNumber;
  const ceiling = $('#room-height').valueAsNumber;
  const ach = $('#room-ach').valueAsNumber;
  setText('room-area-output', `${area} m²`);
  setText('room-height-output', `${ceiling.toFixed(1)} m`);
  setText('room-ach-output', ach);
  const seq = ++roomSeq;
  clearTimeout(roomTimer);
  setText('room-cadr', '…');
  setText('room-note', 'Updating room volume…');
  roomTimer = setTimeout(async () => {
    try {
      const result = await post('/api/room', {area_m2: area, ceiling_m: ceiling, clean_air_changes_hour: ach});
      if (seq !== roomSeq) return;
      setText('room-cadr', result.target_cadr_m3h);
      setText('room-note', `${result.room_volume_m3} m³ room volume × ${ach} clean air changes per hour.`);
    } catch {
      if (seq !== roomSeq) return;
      setText('room-cadr', '—');
      setText('room-note', 'Sizing service unavailable. Change a control to try again.');
    }
  }, 120);
}

function renderRoomPractice() {
  const feature = $('.breathing-stage').dataset.feature;
  const practices = {
    source: 'Use kitchen extraction that vents outdoors when cooking. Keep smoke and incense out of the room.',
    filter: state.household.purifier ? 'Check your cleaner’s smoke CADR, leave its intake clear and follow the filter replacement schedule.' :
      'Compare the smoke CADR on the cleaner’s label with the room target. Allow space around the air intake.',
    window: 'Weigh outdoor conditions against indoor sources when airing the room. Review current outdoor evidence and local advice.'
  };
  const householdNote = feature === 'source' && (state.household.children || state.household.older_adults || state.household.sensitive)
    ? ' Plan a separate space for household members while cooking.' : '';
  setText('room-practice', practices[feature] + householdNote);
}

function initRoom() {
  for (const id of ['room-area', 'room-height', 'room-ach']) {
    document.getElementById(id).addEventListener('input', updateRoom);
  }
  const buttons = $$('.breathing-select button');
  buttons.forEach(button => button.addEventListener('click', () => {
    $('.breathing-stage').dataset.feature = button.dataset.feature;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderRoomPractice();
  }));
  updateRoom();
  refreshStudioContext();
}
function refreshAssistantContext() {
  const profile = state.household;
  const family = [profile.audience, profile.children && 'children', profile.older_adults && 'older adults']
    .filter(Boolean).join(' · ');
  setText('ask-city', state.location.name);
  setText('ask-household', family);
  const reading = state.air?.primary;
  setText('ask-evidence', reading ? (reading.kind === 'model' ? 'Atmospheric model estimate' : 'Nearby station observation')
    : state.loading ? 'Checking available sources…' : 'No recent outdoor reading');
  const suggestion = $('#ask-suggest-profile');
  if (!suggestion) return;
  const [label, question] = profile.audience === 'community'
    ? ['Plan a community event', 'How should our apartment community plan an outdoor event during smog?']
    : profile.children ? ['Plan evening play', 'Should my child play cricket outside this evening?']
    : profile.older_adults ? ['Plan a daily walk', 'How can older adults in my household plan a walk today?']
    : ['Plan a daily routine', 'How should I plan my routine around the air today?'];
  suggestion.textContent = label;
  suggestion.dataset.question = question;
}

function formatReply(article, data) {
  article.append(create('p', 'ask-source', data.mode === 'gemini' ? 'Guided by Gemini' : 'Rule-based guidance'),
    create('h2', '', data.title), create('p', '', data.answer), create('h3', '', 'Suggested actions'));
  const actions = create('ol');
  for (const action of data.actions) actions.append(create('li', '', action));
  article.append(actions);
  if (data.alternative) article.append(create('h3', '', 'Another option'), create('p', '', data.alternative));
  article.append(create('p', 'ask-source', data.evidence));
  const disclosure = create('details');
  disclosure.append(create('summary', '', 'Assumptions and source'), create('p', '', data.assumption),
    create('p', '', data.caveat), create('p', 'ask-source', data.source));
  article.append(disclosure);
}

function initAssistant() {
  const form = $('#ask-form'), input = $('#question-input'), send = $('#send-button');
  const stream = $('#conversation-stream');
  refreshAssistantContext();
  $$('#view-assistant [data-question]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.question;
    input.focus();
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (send.disabled || question.length < 3) {
      if (question.length < 3) {
        input.setCustomValidity('Enter a question of at least three characters.');
        input.reportValidity();
      }
      return;
    }
    const payload = {question, location: state.location, household: state.household, scenario: state.askScenario || null};
    const planningFor = $('#ask-household').textContent;
    send.disabled = true;
    input.value = '';
    setText('assistant-mode', 'Checking the evidence and matching guidance to your question…');
    try {
      const result = await post('/api/ask', payload, 30000);
      const article = create('article', 'ask-entry');
      const header = create('header');
      header.append(create('small', '', payload.location.name + ' · ' + planningFor), create('p', '', question));
      article.append(header);
      formatReply(article, result);
      stream.prepend(article);
      if (stream.children.length > 12) stream.lastElementChild.remove();
      setText('assistant-mode', 'Your decision brief is ready.');
    } catch (error) {
      if (!input.value) input.value = question;
      setText('assistant-mode', 'Could not load guidance. ' + (error.name === 'AbortError'
        ? 'The request timed out. Please try again.' : error.message));
    } finally {
      send.disabled = false;
    }
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
}
const atmosphere = createAtmosphere($('#air-canvas'), () => state.view === 'intelligence');
window.addEventListener('pagehide', event => { if (!event.persisted) atmosphere.destroy(); });
function boot(){initNavigation();initCityDialog();initProfile();initScenarios();initRoom();initAssistant();updateDate();refreshAir();}
boot();
