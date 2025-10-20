// js/burbujas.js
// Grilla serpenteante (2 filas, ancho completo, sin scroll)
(function () {
  const DATA_URL = 'data/series.json';
  const LEGEND_GAP_X = 200; 
  const svg = d3.select('#gridSvg');
  if (svg.empty()) return;
  function isCompareMode(){
    const sel = document.getElementById('yearSel');
    return sel && sel.value === 'compare';
  }

  // ===== Estado =====
  let currentYear = null;
  let currentSort = 'sat'; // 'sat' | 'vif' | 'del'
  let dataset = null;      // guardamos la data para re-render

  // ===== Formateador chileno: 12,34 % =====
  const nfPctES = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  // Acepta valores en fracción (0.008) o ya en porcentaje (0.80)
  const fmtPct = x => {
    if (!Number.isFinite(x)) return '—';
    const val = (x > 1 ? x : x * 100);
    return nfPctES.format(val) + ' %';
  };
  // VIF: ya viene en porcentaje (0.80 => 0.80 %)
  const fmtPctVIF = x => Number.isFinite(x) ? nfPctES.format(x) + ' %' : '—';

  // ===== Tooltip flotante para las burbujas (hover) =====
  function ensureBubbleTooltip() {
    let tip = document.getElementById('bubblesTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'bubblesTooltip';
      tip.className = 'bubbles-tooltip';
      Object.assign(tip.style, {
        position: 'fixed',             // pegado al viewport
        zIndex: '100000',              // por encima de todo
        pointerEvents: 'none',
        opacity: 0,
        visibility: 'hidden',
        background: 'rgba(17,22,42,.95)',
        color: '#eef3ff',
        border: '1px solid #3b4a7a',
        borderRadius: '12px',
        padding: '10px 12px',
        fontSize: '16px',
        lineHeight: '1.35',
        boxShadow: '0 10px 24px rgba(0,0,0,.42)',
        transform: 'translate(0, 0)',
        transition: 'opacity .15s ease'
      });
      document.body.appendChild(tip);
    }
    return tip;
  }

  // --------- Escalas (colores para satisfacción) SOLO de burbujas ----------
  async function ensureScales(data) {
    if (!window.ScalesBurbujas) window.ScalesBurbujas = {};

    // Colores vivos: rosado -> violeta -> cian (bajo -> medio -> alto)
    const css = getComputedStyle(document.documentElement);
    const cPink   = (css.getPropertyValue('--pink2') || '#ff3f8e').trim();
    const cViolet = '#8a6bff';
    const cCyan   = '#21c4ff';

    const all  = Object.values(data.rows).flat();
    const sats = all.map(d => d.satisfaccion).filter(Number.isFinite);
    const minSat = Math.min(...sats), maxSat = Math.max(...sats);
    const domain = [Math.floor(minSat), Math.ceil(maxSat)];
    window.ScalesBurbujas.satDomain = domain;

    window.ScalesBurbujas.color = d3.scaleLinear()
      .domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]])
      .range([cPink, cViolet, cCyan])
      .interpolate(d3.interpolateRgb.gamma(2.2));
  }

  // --------- UI: contenedor de controles (reutilizable) ----------
  function ensureControlsHost() {
    const host = document.querySelector('#BurbujasGrilla');
    if (!host) return null;

    // si ya existe un wrapper de controles, úsalo
    let wrap = host.querySelector('.controls-burbujas');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'controls controls-burbujas';
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'wrap';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '16px';
      wrap.style.margin = '8px 14px 0';
      host.appendChild(wrap);
    }
    return wrap;
  }

  // --------- UI: Select "Orden de las burbujas" ----------
  function ensureSortControl() {
    const wrap = ensureControlsHost();
    if (!wrap || wrap.querySelector('#bubbleOrderSel')) return;

    const label = document.createElement('label');
    label.setAttribute('for', 'bubbleOrderSel');
    label.textContent = 'Orden de las burbujas: ';

    const sel = document.createElement('select');
    sel.id = 'bubbleOrderSel';

    [
      { v: 'sat', t: 'Satisfacción de la vida' },
      { v: 'vif', t: 'Violencia Intrafamiliar' },
      { v: 'del', t: 'Delitos' }
    ].forEach(optData => {
      const opt = document.createElement('option');
      opt.value = optData.v;
      opt.textContent = optData.t;
      sel.appendChild(opt);
    });

    sel.value = currentSort;
    // estado inicial del panel de burbujas
    const bubblesPanel = document.querySelector('.panel-bubbles');
    if (isCompareMode()) {
      bubblesPanel?.setAttribute('hidden', '');
      svg.selectAll('*').remove();
    } else {
      bubblesPanel?.removeAttribute('hidden');
    }

    sel.addEventListener('change', () => {
      currentSort = sel.value;
      if (currentYear != null && dataset) {
        renderGrid(currentYear, dataset.rows[String(currentYear)] || []);
      }
    });

    wrap.appendChild(label);
    wrap.appendChild(sel);
  }

  // --------- UI: Select "Año" exclusivo para burbujas (debajo del anterior) ----------
  function ensureYearControl(data) {
    const wrap = document.querySelector('#BurbujasGrilla .controls-burbujas');
    if (!wrap) return;

    // si ya existe, solo sincroniza
    let sel = wrap.querySelector('#bubbleYearSel');
    if (sel) {
      if (currentYear != null) sel.value = String(currentYear);
      return;
    }

    // salto de línea para que quede ABAJO del selector anterior
    const br = document.createElement('div');
    br.style.flexBasis = '100%';
    br.style.height = '0';
    br.style.margin = '0';
    wrap.appendChild(br);

    // label + select de año
    const label = document.createElement('label');
    label.setAttribute('for', 'bubbleYearSel');
    label.textContent = 'Año: ';

    sel = document.createElement('select');
    sel.id = 'bubbleYearSel';

    (Array.isArray(data.years) ? data.years : []).forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      currentYear = Number(sel.value);
      renderGrid(currentYear, data.rows[String(currentYear)] || []);

      // (opcional) sincroniza el selector global si lo usas
      const globalYearSel = document.getElementById('yearSel');
      if (globalYearSel) globalYearSel.value = String(currentYear);
    });

    // lo agregamos AL FINAL para que quede después del selector de orden
    wrap.appendChild(label);
    wrap.appendChild(sel);

    // valor inicial
    if (currentYear != null) sel.value = String(currentYear);
  }

  // --------- Leyenda de color (satisfacción) ----------
  function drawColorLegend(svg, W, H) {
    svg.select('#gridLegendColor').remove();
    const color  = window.ScalesBurbujas?.color;
    const domain = window.ScalesBurbujas?.satDomain || [70, 85];
    if (!color) return { xEnd: 0 };

    const legendW = 560, legendH = 26, x = 70, y = H - 10; // ↓ más abajo (más lejos de burbujas)
    const legend = svg.append('g')
      .attr('id', 'gridLegendColor')
      .attr('transform', `translate(${x},${y})`);

    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'gridLegendGrad')
      .attr('x1', '0%').attr('x2', '100%');

    const [minSat, maxSat] = domain;
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      grad.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color(minSat + t * (maxSat - minSat)));
    }

    legend.append('rect')
      .attr('width', legendW).attr('height', legendH)
      .attr('rx', 6).attr('fill', 'url(#gridLegendGrad)')
      .attr('stroke', '#233055').attr('stroke-width', 1.6);

    const scale = d3.scaleLinear().domain(domain).range([0, legendW]);
    const axis = d3.axisBottom(scale).ticks(6).tickFormat(d => d.toFixed(1) + '%');
    legend.append('g')
      .attr('transform', `translate(0,${legendH})`)
      .call(axis)
      .selectAll('text').attr('fill', '#cbd6ff').attr('font-size', 18);

    legend.append('text')
      .attr('x', 0).attr('y', -16)
      .attr('fill', '#cbd6ff').attr('font-size', 32)   // ↑ título más grande
      .attr('font-weight', 900)
      .text('Satisfacción de la vida (%)');

    return { xEnd: x + legendW };
  }

  // --------- Leyenda de tamaño (VIF) como ANILLOS ----------
  function drawSizeLegend(svg, W, H, rMin, rMax, vMin, vMax, xStartRightOfColor) {
    svg.select('#gridLegendSize').remove();
    const x = xStartRightOfColor + LEGEND_GAP_X; y = H - 10; // ↓ más abajo (más lejos de burbujas)
    const g = svg.append('g')
      .attr('id', 'gridLegendSize')
      .attr('transform', `translate(${x},${y})`);

    g.append('text').attr('x', 0).attr('y', -16)
      .attr('fill', '#cbd6ff').attr('font-size', 32)   // ↑ título más grande
      .attr('font-weight', 900)
      .text('Tamaño = VIF');

    const rSmall = Math.max(24, rMin * 1.25);
    const rLarge = Math.max(44, rMax * 1.25);
    const cy  = 16 + rLarge;
    const gap = 90 + rLarge;

    // Burbuja chica
    g.append('circle').attr('cx', 0).attr('cy', cy).attr('r', rSmall)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.2);

    // Texto en DOS LÍNEAS para la burbuja chica
    const smallLabel = g.append('text')
      .attr('x', rSmall + 14)
      .attr('y', cy - 2)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 18);

    smallLabel.append('tspan')
      .attr('x', rSmall + 14)
      .text('Región con menor');
    smallLabel.append('tspan')
      .attr('x', rSmall + 14)
      .attr('dy', 20)
      .text(`Violencia Intra familiar (${fmtPctVIF(vMin)})`);

    // Burbuja grande
    const x2 = gap + rLarge * 2;
    g.append('circle').attr('cx', x2).attr('cy', cy).attr('r', rLarge)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.2);

    // Texto en DOS LÍNEAS para la burbuja grande
    const largeLabel = g.append('text')
      .attr('x', x2 + rLarge + 14)
      .attr('y', cy - 2)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 18);

    largeLabel.append('tspan')
      .attr('x', x2 + rLarge + 14)
      .text('Región con mayor');
    largeLabel.append('tspan')
      .attr('x', x2 + rLarge + 14)
      .attr('dy', 20)
      .text(`Violencia Intra familiar (${fmtPctVIF(vMax)})`);

    const approxWidth = x2 + rLarge + 200;
    return { xEnd: x + approxWidth };
  }

  // --------- Leyenda de DELITOS (borde = grosor) ----------
  function drawDelitosLegend(svg, W, H, dMin, dMax, xStartRightOfSize, ringColor) {
    svg.select('#gridLegendDelitos').remove();
    const EXTRA_GAP_DELITOS = 120;
    const x = xStartRightOfSize + LEGEND_GAP_X + EXTRA_GAP_DELITOS; y = H - 10;
    const g = svg.append('g')
      .attr('id', 'gridLegendDelitos')
      .attr('transform', `translate(${x},${y})`);

    g.append('text').attr('x', 0).attr('y', -16)
      .attr('fill', '#cbd6ff').attr('font-size', 32)
      .attr('font-weight', 900)
      .text('Borde = Delitos');

    const r = 70;
    const cy = 16 + r;
    const gap = 180;

    const strokeScale = d3.scaleLinear().domain([dMin, dMax]).range([3, 10]);

    g.append('circle')
      .attr('cx', 0).attr('cy', cy).attr('r', r)
      .attr('fill', 'none')
      .attr('stroke', ringColor)
      .attr('stroke-width', strokeScale(dMin));

    g.append('text')
      .attr('x', 0).attr('y', cy + r + 22)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd6ff').attr('font-size', 18)
      .text('Menor cantidad de delitos');

    const x2 = gap + r * 2;
    g.append('circle')
      .attr('cx', x2).attr('cy', cy).attr('r', r)
      .attr('fill', 'none')
      .attr('stroke', ringColor)
      .attr('stroke-width', strokeScale(dMax));

    g.append('text')
      .attr('x', x2).attr('y', cy + r + 22)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd6ff').attr('font-size', 18)
      .text('Mayor cantidad de delitos');
  }

  // --------- Render de la grilla ----------
  function renderGrid(year, rows) {
    if (isCompareMode()) {
      d3.select('#gridSvg').selectAll('*').remove();
      return;
    }
    svg.selectAll('g.grid-root').remove();

    const data = [...rows].sort((a, b) => {
      if (currentSort === 'vif') return d3.descending(a.vif, b.vif);
      if (currentSort === 'del') return d3.descending(a.delitos, b.delitos);
      return d3.descending(a.satisfaccion, b.satisfaccion); // 'sat'
    });

    if (!data.length) {
      svg.append('text').attr('x', 20).attr('y', 30)
        .attr('fill', '#f6a').attr('font-size', 18)
        .text('Sin filas para el año seleccionado.');
      return;
    }

    const rowsCount = 2;
    const cols = Math.ceil(data.length / rowsCount);

    const stageEl = document.querySelector('.panel-bubbles .stage');
    const stageWidth = stageEl
      ? stageEl.getBoundingClientRect().width
      : (svg.node().parentElement?.getBoundingClientRect?.().width || 1200);

    const padX = 24, padY = 40, gapX = 12, gapY = 18;
    const innerW = stageWidth - padX * 2 - gapX * (cols - 1);
    const cellW = innerW / cols;
    const cellH = cellW;

    const centers = [];
    for (let i = 0; i < data.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colIndex = col;
      const x = padX + colIndex * (cellW + gapX) + cellW / 2;
      const y = padY + row * (cellH + gapY) + cellH / 2;
      centers.push([x, y]);
    }

    const realW = padX * 2 + (cols - 1) * (cellW + gapX) + cellW;

    const legendH = 180;
    const realH = padY * 2 + (rowsCount - 1) * (cellH + gapY) + cellH + legendH;

    svg.attr('viewBox', `0 0 ${realW} ${realH}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Escalas de tamaño (VIF) y borde (DELITOS)
    const vifs = data.map(d => d.vif).filter(Number.isFinite);
    const vMin = d3.min(vifs), vMax = d3.max(vifs);
    const rMin = Math.max(16, cellW * 0.18);
    const rMax = Math.max(rMin + 6, cellW * 0.32);
    const rScale = d3.scaleSqrt().domain([vMin, vMax]).range([rMin, rMax]);

    const delitosVals = data.map(d => d.delitos).filter(Number.isFinite);
    const dMin = d3.min(delitosVals), dMax = d3.max(delitosVals);
    const strokeScale = d3.scaleLinear().domain([dMin, dMax]).range([3, 10]);
    const ringColor = '#ffffff';

    const { xEnd: colorEnd } = drawColorLegend(svg, realW, realH - legendH + 20);
    const { xEnd: sizeEnd  } = drawSizeLegend(svg, realW, realH - legendH + 20, rMin, rMax, vMin, vMax, colorEnd);
    drawDelitosLegend(svg, realW, realH - legendH + 20, dMin, dMax, sizeEnd, ringColor);

    const tip = ensureBubbleTooltip();

    const gRoot = svg.append('g').attr('class', 'grid-root');
    gRoot.selectAll('g.cell')
      .data(data, d => d.region)
      .join(enter => {
        const g = enter.append('g')
          .attr('class', 'cell')
          .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

        g.append('circle')
          .attr('class', 'bubble-core')
          .attr('r', 0)
          .attr('fill', d => window.ScalesBurbujas.color(d.satisfaccion))
          .attr('stroke', '#233055')
          .attr('stroke-width', 1.5)
          .transition().duration(600)
          .attr('r', d => rScale(d.vif));

        g.append('circle')
          .attr('class', 'bubble-ring')
          .attr('r', 0)
          .attr('fill', 'none')
          .attr('stroke', ringColor)
          .attr('stroke-width', d => strokeScale(d.delitos))
          .transition().duration(600)
          .attr('r', d => rScale(d.vif));

        g.append('text')
          .attr('class', 'lbl-region')
          .attr('text-anchor', 'middle')
          .attr('y', d => -rScale(d.vif) - 18)
          .attr('fill', '#ffffff')
          .attr('stroke', '#0b1020')
          .attr('stroke-width', 5)
          .attr('paint-order', 'stroke')
          .attr('font-weight', 900)
          .attr('font-size', d => {
            const px = Math.max(56, Math.min(120, rScale(d.vif) * 2.2));
            return px;
          })
          .style('font-size', d => {
            const px = Math.max(56, Math.min(20, rScale(d.vif) * 2.2));
            return px + 'px';
          }, 'important')
          .text(d => d.region);

        g.on('mouseenter', function (event, d) {
            d3.select(this).select('.bubble-core')
              .transition().duration(180)
              .attr('r', rScale(d.vif) * 1.15)
              .attr('stroke-width', 4)
              .attr('stroke', '#ffffff');

            tip.innerHTML = `
              <div style="font-weight:800; font-size:18px; margin-bottom:4px;">
                ${d.region}
              </div>
              <div><strong>Satisfacción:</strong> ${d.satisfaccion.toFixed(1)} %</div>
              <div><strong>VIF:</strong> ${fmtPctVIF(d.vif)}</div>
              <div><strong>Delitos:</strong> ${fmtPct(d.delitos)}</div>
            `;
            tip.style.opacity = '1';
            tip.style.visibility = 'visible';
            tip.style.left = event.clientX + 'px';
            tip.style.top  = event.clientY + 'px';
          })
          .on('mousemove', function (event) {
            tip.style.left = event.clientX + 'px';
            tip.style.top  = event.clientY + 'px';
          })
          .on('mouseleave', function () {
            d3.select(this).select('.bubble-core')
              .transition().duration(180)
              .attr('r', d => rScale(d.vif))
              .attr('stroke-width', 1.5);
            tip.style.opacity = '0';
            tip.style.visibility = 'hidden';
          })
          .style('cursor', 'pointer');

        return g;
      });
  }

  // --------- Data + boot ----------
  async function getData() {
    if (window.serieData && window.serieData.rows) return window.serieData;
    const r = await fetch(DATA_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function loadAndInit() {
    try {
      dataset = await getData();
      await ensureScales(dataset);

      const globalYearSel = document.getElementById('yearSel');
      if (globalYearSel && globalYearSel.options.length === 0 && Array.isArray(dataset.years)) {
        dataset.years.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          globalYearSel.appendChild(opt);
        });
      }
      const initialYear = globalYearSel ? Number(globalYearSel.value) || dataset.years[0] : dataset.years[0];
      currentYear = initialYear;

      ensureSortControl();
      ensureYearControl(dataset);

      if (globalYearSel) {
        globalYearSel.addEventListener('change', () => {
          const bubblesPanel = document.querySelector('.panel-bubbles');

          if (globalYearSel.value === 'compare') {
            bubblesPanel?.setAttribute('hidden', '');
            svg.selectAll('*').remove();
            return;
          }
          bubblesPanel?.removeAttribute('hidden');

          currentYear = Number(globalYearSel.value);
          const bubbleYearSel = document.getElementById('bubbleYearSel');
          if (bubbleYearSel) bubbleYearSel.value = String(currentYear);
          renderGrid(currentYear, dataset.rows[String(currentYear)] || []);
        });
      }

      renderGrid(currentYear, dataset.rows[String(currentYear)] || []);

      const stageEl = document.querySelector('.panel-bubbles .stage');
      if (stageEl) {
        const ro = new ResizeObserver(() => {
          if (currentYear != null) {
            renderGrid(currentYear, dataset.rows[String(currentYear)] || []);
          }
        });
        ro.observe(stageEl);
      }
      window.addEventListener('resize', () => {
        if (currentYear != null) {
          renderGrid(currentYear, dataset.rows[String(currentYear)] || []);
        }
      });

    } catch (err) {
      console.error('burbujas.js → Error:', err);
      svg.append('text').attr('x', 20).attr('y', 30)
        .attr('fill', '#f66').attr('font-size', 16)
        .text('No se pudo cargar data/series.json');
    }
  }

  loadAndInit();
})();
