'use strict';

/* ================= Instellingen ================= */
const MAP_ID = '1367Z5MSQPV0Qaguls_8fHypdUIV6ff0';
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`;
const GMAP_URL = `https://www.google.com/maps/d/viewer?mid=${MAP_ID}`;
// SHA-256 van het groepswachtwoord (kleine letters, zonder spaties eromheen).
const PASSWORD_HASH = '5abfff6a745dd79f0bb51c3b80f3a00de3c3c78c426dfcd81d9c685dd7fe60e6';
const PAGE = 60;
const CACHE_KEY = 'rr-data';   // laatst opgehaalde kaartdata, voor direct beeld en als Google niet reageert
const SEEN_KEY = 'rr-seen';    // wie er bij eerdere bezoeken al op de kaart stond
const VISIT_GAP = 12 * 3600 * 1000; // na 12 uur telt een bezoek als een nieuw bezoek

/* Interesses: label + zoekpatroon op de bio (kleine letters, zonder accenten). */
const TAGS = [
  ['Tuinieren', /tuin|planten|bloemen|kweken|zaaien|permacult/],
  ['Brocante', /brocant|vide.?grenier|rommelmarkt|antiek|vintage|kringloop/],
  ['Wandelen', /wandel|hike|hiken|hiking/],
  ['Fietsen', /fiets|mountainbik|wielren/],
  ['Paarden', /paard|pony/],
  ['Honden', /\bhond/],
  ['Katten', /\bkat(ten|tjes|je)?\b|\bpoes/],
  ['Kippen & boerderij', /\bkip(pen|petjes)?\b|\bgeit|schaap|schapen|\bezel|boerderij|moestuin.*dieren/],
  ['Koken & eten', /koken|\bkook|bakken|culinair|recept|lekker eten|uit eten/],
  ['Wijn', /\bwijn/],
  ['Lezen & schrijven', /lezen|boeken|schrijv|schrijf|\bboek\b/],
  ['Kunst & creatief', /schilder|tekenen|kunst|creatie|creatief|keramiek|atelier|pottenbak|beeldhouw/],
  ['Handwerk', /haken|breien|naaien|quilt|borduren|handwerk/],
  ['Muziek & dans', /muziek|zingen|\bzang|\bkoor\b|dansen|piano|gitaar/],
  ['Fotografie', /fotogra/],
  ['Yoga & meditatie', /yoga|mediteren|meditatie|mindful/],
  ['Spiritualiteit & coaching', /spiritu|healing|reiki|coach|therapeut/],
  ['Zwemmen', /zwem/],
  ['Reizen', /reizen|camper/],
  ['Klussen & verbouwen', /klus|verbouw|renov|opknap/],
  ['Gîte, B&B of camping', /gite|chambre|b&b|b ?& ?b|bed (and|&) breakfast|vakantiehuis|vakantiewoning|camping|gastenkamer/],
  ['Eigen bedrijf', /eigen bedrijf|onderne|zzp|zelfstandig|auto.?entrepreneur|micro.?entreprise/],
  ['Gepensioneerd', /pensioen|gepensioneerd|retraite/],
  ['Kleinkinderen', /kleinkind/],
  ['Uit België', /belgi|vlaam|vlaanderen|antwerp|gent\b/],
  ['Nog (deels) in NL/BE', /nog in nederland|nog in belgi|binnenkort|gaan verhuizen|hopen .{0,40}verhuizen|heen en weer|pendel|deels in|half jaar/],
];

const REGIONS = {
  'Auvergne-Rhône-Alpes': '01 03 07 15 26 38 42 43 63 69 73 74',
  'Bourgogne-Franche-Comté': '21 25 39 58 70 71 89 90',
  'Bretagne': '22 29 35 56',
  'Centre-Val de Loire': '18 28 36 37 41 45',
  'Corse': '2A 2B',
  'Grand Est': '08 10 51 52 54 55 57 67 68 88',
  'Hauts-de-France': '02 59 60 62 80',
  'Île-de-France': '75 77 78 91 92 93 94 95',
  'Normandie': '14 27 50 61 76',
  'Nouvelle-Aquitaine': '16 17 19 23 24 33 40 47 64 79 86 87',
  'Occitanie': '09 11 12 30 31 32 34 46 48 65 66 81 82',
  'Pays de la Loire': '44 49 53 72 85',
  "Provence-Alpes-Côte d'Azur": '04 05 06 13 83 84',
};
const REGION_OF = {};
for (const [r, codes] of Object.entries(REGIONS)) codes.split(' ').forEach(c => REGION_OF[c] = r);

