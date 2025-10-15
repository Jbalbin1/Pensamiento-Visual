// js/burbujas.js
// Grilla serpenteante (2 filas, ancho completo, sin scroll)
(function () {
  const DATA_URL = 'data/series.json';
  const svg = d3.select('#gridSvg');
  if (svg.empty()) return;

  // === NUEVO: recordamos el año actual para poder redibujar al cambiar el ancho
  let currentYear = null;

  const fmtPct = x => Number.isFinite(x) ? Math.round(x * 100) + '%' : '—';

  async function ensureScales(data) {
    if (!window.Scales) window.Scales = {};
    if (!window.Scales.satDomain || !window.Scales.color) {
      const all = Object.values(data.rows).flat();
      const sats = all.map(d => d.satisfaccion).filter(Number.isFinite);
      const minSat = Math.min(...sats), maxSat = Math.max(...sats);
      const domain = [Math.floor(minSat), Math.ceil(maxSat)];
      const color = d3.scaleLinear()
        .domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]])
        .range(['#263363', '#3b56a8', '#8fb4ff']);
      window.Scales = { satDomain: domain, color };
    }
  }

  function drawColorLegend(svg, W, H) {
    svg.select('#gridLegendColor').remove();
    const color = window.Scales?.color;
    const domain = window.Scales?.satDomain || [70, 85];
    if (!color) return;

    const legendW = 560, legendH = 26, x = 70, y = H - 70;
    const legend = svg.append('g').attr('id', 'gridLegendColor').attr('transform', `translate(${x},${y})`);

    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const grad = defs.append('linearGradient').attr('id', 'gridLegendGrad').attr('x1', '0%').attr('x2', '100%');
    const [minSat, maxSat] = domain;
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      grad.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', color(minSat + t * (maxSat - minSat)));
    }

    legend.append('rect')
      .attr('width', legendW).attr('height', legendH)
      .attr('rx', 6).attr('fill', 'url(#gridLegendGrad)')
      .attr('stroke', '#233055').attr('stroke-width', 1.6);

    const scale = d3.scaleLinear().domain(domain).range([0, legendW]);
    const axis = d3.axisBottom(scale).ticks(6).tickFormat(d => d.toFixed(1) + '%');
    legend.append('g').attr('transform', `translate(0,${legendH})`).call(axis)
      .selectAll('text').attr('fill', '#cbd6ff').attr('font-size', 18);

    legend.append('text').attr('x', 0).attr('y', -14)
      .attr('fill', '#cbd6ff').attr('font-size', 20).attr('font-weight', 700)
      .text('Satisfacción de la vida (%)');

    return { xEnd: x + legendW };
  }

  function drawSizeLegend(svg, W, H, rMin, rMax, vMin, vMax, xStartRightOfColor) {
    svg.select('#gridLegendSize').remove();
    const x = xStartRightOfColor + 60, y = H - 70;
    const g = svg.append('g').attr('id', 'gridLegendSize').attr('transform', `translate(${x},${y})`);
    g.append('text').attr('x', 0).attr('y', -14)
      .attr('fill', '#cbd6ff').attr('font-size', 20).attr('font-weight', 700)
      .text('Tamaño = VIF');

    const cy = 12 + rMax, gap = 40 + rMax;
    const midColor = window.Scales?.color ? window.Scales.color((window.Scales.satDomain[0] + window.Scales.satDomain[1]) / 2) : '#3a4366';

    g.append('circle').attr('cx', 0).attr('cy', cy).attr('r', rMin)
      .attr('fill', midColor).attr('stroke', '#233055').attr('stroke-width', 2);
    g.append('text').attr('x', rMin + 12).attr('y', cy + 6)
      .attr('fill', '#cbd6ff').attr('font-size', 18)
      .text(`VIF bajo (${fmtPct(vMin)})`);

    const x2 = gap + rMax * 2;
    g.append('circle').attr('cx', x2).attr('cy', cy).attr('r', rMax)
      .attr('fill', midColor).attr('stroke', '#233055').attr('stroke-width', 2);
    g.append('text').attr('x', x2 + rMax + 12).attr('y', cy + 6)
      .attr('fill', '#cbd6ff').attr('font-size', 18)
      .text(`VIF alto (${fmtPct(vMax)})`);
  }

  function renderGrid(year, rows) {
    svg.selectAll('g.grid-root').remove();
    const data = [...rows].sort((a, b) => d3.descending(a.satisfaccion, b.satisfaccion));
    if (!data.length) {
      svg.append('text').attr('x', 20).attr('y', 30)
        .attr('fill', '#f6a').attr('font-size', 18)
        .text('Sin filas para el año seleccionado.');
      return;
    }

    const rowsCount = 2;
    const cols = Math.ceil(data.length / rowsCount);

    // === CAMBIO: medición de ancho robusta (evita anchos viejos)
    const stageEl = document.querySelector('.panel-bubbles .stage');
    const stageWidth = stageEl
      ? stageEl.getBoundingClientRect().width
      : (svg.node().parentElement?.getBoundingClientRect?.().width || 1200);

    const padX = 20, padY = 10, gapX = 10, gapY = 15;
    const innerW = stageWidth - padX * 2 - gapX * (cols - 1);
    const cellW = innerW / cols;
    const cellH = cellW;

    const centers = [];
    for (let i = 0; i < data.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colIndex = row % 2 === 0 ? col : (cols - 1 - col);
      const x = padX + colIndex * (cellW + gapX) + cellW / 2;
      const y = padY + row * (cellH + gapY) + cellH / 2;
      centers.push([x, y]);
    }

    const realW = padX * 2 + (cols - 1) * (cellW + gapX) + cellW;

    // leyendas al fondo
    const legendH = 90;
    const realH = padY*2 + (rowsCount-1)*(cellH+gapY) + cellH + legendH;

    svg.attr('viewBox', `0 0 ${realW} ${realH}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    const vifs = data.map(d => d.vif).filter(Number.isFinite);
    const vMin = d3.min(vifs), vMax = d3.max(vifs);
    const rMin = Math.max(16, cellW * 0.18);
    const rMax = Math.max(rMin + 6, cellW * 0.32);
    const rScale = d3.scaleSqrt().domain([vMin, vMax]).range([rMin, rMax]);

    const { xEnd } = drawColorLegend(svg, realW, realH - legendH + 20);
    drawSizeLegend(svg, realW, realH - legendH + 20, rMin, rMax, vMin, vMax, xEnd);

    const gRoot = svg.append('g').attr('class', 'grid-root');
    const gCells = gRoot.selectAll('g.cell')
      .data(data, d => d.region)
      .join(enter => {
        const g = enter.append('g')
          .attr('class', 'cell')
          .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

        g.append('circle')
          .attr('r', 0)
          .attr('fill', d => window.Scales.color(d.satisfaccion))
          .attr('stroke', '#233055')
          .attr('stroke-width', 1.5)
          .transition().duration(600)
          .attr('r', d => rScale(d.vif));

        g.append('text')
          .attr('class', 'lbl-region')
          .attr('text-anchor', 'middle')
          .attr('y', d => -rScale(d.vif) - 8)
          .attr('fill', '#cbd6ff')
          .attr('font-size', d => Math.min(13, Math.max(10, rScale(d.vif) * 0.4)))
          .text(d => d.region);

        const t = g.append('text')
          .attr('class', 'lbl-valores')
          .attr('text-anchor', 'middle')
          .attr('fill', '#eef3ff')
          .attr('font-weight', 700)
          .attr('font-size', d => Math.min(14, Math.max(10, rScale(d.vif) * 0.4)));

        t.append('tspan').attr('x', 0).attr('dy', '-0.2em').text(d => `VIF ${fmtPct(d.vif)}`);
        t.append('tspan').attr('x', 0).attr('dy', '1.4em').text(d => `Del ${fmtPct(d.delitos)}`);
        return g;
      });
  }

  async function getData() {
    if (window.serieData && window.serieData.rows) return window.serieData;
    const r = await fetch(DATA_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function loadAndInit() {
    try {
      const data = await getData();
      await ensureScales(data);
      const sel = document.getElementById('yearSel');
      if (sel && sel.options.length === 0 && Array.isArray(data.years)) {
        data.years.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          sel.appendChild(opt);
        });
      }
      const year = sel ? Number(sel.value) || data.years[0] : data.years[0];

      // === NUEVO: guardar año actual
      currentYear = year;

      renderGrid(year, data.rows[String(year)] || []);

      if (sel) {
        sel.addEventListener('change', () => {
          currentYear = Number(sel.value); // === NUEVO: actualiza currentYear
          renderGrid(currentYear, data.rows[sel.value] || []);
        });
      }

      // === NUEVO: redibuja cuando cambie el ancho del contenedor de burbujas
      const stageEl = document.querySelector('.panel-bubbles .stage');
      if (stageEl) {
        const ro = new ResizeObserver(() => {
          if (currentYear != null) {
            renderGrid(currentYear, data.rows[String(currentYear)] || []);
          }
        });
        ro.observe(stageEl);
      }

      // === NUEVO: redibuja también al redimensionar la ventana
      window.addEventListener('resize', () => {
        if (currentYear != null) {
          renderGrid(currentYear, data.rows[String(currentYear)] || []);
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
