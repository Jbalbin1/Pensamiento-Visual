(async function init() {

  // === Datos ===
  const data = await fetch('data/series.json').then(r => r.json());
  const years = (data.years || []).slice().sort((a, b) => a - b);
  const rowsByYear = data.rows || {};
  const delitosCat = data.delitos_estudiados || [];

  // === Escalas compartidas ===
  const allRows = Object.values(rowsByYear).flat();
  const sats = allRows.map(d => d?.satisfaccion).filter(Number.isFinite);
  const minSat = d3.min(sats) ?? 70;
  const maxSat = d3.max(sats) ?? 85;

  window.Scales = {
    satDomain: [minSat, maxSat],
    color: d3.scaleLinear()
      .domain([minSat, maxSat])
      .range([d3.hcl(215, 60, 55), d3.hcl(10, 65, 55)])
      .interpolate(d3.interpolateHcl)
      .clamp(true),
    radius: d3.scaleSqrt().domain([minSat, maxSat]).range([10, 40])
  };

  // === UI refs ===
  const grid = document.querySelector('main.grid');
  const singleStage = document.getElementById('singleStage');
  const compareStage = document.getElementById('compareStage');
  const labelLeft = document.getElementById('labelLeft');
  const labelRight = document.getElementById('labelRight');

  // Detalle (tu mismo panel)
  const detail = document.getElementById('detailBox');
  const titleEl = document.getElementById('detailTitle');
  const satValue = document.getElementById('satValue');
  const vifValue = document.getElementById('vifValue');
  const delValue = document.getElementById('delValue');
  const satRank = document.getElementById('satRank');
  const vifRank = document.getElementById('vifRank');
  const delRank = document.getElementById('delRank');
  const closeBtn = document.getElementById('closeDetail');
  const detailSvg = d3.select('#detailRegionSvg');
  const vifPsico = document.getElementById('vifPsico');
  const vifFisica = document.getElementById('vifFisica');
  const delitosUL = document.getElementById('delitosList');
  delitosUL.innerHTML = ''; (data.delitos_estudiados || []).forEach(t => { const li = document.createElement('li'); li.textContent = t; delitosUL.appendChild(li); });

  // === Selector de año (+ opción comparar) ===
  const yearSel = document.getElementById('yearSel');
  years.forEach(y => { const o = document.createElement('option'); o.value = String(y); o.textContent = String(y); yearSel.appendChild(o); });
  const optCompare = document.createElement('option');
  optCompare.value = 'compare';
  optCompare.textContent = 'Comparar 2021 vs 2023';
  yearSel.appendChild(optCompare);
  yearSel.value = String(years[0]);

  // === Instancias de mapa ===
  // - 1 mapa (modo normal)
  await MapChile.init?.();

  // - 2 mapas (modo comparar), se crean cuando se necesiten
  let mapLeft = null, mapRight = null;
  async function ensureCompareMaps() {
    if (mapLeft && mapRight) return;
    mapLeft = createChileMap('#mapSvgL', '#mapGroupL');
    mapRight = createChileMap('#mapSvgR', '#mapGroupR');
    await Promise.all([mapLeft.init(), mapRight.init()]);
    mapLeft.onRegionClick(handleRegionClick);
    mapRight.onRegionClick(handleRegionClick);
  }

  // Click en mapa único
  MapChile.onRegionClick?.(handleRegionClick);

  // === Burbujas (tu módulo existente) ===
  if (window.Bubbles) Bubbles.init?.();

  // === Refresh según modo ===
  function refresh() {
    const sel = yearSel.value;

    if (sel === 'compare') {
      // mostrar 2 mapas, ocultar 1
      singleStage.hidden = true;
      compareStage.hidden = false;

      // etiquetas (tomo el menor y el mayor del JSON)
      const yL = years[0], yR = years[years.length - 1];
      labelLeft.textContent = yL;
      labelRight.textContent = yR;

      ensureCompareMaps().then(() => {
        mapLeft.colorize(yL, rowsByYear[yL] || []);
        mapRight.colorize(yR, rowsByYear[yR] || []);
      });

      // Las burbujas pueden seguir mostrando un año de referencia (el menor)
      if (window.Bubbles) Bubbles.update?.(yL, rowsByYear[yL] || []);
    } else {
      // modo 1 mapa
      singleStage.hidden = false;
      compareStage.hidden = true;

      const y = +sel;
      MapChile.colorize?.(y, rowsByYear[y] || []);
      if (window.Bubbles) Bubbles.update?.(y, rowsByYear[y] || []);

      // si el detalle está abierto, refrescar KPIs
      if (!detail.hasAttribute('hidden') && detail.dataset.region) {
        const name = detail.dataset.region;
        const row = (rowsByYear[y] || []).find(r => r.region === name);
        if (row) fillDetail(name, row, computeRanks(rowsByYear[y] || []));
      }
    }
  }
  yearSel.addEventListener('change', refresh);
  refresh();

  // ====== Detalle / rankings (se mantienen) ======
  function ordinal(n) { return `${n}.º lugar`; }
  function computeRanks(rows) {
    const bySat = [...rows].sort((a, b) => d3.descending(a.satisfaccion, b.satisfaccion));
    const byDel = [...rows].sort((a, b) => d3.ascending(a.delitos, b.delitos));
    const byVIF = [...rows].sort((a, b) => d3.ascending(a.vif, b.vif));
    const rank = arr => Object.fromEntries(arr.map((d, i) => [d.region, i + 1]));
    return { sat: rank(bySat), del: rank(byDel), vif: rank(byVIF), total: rows.length };
  }
  function fillDetail(name, row, ranks) {
    detail.dataset.region = name;
    titleEl.textContent = `Detalle — ${name}`;
    satValue.textContent = `${row.satisfaccion.toFixed(1)}%`;
    delValue.textContent = `${row.delitos.toFixed(2)}%`;
    vifValue.textContent = `${row.vif.toFixed(2)}%`;
    satRank.textContent = `${ordinal(ranks.sat[name])} en satisfacción`;
    delRank.textContent = `${ordinal(ranks.del[name])} en delitos`;
    vifRank.textContent = `${ordinal(ranks.vif[name])} en VIF`;
    if (Number.isFinite(row.vif_psicologica)) vifPsico.textContent = `${row.vif_psicologica.toFixed(1)}%`;
    if (Number.isFinite(row.vif_fisica)) vifFisica.textContent = `${row.vif_fisica.toFixed(1)}%`;
  }

  function handleRegionClick(name, pathEl) {
    // cuando estás en comparar, abre KPIs usando el año más cercano según selección visual:
    // Oculta el mensaje fijo cuando se hace clic en una región
    document.getElementById('helpMessage')?.classList.add('hidden');
    const sel = yearSel.value;
    const y = (sel === 'compare') ? years[0] : +sel;
    const rows = rowsByYear[y] || [];
    const row = rows.find(r => r.region === name);
    if (!row) return;

    fillDetail(name, row, computeRanks(rows));
    detail.removeAttribute('hidden');
    grid.classList.add('detail-open');

    flyRegion(pathEl, document.getElementById('detailRegionSvg'), row);
  }

  closeBtn?.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeDetail(); });

  function closeDetail() {
    detail.setAttribute('hidden', '');
    grid.classList.remove('detail-open');
    detailSvg.selectAll('*').remove();
    const fly = document.getElementById('flyLayer'); if (fly) fly.remove();
  }

  // ====== animación de “vuelo” (igual que ya tienes) ======
  function flyRegion(sourcePathEl, targetSvgEl, row) {
    d3.select(targetSvgEl).selectAll('*').remove();
    let overlay = document.getElementById('flyLayer');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'flyLayer'; document.body.appendChild(overlay); }
    else overlay.innerHTML = '';

    const dAttr = sourcePathEl.getAttribute('d');
    const fill = window.Scales.color(row.satisfaccion);
    const stroke = getComputedStyle(sourcePathEl).stroke || '#0b1739';

    const flySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const flyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flyPath.setAttribute('class', 'fly-shape');
    flyPath.setAttribute('d', dAttr);
    flyPath.setAttribute('fill', fill);
    flyPath.setAttribute('stroke', stroke);
    flyPath.setAttribute('stroke-width', 1);
    flySvg.appendChild(flyPath);
    overlay.appendChild(flySvg);

    const sb = sourcePathEl.getBoundingClientRect();
    const tb = targetSvgEl.getBoundingClientRect();
    const scale = Math.min((tb.width * 0.82) / sb.width, (tb.height * 0.82) / sb.height);
    const x0 = sb.left + sb.width / 2, y0 = sb.top + sb.height / 2;
    const x1 = tb.left + tb.width / 2, y1 = tb.top + tb.height / 2;

    const start = `translate(${x0}px, ${y0}px) scale(1) translate(${-sb.width / 2}px, ${-sb.height / 2}px)`;
    const end = `translate(${x1}px, ${y1}px) scale(${scale}) translate(${-sb.width / 2}px, ${-sb.height / 2}px)`;

    flyPath.style.opacity = '0.98';
    flyPath.style.transform = start;
    requestAnimationFrame(() => { flyPath.style.transform = end; });

    flyPath.addEventListener('transitionend', () => {
      const d = d3.select(targetSvgEl);
      const g = d.append('g');
      g.append('path').attr('d', dAttr).attr('fill', fill).attr('stroke', stroke).attr('stroke-width', 1);
      const bb = sourcePathEl.getBBox();
      const pad = Math.max(bb.width, bb.height) * 0.1;
      d.attr('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + 2 * pad} ${bb.height + 2 * pad}`);
      overlay.remove();
    }, { once: true });
  }

})();