const AVATAR_COLORS = ['#b4485f', '#c8693f', '#8e3046', '#a0765a', '#7d5a8c', '#5f7f6a', '#b5735f', '#94506e'];

/* ================= Hulpjes ================= */
const $ = s => document.querySelector(s);
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKm = km => km < 10 ? km.toFixed(1).replace('.', ',') + ' km' : Math.round(km) + ' km';
function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; /* privémodus of vol */ } }
function storageJson(k) { try { return JSON.parse(storageGet(k)); } catch { return null; } }
const keyOf = r => `${r.name}|${r.town}|${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
const fmtDate = t => new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });

/* ================= Wachtwoord ================= */
function initGate() {
  if (storageGet('rr-key') === PASSWORD_HASH) return start();
  $('#gate').hidden = false;
  $('#gatePw').focus();
  $('#gateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const h = await sha256($('#gatePw').value.trim().toLowerCase());
    if (h === PASSWORD_HASH) {
      storageSet('rr-key', h);
      $('#gate').hidden = true;
      start();
    } else {
      $('#gateErr').hidden = false;
      $('#gatePw').select();
    }
  });
}

/* ================= Data inlezen ================= */
function splitName(raw) {
  const s = raw.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  let m = s.match(/^(.*?)(?:\s+[-–—]\s*|\s*[-–—]\s+)(.+)$/);
  if (m && m[1]) return { name: m[1].trim(), town: m[2].trim() };
  m = s.match(/^(\S+)\s+(.+)$/);
  if (m) return { name: m[1], town: m[2] };
  return { name: s, town: '' };
}

const FB_RE = /(?:https?:\/\/)?(?:www\.|m\.|web\.|nl-nl\.)?facebook\.com\/[^\s<>"']+/gi;
function cleanBio(html) {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n');
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent || '';
  const links = text.match(FB_RE) || [];
  let fb = links[0] || '';
  if (fb && !/^https?:/i.test(fb)) fb = 'https://' + fb;
  const bio = text.replace(FB_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { bio, fb };
}

function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('KML onleesbaar');
  const out = [];
  [...doc.getElementsByTagName('Placemark')].forEach(pm => {
    const coord = (pm.getElementsByTagName('coordinates')[0]?.textContent || '').trim().split(',');
    const lng = parseFloat(coord[0]), lat = parseFloat(coord[1]);
    if (!isFinite(lat) || !isFinite(lng)) return;
    const raw = (pm.getElementsByTagName('name')[0]?.textContent || '').trim();
    const { name, town } = splitName(raw);
    const { bio, fb } = cleanBio(pm.getElementsByTagName('description')[0]?.textContent || '');
    out.push({ name, town, bio, fb, lat, lng });
  });
  return out;
}

/* Maakt van een kale rij een lid met alles wat de pagina nodig heeft.
   De id is de volgorde in de Google-kaart: hoger = later toegevoegd. */
function hydrate(r, id) {
  const n = norm(r.bio);
  return {
    ...r, id, key: keyOf(r), ll: [r.lat, r.lng],
    text: norm(`${r.name} ${r.town} ${r.bio}`),
    tags: TAGS.filter(([, re]) => re.test(n)).map(([l]) => l),
    color: AVATAR_COLORS[(r.name.charCodeAt(0) || 0) % AVATAR_COLORS.length],
    isNew: false,
  };
}

/* ================= Départementen ================= */
let depts = [];
function prepDepts(gj) {
  depts = gj.features.map(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const bb = [180, 90, -180, -90];
    polys.forEach(p => p[0].forEach(([x, y]) => {
      bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y);
      bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y);
    }));
    return { code: f.properties.code, nom: f.properties.nom, polys, bb, feature: f, count: 0 };
  });
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPoly(x, y, poly) {
  if (!inRing(x, y, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (inRing(x, y, poly[k])) return false;
  return true;
}
function findDept(lat, lng) {
  for (const d of depts) {
    if (lng < d.bb[0] || lng > d.bb[2] || lat < d.bb[1] || lat > d.bb[3]) continue;
    if (d.polys.some(p => inPoly(lng, lat, p))) return d;
  }
  // Net buiten de vereenvoudigde grens (kust, grens): dichtstbijzijnde binnen 25 km.
  let best = null, bestKm = 25;
  for (const d of depts) {
    for (const p of d.polys) for (const [x, y] of p[0]) {
      const km = haversine([lat, lng], [y, x]);
      if (km < bestKm) { bestKm = km; best = d; }
    }
  }
  return best;
}

/* ================= Toestand ================= */
let people = [];
const state = {
  tab: 'ontdek', q: '', tags: new Set(), dept: null, onlyNew: false, sort: 'new',
  shown: PAGE, near: null, radius: 30, selected: null,
};
let map, clusters, nearLayer, deptLayer, selMarker;
let statsDirty = true, newSince = null, lastFocus = null;

function matches(p) {
  if (state.onlyNew && !p.isNew) return false;
  if (state.dept && p.dept?.code !== state.dept) return false;
  for (const t of state.tags) if (!p.tags.includes(t)) return false;
  if (state.q) {
    for (const w of norm(state.q).split(/\s+/).filter(Boolean)) if (!p.text.includes(w)) return false;
  }
  return true;
}
const filtersActive = () => !!(state.q || state.tags.size || state.dept || state.onlyNew);

/* ================= Kaart ================= */
function initMap() {
  map = L.map('map', { zoomControl: true, minZoom: 4, worldCopyJump: true }).setView([46.6, 2.4], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  clusters = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true, chunkedLoading: true,
    iconCreateFunction: c => {
      const n = c.getChildCount(), size = n < 10 ? 32 : n < 50 ? 40 : n < 150 ? 48 : 56;
      return L.divIcon({ html: `<div class="cluster" style="width:${size}px;height:${size}px">${n}</div>`, className: '', iconSize: [size, size] });
    },
  }).addTo(map);
  nearLayer = L.layerGroup().addTo(map);

  map.on('click', e => {
    if (state.tab === 'buurt') setNear([e.latlng.lat, e.latlng.lng], 'Gekozen punt op de kaart');
  });
}

const pinIcon = L.divIcon({ html: '<div class="pin"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
const pinIconSel = L.divIcon({ html: '<div class="pin sel"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] });

function buildMarkers() {
  people.forEach(p => {
    p.marker = L.marker(p.ll, { icon: pinIcon, title: `${p.name} – ${p.town}`, alt: `${p.name} – ${p.town}`, riseOnHover: true });
    p.marker.on('click', () => openCard(p, { fly: false }));
  });
}

function refreshMarkers() {
  clusters.clearLayers();
  if (state.tab === 'stats') return;
  clusters.addLayers(people.filter(matches).map(p => p.marker));
}

/* ================= Ontdek ================= */
function renderChips() {
  const counts = {};
  people.forEach(p => { if (matchesExceptTags(p)) p.tags.forEach(t => counts[t] = (counts[t] || 0) + 1); });
  const order = TAGS.map(([l]) => l).sort((a, b) => (state.tags.has(b) - state.tags.has(a)) || ((counts[b] || 0) - (counts[a] || 0)));
  $('#chips').innerHTML = order.map(l =>
    `<button class="chip${state.tags.has(l) ? ' on' : ''}" aria-pressed="${state.tags.has(l)}" data-tag="${esc(l)}">${esc(l)} <span class="n">${counts[l] || 0}</span></button>`
  ).join('');
}
function matchesExceptTags(p) {
  const saved = state.tags; state.tags = new Set();
  const ok = matches(p); state.tags = saved;
  for (const t of saved) if (!p.tags.includes(t)) return false;
  return ok;
}

function renderActiveFilters() {
  const bits = [];
  if (state.dept) {
    const d = depts.find(x => x.code === state.dept);
    bits.push(`<button class="chip pill-x" data-clear="dept">${esc(d ? d.nom : state.dept)} ✕</button>`);
  }
  if (state.onlyNew) bits.push(`<button class="chip pill-x" data-clear="new">Nieuw sinds je vorige bezoek ✕</button>`);
  $('#activeFilters').innerHTML = bits.join('');
  $('#clearFilters').hidden = !filtersActive();
  const nNew = people.filter(p => p.isNew).length, banner = $('#newBanner');
  banner.hidden = !nNew || state.onlyNew;
  if (nNew) banner.innerHTML = `<b>${nNew} ${nNew === 1 ? 'nieuwe vrouw' : 'nieuwe vrouwen'}</b> sinds je vorige bezoek${newSince ? ` op ${fmtDate(newSince)}` : ''} <span>Bekijk ›</span>`;
}

function liHtml(p, km) {
  const snip = p.bio ? esc(p.bio.slice(0, 160)) : '';
  return `<li data-id="${p.id}" tabindex="0" role="button"${state.selected === p ? ' class="active"' : ''}>
    <div class="avatar" style="background:${p.color}">${esc((p.name[0] || '?').toUpperCase())}</div>
    <div class="li-main">
      <div class="li-top"><span class="li-name">${esc(p.name)}${p.isNew ? ' <span class="badge-new">Nieuw</span>' : ''}</span>${km != null ? `<span class="li-km">${fmtKm(km)}</span>` : ''}</div>
      <div class="li-town">${esc(p.town)}${p.dept ? ` · ${esc(p.dept.nom)}` : ''}</div>
      ${snip ? `<div class="li-snip">${snip}</div>` : ''}
    </div></li>`;
}

function renderList() {
  const res = people.filter(matches);
  if (state.sort === 'new') res.sort((a, b) => b.id - a.id);
  else if (state.sort === 'az') res.sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.town.localeCompare(b.town, 'nl'));
  $('#resultCount').textContent = filtersActive()
    ? `${res.length} van ${people.length} vrouwen`
    : `Alle ${people.length} vrouwen`;
  const slice = res.slice(0, state.shown);
  $('#list').innerHTML = slice.length ? slice.map(p => liHtml(p)).join('') : '<li class="empty">Niemand gevonden. Probeer minder filters.</li>';
  $('#more').hidden = res.length <= state.shown;
  $('#more').textContent = `Meer tonen (${res.length - state.shown} over)`;
}

function onFiltersChanged() {
  state.shown = PAGE;
  renderChips(); renderActiveFilters(); renderList(); refreshMarkers();
  if (state.near) renderNear();
}

/* ================= In de buurt ================= */
function setNear(ll, label, excludeId = null) {
  state.near = { ll, label, excludeId };
  renderNear();
}
function renderNear() {
  nearLayer.clearLayers();
  const box = $('#nearSummary'), list = $('#nearList');
  if (!state.near) { box.innerHTML = ''; list.innerHTML = ''; return; }
  const { ll, label } = state.near, r = state.radius;
  L.circle(ll, { radius: r * 1000, color: '#b4485f', weight: 1.5, fillColor: '#b4485f', fillOpacity: .07, interactive: false }).addTo(nearLayer);
  L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: '#2e312f', fillOpacity: 1 }).addTo(nearLayer)
    .bindTooltip(esc(label), { direction: 'top' });
  if (state.tab === 'buurt') map.flyToBounds(L.latLng(ll).toBounds(r * 2000 * 1.1), { duration: .6 });

  const pool = people.filter(p => p.id !== state.near.excludeId && matches(p)).map(p => ({ p, km: haversine(ll, p.ll) })).sort((a, b) => a.km - b.km);
  const res = pool.filter(x => x.km <= r);
  const filt = filtersActive() ? ` · met je filters uit Ontdek (<button class="link" data-act="clear-filters">wissen</button>)` : '';
  box.innerHTML = `<div class="big">${res.length === 0 ? 'Nog niemand' : res.length === 1 ? '1 vrouw' : res.length + ' vrouwen'} binnen ${r} km</div>
    <div class="sub">rond ${esc(label)}${filt}</div>`;
  if (res.length) {
    list.innerHTML = res.map(({ p, km }) => liHtml(p, km)).join('');
  } else {
    const nearest = pool.slice(0, 3);
    list.innerHTML = nearest.length
      ? `<li class="empty" style="cursor:default">Dichtstbijzijnde vrouwen:</li>` + nearest.map(({ p, km }) => liHtml(p, km)).join('')
      : '<li class="empty">Niemand gevonden.</li>';
  }
}

let placeReq = 0, placeItems = [], placeHl = -1;
const searchPlace = debounce(async q => {
  const box = $('#placeSugg');
  if (q.length < 2) { box.hidden = true; return; }
  const my = ++placeReq;
  const isZip = /^\d{2,5}$/.test(q);
  const url = `https://geo.api.gouv.fr/communes?${isZip ? 'codePostal' : 'nom'}=${encodeURIComponent(q)}&fields=nom,centre,codeDepartement,codesPostaux&boost=population&limit=7`;
  try {
    const res = await fetch(url);
    if (my !== placeReq) return;
    if (isZip && q.length < 5) { box.hidden = true; return; }
    placeItems = (await res.json()).filter(c => c.centre);
  } catch { placeItems = []; }
  placeHl = -1;
  box.innerHTML = placeItems.length
    ? placeItems.map((c, i) => `<li data-i="${i}">${esc(c.nom)} <small>${esc(c.codesPostaux?.[0] || c.codeDepartement)}</small></li>`).join('')
    : '<li style="cursor:default"><small>Geen Franse gemeente gevonden</small></li>';
  box.hidden = false;
}, 220);

