/* global L */
(() => {
  const FLAG_TEXT = {
    'coords-differ': 'Coordinates differ from Wikidata by more than 300 m.',
    'arabic-name-differs': 'Arabic name differs between OSM and Wikipedia.',
    'english-name-differs': 'English name differs between OSM and Wikidata.',
    'osm-english-missing': 'OSM has no English name for this station.',
  };
  const OFFICIAL_END_TO_END_MIN = { 'L1-main': 79 };
  const EXPECTED_STATIONS = { L1: 35, L2: 20, L3: 34 };

  const state = {
    metro: null,
    cross: new Map(),
    verification: { stations: {} },
    line: 'ALL',
    filter: 'all',
    search: '',
    selected: null,
    visibleIds: [],
  };
  let map;
  let markers = new Map();
  let saveTimer;

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[\u064b-\u065f]/g, '');
  const stationById = (id) => state.metro.stations.find((s) => s.id === id);
  const lineById = (id) => state.metro.lines.find((l) => l.id === id);
  const vOf = (s) => state.verification.stations[s.wikidata] ?? {};
  const isVerified = (s) => !!vOf(s).verified;
  const flagsOf = (s) => state.cross.get(s.id)?.flags ?? [];
  const lineIdsOf = (s) => [...new Set(s.lines.map((l) => l.line))];
  const fmtMin = (sec) => `${Math.round(sec / 60)} min`;

  async function init() {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (!data.metro) {
      document.body.innerHTML =
        '<p style="padding:24px">data/metro.json not found. Run <code>npm run data:build</code>.</p>';
      return;
    }
    state.metro = data.metro;
    state.verification = data.verification?.stations ? data.verification : { stations: {} };
    for (const c of data.crosscheck?.stations ?? []) state.cross.set(c.stationId, c);
    buildTabs();
    buildMap();
    bindEvents();
    render();
  }

  function buildTabs() {
    const tabs = [{ id: 'ALL', label: 'All', colour: '#111827' }].concat(
      state.metro.lines.map((l) => ({ id: l.id, label: l.name.en, colour: l.colour })),
    );
    $('lineTabs').innerHTML = tabs
      .map(
        (t) =>
          `<button class="tab" role="tab" data-line="${t.id}"><span class="dot" style="background:${t.colour}"></span>${esc(t.label)}</button>`,
      )
      .join('');
  }

  function buildMap() {
    map = L.map('map', { zoomControl: true }).setView([30.05, 31.27], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const lineLayer = L.layerGroup().addTo(map);
    for (const line of state.metro.lines) {
      for (const branch of line.branches) {
        const pts = branch.stations.map((id) => {
          const s = stationById(id);
          return [s.lat, s.lng];
        });
        L.polyline(pts, { color: line.colour, weight: 5, opacity: 0.85 }).addTo(lineLayer);
      }
    }
    for (const s of state.metro.stations) {
      const first = lineById(s.lines[0].line);
      const m = L.circleMarker([s.lat, s.lng], {
        radius: s.interchange ? 9 : 6,
        color: '#fff',
        weight: 2,
        fillColor: s.interchange ? '#111827' : first.colour,
        fillOpacity: 1,
      }).addTo(map);
      m.bindTooltip(`${s.name.en} · ${s.name.ar}`, { direction: 'top' });
      m.on('click', () => select(s.id, { pan: false }));
      markers.set(s.id, m);
    }
  }

  function styleMarkers() {
    for (const s of state.metro.stations) {
      const m = markers.get(s.id);
      const visible = state.visibleIds.includes(s.id);
      const ver = isVerified(s);
      m.setStyle({
        color: state.selected === s.id ? '#2563eb' : ver ? '#16a34a' : '#fff',
        weight: state.selected === s.id ? 4 : ver ? 3 : 2,
        fillOpacity: visible ? 1 : 0.15,
        opacity: visible ? 1 : 0.3,
      });
      if (state.selected === s.id) m.bringToFront();
    }
  }

  function matchesFilter(s) {
    if (state.line !== 'ALL' && !s.lines.some((l) => l.line === state.line)) return false;
    if (state.filter === 'verified' && !isVerified(s)) return false;
    if (state.filter === 'unverified' && isVerified(s)) return false;
    if (state.filter === 'flagged' && !flagsOf(s).length) return false;
    if (state.search) {
      const q = norm(state.search);
      const hay = norm([s.name.en, s.name.ar, ...s.aliases].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderList() {
    const lines = state.line === 'ALL' ? state.metro.lines : [lineById(state.line)];
    const shown = new Set();
    const html = [];
    state.visibleIds = [];
    for (const line of lines) {
      for (const branch of line.branches) {
        const items = [];
        branch.stations.forEach((id, idx) => {
          const s = stationById(id);
          if (shown.has(id) || !matchesFilter(s)) return;
          shown.add(id);
          state.visibleIds.push(id);
          const f = flagsOf(s).length;
          items.push(`
            <li class="station ${state.selected === id ? 'selected' : ''}" data-id="${id}">
              <div class="rail">${lineIdsOf(s)
                .map((l) => `<i style="background:${lineById(l).colour}"></i>`)
                .join('')}</div>
              <div class="names">
                <div class="en">${idx + 1}. ${esc(s.name.en)}</div>
                <div class="ar">${esc(s.name.ar)}</div>
              </div>
              <div class="badges">
                ${s.interchange ? '<span class="badge x">transfer</span>' : ''}
                ${f ? `<span class="badge" title="Cross-check flags">${f} ⚑</span>` : ''}
                <span class="tick ${isVerified(s) ? 'on' : ''}">${isVerified(s) ? '✓' : ''}</span>
              </div>
            </li>`);
        });
        if (items.length) {
          html.push(
            `<li class="branch-head" style="border-left:4px solid ${line.colour}">${esc(line.name.en)} · ${esc(branch.name.en)}</li>`,
            ...items,
          );
        }
      }
    }
    $('stationList').innerHTML = html.join('') || '<li class="branch-head">No stations match</li>';
  }

  function renderSummary() {
    if (state.line === 'ALL') {
      const total = state.metro.stations.length;
      const inter = state.metro.stations.filter((s) => s.interchange).length;
      const lineStations = state.metro.lines.reduce(
        (n, l) => n + new Set(l.branches.flatMap((b) => b.stations)).size,
        0,
      );
      $('lineSummary').innerHTML =
        `<b>${total}</b> physical stations · <b>${inter}</b> interchanges · <b>${lineStations}</b> line-stations (Wikipedia: 89)`;
      return;
    }
    const line = lineById(state.line);
    const count = new Set(line.branches.flatMap((b) => b.stations)).size;
    const parts = line.branches.map((b) => {
      const km = b.segments.reduce((n, x) => n + x.distanceM, 0) / 1000;
      const sec = b.segments.reduce((n, x) => n + x.rideSec, 0);
      const official = OFFICIAL_END_TO_END_MIN[b.id];
      return `${esc(b.name.en)}: ${b.stations.length} stops, ${km.toFixed(1)} km, ~${fmtMin(sec)}${official ? ` (official: ${official} min)` : ''}`;
    });
    $('lineSummary').innerHTML =
      `<b>${count}</b> stations (expected ${EXPECTED_STATIONS[line.id]}) · ${esc(line.operator)}<br>${parts.join('<br>')}`;
  }

  function renderProgress() {
    const total = state.metro.stations.length;
    const done = state.metro.stations.filter(isVerified).length;
    $('verifiedCount').textContent = done;
    $('totalCount').textContent = total;
    $('progressFill').style.width = `${(done / total) * 100}%`;
  }

  function neighborsOf(s) {
    const out = [];
    for (const line of state.metro.lines) {
      for (const b of line.branches) {
        for (const seg of b.segments) {
          if (seg.from === s.id) out.push({ other: seg.to, seg, line, dir: 'next' });
          if (seg.to === s.id) out.push({ other: seg.from, seg, line, dir: 'prev' });
        }
      }
    }
    const seen = new Set();
    return out.filter((n) => {
      const k = n.other + n.line.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function xrow(label, en, ar, ourEn, ourAr) {
    const dEn =
      en && ourEn && norm(en).replace(/[^a-z0-9]/g, '') !== norm(ourEn).replace(/[^a-z0-9]/g, '');
    const dAr = ar && ourAr && norm(ar).replace(/\s/g, '') !== norm(ourAr).replace(/\s/g, '');
    return `<tr><th>${label}</th><td class="${dEn ? 'diff' : ''}">${esc(en ?? '—')}</td><td class="ar ${dAr ? 'diff' : ''}">${esc(ar ?? '—')}</td></tr>`;
  }

  function renderDetail() {
    const el = $('detail');
    const s = state.selected && stationById(state.selected);
    if (!s) return;
    const v = vOf(s);
    const c = state.cross.get(s.id);
    const flags = flagsOf(s);
    const nbrs = neighborsOf(s);
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;
    el.innerHTML = `
      <h2>${esc(s.name.en)}</h2>
      <div class="ar-title">${esc(s.name.ar)}</div>
      <div class="sub">id: ${esc(s.id)} · ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</div>
      <div class="pills">${lineIdsOf(s)
        .map(
          (l) =>
            `<span class="pill" style="background:${lineById(l).colour}">${esc(lineById(l).name.en)}</span>`,
        )
        .join(
          '',
        )}${s.interchange ? `<span class="pill" style="background:#111827">Transfer ~${Math.round(s.transferSec / 60)} min</span>` : ''}</div>

      <section>
        <div class="card">
          <button id="btnVerify" class="btn ${v.verified ? 'ok' : 'primary'}" style="width:100%">
            ${v.verified ? '✓ Verified (click to undo)' : 'Mark as verified'} <kbd>V</kbd>
          </button>
          <label class="field" style="margin-top:10px">Review comment
            <textarea id="comment" placeholder="Anything wrong or worth remembering…">${esc(v.comment ?? '')}</textarea>
          </label>
          ${v.verifiedAt ? `<div class="hint">Verified ${esc(new Date(v.verifiedAt).toLocaleString())}</div>` : ''}
        </div>
      </section>

      <section>
        <h3>Names (corrections)</h3>
        <div class="card">
          <div class="grid2">
            <label class="field">English<input id="nameEn" value="${esc(v.name?.en ?? s.name.en)}" /></label>
            <label class="field">Arabic<input id="nameAr" class="rtl" value="${esc(v.name?.ar ?? s.name.ar)}" /></label>
          </div>
          <div class="hint">Edits are saved to verification.json and applied by <code>npm run data:build</code>.</div>
        </div>
      </section>

      ${
        flags.length
          ? `<section><h3>Cross-check flags</h3>${flags.map((f) => `<span class="flag">⚑ ${esc(FLAG_TEXT[f] ?? f)}</span>`).join('')}</section>`
          : ''
      }

      <section>
        <h3>Source comparison</h3>
        <table class="xcheck">
          <tr><th></th><th>English</th><th>Arabic</th></tr>
          ${xrow('Ours', s.name.en, s.name.ar, s.name.en, s.name.ar)}
          ${xrow('OSM', c?.osmEn?.join(' / ') || null, c?.osmAr?.join(' / ') || null, s.name.en, s.name.ar)}
          ${xrow('Wikidata', c?.wikidataEn, null, s.name.en, s.name.ar)}
          ${xrow('Wikipedia', null, c?.wikipediaAr, s.name.en, s.name.ar)}
        </table>
        <div class="hint">Coordinate offset vs Wikidata: <b>${c?.coordDistanceM ?? '?'} m</b></div>
        ${s.aliases.length ? `<div class="hint">Aliases: ${s.aliases.map(esc).join(' · ')}</div>` : ''}
      </section>

      <section>
        <h3>Neighbours</h3>
        <div class="neighbors">
          ${nbrs
            .map(
              (n) => `<div class="neighbor" data-id="${n.other}">
                <span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${n.line.colour};margin-right:6px"></i>${n.dir === 'next' ? '→' : '←'} ${esc(stationById(n.other).name.en)}</span>
                <span>${n.seg.distanceM} m · ~${n.seg.rideSec}s</span></div>`,
            )
            .join('')}
        </div>
      </section>

      <section>
        <h3>Open elsewhere</h3>
        <div class="links">
          <a href="${gmaps}" target="_blank" rel="noopener">Google Maps</a>
          ${s.osmNodeIds.map((id) => `<a href="https://www.openstreetmap.org/node/${id}" target="_blank" rel="noopener">OSM ${id}</a>`).join('')}
          ${s.wikidata ? `<a href="https://www.wikidata.org/wiki/${s.wikidata}" target="_blank" rel="noopener">Wikidata ${s.wikidata}</a>` : ''}
        </div>
      </section>

      ${s.notes.length ? `<section><h3>Notes</h3>${s.notes.map((n) => `<span class="flag">${esc(n)}</span>`).join('')}</section>` : ''}
    `;
    $('btnVerify').onclick = toggleVerify;
    $('comment').oninput = (e) => patchStation(s, { comment: e.target.value });
    const onName = () => {
      const en = $('nameEn').value.trim();
      const ar = $('nameAr').value.trim();
      const changed = en !== s.name.en || ar !== s.name.ar;
      patchStation(s, { name: changed ? { en, ar } : undefined });
    };
    $('nameEn').oninput = onName;
    $('nameAr').oninput = onName;
    el.querySelectorAll('.neighbor').forEach((n) => (n.onclick = () => select(n.dataset.id)));
  }

  function patchStation(s, patch) {
    const next = { ...(state.verification.stations[s.wikidata] ?? {}), ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
    if (Object.keys(next).length) state.verification.stations[s.wikidata] = next;
    else delete state.verification.stations[s.wikidata];
    scheduleSave();
  }

  function toggleVerify() {
    const s = stationById(state.selected);
    if (!s) return;
    const now = !isVerified(s);
    patchStation(s, {
      verified: now || undefined,
      verifiedAt: now ? new Date().toISOString() : undefined,
    });
    render({ keepDetailFocus: false });
  }

  function setSaveState(text, cls = '') {
    const el = $('saveState');
    el.textContent = text;
    el.className = `save-state ${cls}`;
  }

  function scheduleSave() {
    setSaveState('Unsaved changes…', 'dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/verification', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.verification),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveState('Saved');
      } catch (err) {
        setSaveState(`Save failed: ${err.message}`, 'error');
      }
    }, 500);
  }

  function select(id, { pan = true } = {}) {
    state.selected = id;
    const s = stationById(id);
    if (pan) map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    renderList();
    renderDetail();
    styleMarkers();
    document.querySelector('.station.selected')?.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    document
      .querySelectorAll('.tab')
      .forEach((t) => t.classList.toggle('active', t.dataset.line === state.line));
    document
      .querySelectorAll('#statusFilter .chip')
      .forEach((c) => c.classList.toggle('active', c.dataset.filter === state.filter));
    renderSummary();
    renderList();
    renderProgress();
    if (state.selected) renderDetail();
    styleMarkers();
  }

  function fitLine() {
    const pts = state.metro.stations
      .filter((s) => state.line === 'ALL' || s.lines.some((l) => l.line === state.line))
      .map((s) => [s.lat, s.lng]);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40] });
  }

  function bindEvents() {
    $('lineTabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      state.line = t.dataset.line;
      render();
      fitLine();
    });
    $('statusFilter').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      state.filter = c.dataset.filter;
      render();
    });
    $('search').addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
    });
    $('stationList').addEventListener('click', (e) => {
      const li = e.target.closest('.station');
      if (li) select(li.dataset.id);
    });
    $('btnExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.verification, null, 2)], {
        type: 'application/json',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'verification.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') toggleVerify();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const ids = state.visibleIds;
        const i = ids.indexOf(state.selected);
        const next =
          ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next) select(next);
      }
    });
    fitLine();
  }

  init();
})();