function pickPlace(i) {
  const c = placeItems[i]; if (!c) return;
  $('#place').value = c.nom;
  $('#placeSugg').hidden = true;
  const [lng, lat] = c.centre.coordinates;
  setNear([lat, lng], c.nom);
}

/* ================= Cijfers ================= */
const BINS = [[0, '#f1ece6'], [1, '#f6d5db'], [6, '#e9a7b4'], [11, '#d3758b'], [21, '#b4485f'], [41, '#7a2439']];
const binColor = n => { let c = BINS[0][1]; for (const [min, col] of BINS) if (n >= min) c = col; return c; };

function buildDeptLayer() {
  deptLayer = L.geoJSON({ type: 'FeatureCollection', features: depts.map(d => d.feature) }, {
    style: f => {
      const d = depts.find(x => x.code === f.properties.code);
      return { fillColor: binColor(d.count), fillOpacity: .78, color: '#fff', weight: 1 };
    },
    onEachFeature: (f, layer) => {
      const d = depts.find(x => x.code === f.properties.code);
      layer.bindTooltip(`<b>${esc(d.nom)}</b> (${d.code})<br>${d.count === 0 ? 'nog niemand' : d.count + (d.count === 1 ? ' vrouw' : ' vrouwen')}`, { sticky: true, className: 'dept-tip' });
      layer.on('mouseover', () => layer.setStyle({ weight: 2.5, color: '#2e312f' }));
      layer.on('mouseout', () => deptLayer.resetStyle(layer));
      layer.on('click', () => filterDept(d.code));
    },
  });
  $('#legend').innerHTML = '<b>Leden per département</b>' + BINS.map(([min, col], i) => {
    const max = BINS[i + 1] ? BINS[i + 1][0] - 1 : null;
    const lab = min === 0 ? 'nog niemand' : max == null ? `${min}+` : min === max ? `${min}` : `${min}–${max}`;
    return `<div class="row"><span class="sw" style="background:${col}"></span>${lab}</div>`;
  }).join('');
}

function filterDept(code) {
  state.dept = code;
  const d = depts.find(x => x.code === code);
  switchTab('ontdek');
  onFiltersChanged();
  if (d) map.flyToBounds([[d.bb[1], d.bb[0]], [d.bb[3], d.bb[2]]], { padding: [20, 20], duration: .6 });
}

function renderStats() {
  const n = people.length;
  const withMembers = depts.filter(d => d.count > 0);
  const sorted = [...depts].sort((a, b) => b.count - a.count);
  const regions = {};
  people.forEach(p => { const r = p.dept ? REGION_OF[p.dept.code] : null; if (r) regions[r] = (regions[r] || 0) + 1; });
  const regSorted = Object.entries(REGIONS).map(([r]) => [r, regions[r] || 0]).sort((a, b) => b[1] - a[1]);
  const empty = depts.filter(d => d.count === 0).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  // Afstand tot het dichtstbijzijnde andere lid
  const nnRaw = people.map(p => {
    let best = Infinity;
    for (const q of people) if (q !== p) { const km = haversine(p.ll, q.ll); if (km < best) best = km; }
    return best;
  });
  const nn = [...nnRaw].sort((a, b) => a - b);
  const median = nn.length ? nn[Math.floor(nn.length / 2)] : 0;
  const loneliest = people.length > 1 ? people[nnRaw.indexOf(Math.max(...nnRaw))] : null;
  const top = sorted[0];
  const max = top?.count || 1;

  const bar = (label, sub, count, attrs) => `<li ${attrs}><span class="nm">${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ''}</span><span class="ct">${count}</span><span class="bar"><i style="width:${(count / max * 100).toFixed(1)}%"></i></span></li>`;
  const regMax = regSorted[0]?.[1] || 1;

  $('#stats').innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="v">${n}</div><div class="k">vrouwen op de kaart</div></div>
      <div class="kpi"><div class="v">${withMembers.length}<span style="font-size:16px;color:var(--muted)">/96</span></div><div class="k">départements met leden</div></div>
      <div class="kpi"><div class="v">${fmtKm(median)}</div><div class="k">typische afstand tot het dichtstbijzijnde lid</div></div>
      <div class="kpi"><div class="v">${top ? top.count : 0}</div><div class="k">in ${esc(top ? top.nom : '-')}, de koploper</div></div>
    </div>
    <h3 class="label">Top 10 départements</h3>
    <ul class="bars">${sorted.slice(0, 10).map(d => bar(d.nom, d.code, d.count, `data-dept="${d.code}" tabindex="0" role="button"`)).join('')}</ul>
    <p class="note">Klik op een département (hier of op de kaart) om te zien wie er woont.</p>
    <h3 class="label">Per regio</h3>
    <ul class="bars">${regSorted.map(([r, c]) => `<li style="cursor:default"><span class="nm">${esc(r)}</span><span class="ct">${c}</span><span class="bar"><i style="width:${(c / regMax * 100).toFixed(1)}%"></i></span></li>`).join('')}</ul>
    ${loneliest ? `<h3 class="label">Meest afgelegen</h3>
    <ul class="list">${liHtml(loneliest, nnRaw[loneliest.id])}</ul>
    <p class="note">Haar dichtstbijzijnde groepsgenote woont ${fmtKm(nnRaw[loneliest.id])} verderop. Iemand in de buurt?</p>` : ''}
    <h3 class="label">Nog niemand in… (${empty.length})</h3>
    <div class="chips">${empty.map(d => `<span class="chip static">${esc(d.nom)}</span>`).join('') || '<span class="note">Overal zit iemand!</span>'}</div>
    <p class="note" style="margin-top:12px">Ken je iemand die daar woont? Wijs haar op de groep.</p>
  `;
}

/* ================= Profielkaart ================= */
function openCard(p, { fly = true, focus = true } = {}) {
  if ($('#card').hidden) lastFocus = document.activeElement;
  state.selected = p;
  if (selMarker) selMarker.setIcon(pinIcon);
  selMarker = p.marker; selMarker.setIcon(pinIconSel);
  const km = state.near ? haversine(state.near.ll, p.ll) : null;
  const card = $('#card');
  card.innerHTML = `
    <button class="card-close" aria-label="Sluiten">×</button>
    <div class="card-head">
      <div class="avatar" style="background:${p.color}">${esc((p.name[0] || '?').toUpperCase())}</div>
      <div>
        <h2>${esc(p.name)}${p.isNew ? ' <span class="badge-new">Nieuw</span>' : ''}</h2>
        <div class="where">${esc(p.town)}${p.dept ? ` · ${esc(p.dept.nom)} (${p.dept.code})` : ''}${km != null ? ` · ${fmtKm(km)} van ${esc(state.near.label)}` : ''}</div>
      </div>
    </div>
    <div class="card-body">
      ${p.tags.length ? `<div class="chips">${p.tags.map(t => `<span class="chip static">${esc(t)}</span>`).join('')}</div>` : ''}
      <p class="bio${p.bio ? '' : ' none'}"></p>
    </div>
    <div class="card-actions">
      ${p.fb ? `<a class="btn btn-fb" target="_blank" rel="noopener noreferrer" href="${esc(p.fb)}">Stuur ${esc(p.name)} een berichtje op Facebook</a>` : ''}
      <button class="btn-ghost" data-act="near">Wie woont er bij ${esc(p.name)} in de buurt?</button>
    </div>`;
  card.querySelector('.bio').textContent = p.bio || 'Nog geen voorstelling geschreven.';
  card.hidden = false;
  card.setAttribute('aria-label', `Profiel van ${p.name}`);
  if (focus) card.focus({ preventScroll: true });
  card.querySelector('.card-close').onclick = () => closeCard();
  card.querySelector('[data-act="near"]').onclick = () => {
    switchTab('buurt');
    $('#place').value = `${p.name} – ${p.town}`;
    closeCard({ restoreFocus: false });
    setNear(p.ll, `${p.name} (${p.town})`, p.id);
    $('#t-buurt').focus({ preventScroll: true });
  };
  document.querySelectorAll('.list li.active').forEach(li => li.classList.remove('active'));
  document.querySelectorAll(`.list li[data-id="${p.id}"]`).forEach(li => li.classList.add('active'));
  if (fly) {
    if (state.tab === 'stats') switchTab('ontdek');
    clusters.zoomToShowLayer(p.marker, () => {
      map.panTo(p.ll, { animate: false });
      // Op desktop ligt de kaart rechts over de kaart heen: schuif het punt naar links.
      if (!window.matchMedia('(max-width: 800px)').matches) map.panBy([card.offsetWidth / 2 + 7, 0]);
    });
  }
}
function closeCard({ restoreFocus = true } = {}) {
  const wasOpen = !$('#card').hidden;
  $('#card').hidden = true;
  if (wasOpen && restoreFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
  if (selMarker) selMarker.setIcon(pinIcon);
  selMarker = null; state.selected = null;
  document.querySelectorAll('.list li.active').forEach(li => li.classList.remove('active'));
}

/* ================= Tabs ================= */
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    b.tabIndex = b.dataset.tab === tab ? 0 : -1;
  });
  ['ontdek', 'buurt', 'stats'].forEach(t => $(`#tab-${t}`).hidden = t !== tab);
  const stats = tab === 'stats';
  if (stats) {
    if (statsDirty) { renderStats(); statsDirty = false; }
    deptLayer?.addTo(map); closeCard({ restoreFocus: false });
    map.flyTo([46.6, 2.4], window.innerWidth < 800 ? 5 : 6, { duration: .6 });
  } else deptLayer?.remove();
  $('#legend').hidden = !stats;
  nearLayer[!stats && state.near ? 'addTo' : 'remove'](map);
  map.getContainer().style.cursor = tab === 'buurt' ? 'crosshair' : '';
  refreshMarkers();
  $('.panel-body').scrollTop = 0;
  $('.panel').scrollTop = 0;
}

/* ================= Events ================= */
function bindEvents() {
  const tabBtns = [...document.querySelectorAll('.tabs button')];
  tabBtns.forEach((b, i) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabBtns[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabBtns.length) % tabBtns.length];
      switchTab(next.dataset.tab); next.focus();
    });
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.shown = PAGE; renderList(); });
  $('#newBanner').addEventListener('click', () => { state.onlyNew = true; onFiltersChanged(); });
  $('#dataNote').addEventListener('click', e => { if (e.target.closest('[data-act="retry"]')) refresh(); });
  $('#loading').addEventListener('click', e => { if (e.target.closest('[data-act="retry"]')) refresh(); });

  $('#q').addEventListener('input', debounce(e => { state.q = e.target.value.trim(); onFiltersChanged(); }, 150));
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    const t = b.dataset.tag;
    state.tags.has(t) ? state.tags.delete(t) : state.tags.add(t);
    onFiltersChanged();
  });
  $('#activeFilters').addEventListener('click', e => {
    if (e.target.closest('[data-clear="dept"]')) { state.dept = null; onFiltersChanged(); }
    if (e.target.closest('[data-clear="new"]')) { state.onlyNew = false; onFiltersChanged(); }
  });
  $('#clearFilters').addEventListener('click', () => {
    state.q = ''; state.tags.clear(); state.dept = null; state.onlyNew = false; $('#q').value = ''; onFiltersChanged();
  });
  $('#more').addEventListener('click', () => { state.shown += PAGE; renderList(); });

  // Klik op een persoon in een lijst
  document.querySelector('.panel-body').addEventListener('click', e => {
    if (e.target.closest('[data-act="clear-filters"]')) { $('#clearFilters').click(); return; }
    const li = e.target.closest('li[data-id]');
    if (li) { openCard(people[+li.dataset.id]); return; }
    const d = e.target.closest('[data-dept]');
    if (d) filterDept(d.dataset.dept);
  });

  // Lijstregels werken ook met Enter of spatie
  document.querySelector('.panel-body').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('li[data-id], li[data-dept]');
    if (row && row === e.target) { e.preventDefault(); row.click(); }
  });

  // Plaats zoeken
  const place = $('#place'), sugg = $('#placeSugg');
  place.addEventListener('input', () => searchPlace(place.value.trim()));
  place.addEventListener('keydown', e => {
    const items = sugg.querySelectorAll('li[data-i]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      placeHl = (placeHl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('hl', i === placeHl));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickPlace(placeHl >= 0 ? placeHl : 0);
    } else if (e.key === 'Escape') sugg.hidden = true;
  });
  sugg.addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pickPlace(+li.dataset.i); }
  });
  place.addEventListener('blur', () => setTimeout(() => sugg.hidden = true, 150));

  $('#locate').addEventListener('click', () => {
    const note = $('#nearNotice'), btn = $('#locate');
    const fail = msg => { note.textContent = msg; note.hidden = false; };
    note.hidden = true;
    if (!navigator.geolocation) return fail('Je browser kan je locatie niet delen. Typ je dorp in of klik op de kaart.');
    btn.textContent = 'Locatie zoeken…'; btn.disabled = true;
    const done = () => { btn.textContent = '📍 Gebruik mijn locatie'; btn.disabled = false; };
    navigator.geolocation.getCurrentPosition(pos => {
      done();
      place.value = 'Mijn locatie';
      setNear([pos.coords.latitude, pos.coords.longitude], 'jouw locatie');
    }, () => {
      done();
      fail('Je locatie kon niet worden opgehaald. Typ je dorp in of klik op de kaart.');
    }, { enableHighAccuracy: false, timeout: 10000 });
  });

  const radius = $('#radius');
  radius.addEventListener('input', () => {
    state.radius = +radius.value;
    $('#radiusVal').textContent = `${state.radius} km`;
    renderNearDebounced();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#card').hidden) closeCard(); });
}
const renderNearDebounced = debounce(() => renderNear(), 120);

/* ================= Data laden ================= */

/* Zet een (nieuwe) set leden op de pagina. Wordt vaker aangeroepen:
   eerst met de bewaarde data, daarna met de verse data van Google. */
function setPeople(raw) {
  const selKey = state.selected?.key;
  closeCard({ restoreFocus: false });
  depts.forEach(d => d.count = 0);
  const seen = storageJson(SEEN_KEY);
  const base = seen?.prev ? new Set(seen.prev.keys) : null;
  newSince = seen?.prev?.t || null;
  people = raw.map((r, i) => {
    const p = hydrate(r, i);
    p.dept = findDept(p.lat, p.lng);
    if (p.dept) p.dept.count++;
    p.isNew = !!base && !base.has(p.key);
    return p;
  });
  if (!people.some(p => p.isNew)) state.onlyNew = false;
  buildMarkers();
  deptLayer?.remove();
  buildDeptLayer();
  statsDirty = true;
  if (state.tab === 'stats') { renderStats(); statsDirty = false; deptLayer.addTo(map); }
  $('#tagline').textContent = `${people.length} Nederlandstalige vrouwen in Frankrijk`;
  onFiltersChanged();
  if (selKey) { const p = people.find(x => x.key === selKey); if (p) openCard(p, { fly: false, focus: false }); }
}

/* Onthoudt wie er bij dit bezoek op de kaart staat, zodat een volgend bezoek kan tonen wie er nieuw is. */
function rememberVisit(raw) {
  const now = Date.now(), keys = raw.map(keyOf), seen = storageJson(SEEN_KEY);
  if (!seen?.cur) storageSet(SEEN_KEY, JSON.stringify({ cur: { t: now, keys }, prev: null }));
  else if (now - seen.cur.t > VISIT_GAP) storageSet(SEEN_KEY, JSON.stringify({ cur: { t: now, keys }, prev: seen.cur }));
}

let shownJson = null, shownAt = null;
function setDataNote(html) { const n = $('#dataNote'); n.innerHTML = html || ''; n.hidden = !html; }

async function refresh() {
  const hadData = people.length > 0;
  if (hadData) setDataNote('Kaart verversen…');
  else { $('#loading').hidden = false; $('#loading').textContent = 'Kaart laden…'; }
  try {
    const res = await fetch(KML_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`KML ${res.status}`);
    const raw = parseKml(await res.text());
    if (!raw.length) throw new Error('Lege kaart');
    const json = JSON.stringify(raw);
    storageSet(CACHE_KEY, JSON.stringify({ t: Date.now(), people: raw }));
    rememberVisit(raw);
    if (json !== shownJson) { shownJson = json; setPeople(raw); }
    shownAt = Date.now();
    setDataNote('');
    $('#loading').hidden = true;
  } catch (err) {
    console.error(err);
    const retry = '<button class="link" data-act="retry">Opnieuw proberen</button>';
    if (hadData) setDataNote(`Verversen lukte niet. Je ziet de kaart van ${shownAt ? fmtDate(shownAt) : 'eerder'}. ${retry}`);
    else $('#loading').innerHTML = `<div>De kaart kon niet worden geladen.<br>${retry}</div>`;
  }
}

/* ================= Start ================= */
async function start() {
  $('#app').hidden = false;
  $('#gmapLink').href = GMAP_URL;
  initMap();
  bindEvents();
  // Houd de kaart passend als het venster of de indeling van formaat verandert.
  if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($('#map'));
  else setTimeout(() => map.invalidateSize(), 50);
  try {
    prepDepts(await fetch('departements.geojson').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'De kaart kon niet worden geladen. Probeer het later opnieuw.';
    return;
  }
  // Eerst de bewaarde versie tonen (direct beeld), daarna verversen vanaf Google.
  const cached = storageJson(CACHE_KEY);
  if (cached?.people?.length) {
    shownJson = JSON.stringify(cached.people); shownAt = cached.t;
    setPeople(cached.people);
    $('#loading').hidden = true;
  }
  await refresh();
}

initGate();
