// js/burbujas.js
// Burbujas en grilla serpenteante (zig-zag):
// - Color = satisfacción (escala global window.Scales.color)
// - Tamaño = VIF (radio proporcional, con mínimo para que no queden chicos)
// - Leyenda de color + leyenda de tamaño abajo a la izquierda

(function () {
  const DATA_URL = 'data/series.json';

  // usa #gridSvg (tu nuevo id). Si no existiera, intenta #bubbleSvg.
  let svg = d3.select('#gridSvg');
  if (svg.empty()) svg = d3.select('#bubbleSvg');
  if (svg.empty()) return;

  // Lienzo amplio (ajusta si quieres más/menos área)
  const VIEW_W = 2500, VIEW_H = 1500;
  svg.attr('viewBox', '0 0 3800 2000')
     .attr('preserveAspectRatio', 'xMidYMid meet');

  const fmtPct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '—');

  // ===== Escala de color compartida con el mapa =====
  async function ensureScales(data) {
    if (!window.Scales) window.Scales = {};
    if (!window.Scales.satDomain || !window.Scales.color) {
      const all = Object.values(data.rows).flat();
      const sats = all.map(d => d.satisfaccion).filter(Number.isFinite);
      const minSat = Math.min(...sats);
      const maxSat = Math.max(...sats);
      const domain = [Math.floor(minSat), Math.ceil(maxSat)];

      const color = d3.scaleLinear()
        .domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]])
        .range(['#263363', '#3b56a8', '#8fb4ff']);

      window.Scales.satDomain = domain;
      window.Scales.color    = color;
    }
  }

  // ===== Layout serpenteante (zig-zag) =====
  function computeLayoutSnake(n, width, height) {
    // columnas según ancho (ajusta si quieres fijo)
    let cols;
    if (width >= 1800) cols = 8;
    else if (width >= 1400) cols = 7;
    else if (width >= 1100) cols = 6;
    else if (width >= 900)  cols = 5;
    else if (width >= 700)  cols = 4;
    else if (width >= 520)  cols = 3;
    else cols = 2;

    const rows = Math.ceil(n / cols);

    // márgenes y separación entre celdas (un poco mayor por radios variables)
    const padX = 150, padY = 150;
    const gapX = 100, gapY = 110;

    const innerW = width  - padX * 2 - gapX * (cols - 1);
    const innerH = height - padY * 2 - gapY * (rows - 1);

    const cellW = innerW / cols;
    const cellH = innerH / rows;

    // radio base (se usará para construir la escala de tamaño)
    const rBase = Math.max(34, Math.min(cellW, cellH) * 0.48);

    const centers = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colIndex = row % 2 === 0 ? col : (cols - 1 - col); // zig-zag
      const x = padX + colIndex * (cellW + gapX) + cellW / 2;
      const y = padY + row      * (cellH + gapY) + cellH / 2;
      centers.push([x, y]);
    }
    return { centers, rBase, cols, rows, padX, padY, gapX, gapY, cellW, cellH };
  }

  // ===== Leyenda de color (abajo-izquierda) =====
  function drawColorLegend(svg, W, H) {
    svg.select('#gridLegendColor').remove();

    const color  = window.Scales?.color;
    const domain = window.Scales?.satDomain || [70, 85];
    if (!color) return;

    const legendW = 560, legendH = 26;
    const x = 70;              // bien a la izquierda
    const y = H - 90;          // cerca del borde inferior

    const legend = svg.append('g')
      .attr('id', 'gridLegendColor')
      .attr('transform', `translate(${x},${y})`);

    // gradiente
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'gridLegendGrad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');

    const [minSat, maxSat] = domain;
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      grad.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color(minSat + t * (maxSat - minSat)));
    }

    legend.append('rect')
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', 'url(#gridLegendGrad)')
      .attr('stroke', '#233055')
      .attr('stroke-width', 1.6);

    const scale = d3.scaleLinear().domain(domain).range([0, legendW]);
    const axis  = d3.axisBottom(scale).ticks(6).tickFormat(d => d.toFixed(1) + '%');

    legend.append('g')
      .attr('transform', `translate(0, ${legendH})`)
      .call(axis)
      .selectAll('text')
      .attr('fill', '#cbd6ff')
      .attr('font-size', 18);

    legend.append('text')
      .attr('x', 0)
      .attr('y', -14)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 20)
      .attr('font-weight', 700)
      .text('Satisfacción de la vida (%)');

    // Devuelve x final para colocar la leyenda de tamaño "al lado"
    return { xEnd: x + legendW };
  }

  // ===== Leyenda de tamaño (VIF) a la derecha de la de color =====
  function drawSizeLegend(svg, W, H, rMin, rMax, vMin, vMax, xStartRightOfColor) {
    svg.select('#gridLegendSize').remove();

    // posición: a la derecha de la leyenda de color, misma línea base
    const x = xStartRightOfColor + 60;
    const y = H - 90; // mismo y que color

    const g = svg.append('g')
      .attr('id', 'gridLegendSize')
      .attr('transform', `translate(${x},${y})`);

    // título
    g.append('text')
      .attr('x', 0)
      .attr('y', -14)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 20)
      .attr('font-weight', 700)
      .text('Tamaño = VIF');

    // dibujamos dos círculos de ejemplo (mín y máx)
    const cy = 12 + rMax; // suficiente espacio arriba
    const gap = 40 + rMax; // separación horizontal

    const midColor = window.Scales?.color ? window.Scales.color((window.Scales.satDomain[0] + window.Scales.satDomain[1]) / 2) : '#3a4366';

    // círculo pequeño (mín VIF)
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', cy)
      .attr('r', rMin)
      .attr('fill', midColor)
      .attr('stroke', '#233055')
      .attr('stroke-width', 2);

    g.append('text')
      .attr('x', rMin + 12)
      .attr('y', cy + 6)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 18)
      .text(`VIF bajo (${fmtPct(vMin)})`);

    // círculo grande (máx VIF)
    const x2 = gap + rMax * 2; // deja espacio suficiente
    g.append('circle')
      .attr('cx', x2)
      .attr('cy', cy)
      .attr('r', rMax)
      .attr('fill', midColor)
      .attr('stroke', '#233055')
      .attr('stroke-width', 2);

    g.append('text')
      .attr('x', x2 + rMax + 12)
      .attr('y', cy + 6)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 18)
      .text(`VIF alto (${fmtPct(vMax)})`);
  }

  // ===== Render =====
  function renderGrid(year, rows) {
    svg.selectAll('g.grid-root').remove();

    const data = [...rows].sort((a, b) => d3.descending(a.satisfaccion, b.satisfaccion));
    if (!data.length) {
      svg.append('text')
        .attr('x', 20).attr('y', 30)
        .attr('fill', '#f6a')
        .attr('font-size', 18)
        .text('Sin filas para el año seleccionado.');
      return;
    }

    // dimensiones del viewBox
    let vb = svg.attr('viewBox');
    let W = VIEW_W, H = VIEW_H;
    if (vb) {
      const p = vb.split(/\s+/).map(Number);
      if (p.length === 4) { W = p[2]; H = p[3]; }
    }

    // Layout (centros + rBase)
    const { centers, rBase } = computeLayoutSnake(data.length, W, H);

    // Escala de tamaño por VIF (sqrt = proporcional al área)
    const vifs  = data.map(d => d.vif).filter(Number.isFinite);
    const vMin  = d3.min(vifs);
    const vMax  = d3.max(vifs);

    // Asegura radios legibles: mínimo nunca < 26, máximo al menos 10px más que el mínimo
    const rMin = Math.max(26, rBase * 0.70);
    const rMax = Math.max(rMin + 10, rBase * 1.30);
    const rScale = d3.scaleSqrt().domain([vMin, vMax]).range([rMin, rMax]);

    // Leyendas
    const { xEnd } = drawColorLegend(svg, W, H);
    drawSizeLegend(svg, W, H, rMin, rMax, vMin, vMax, xEnd);

    // Dibujo
    const gRoot = svg.append('g').attr('class', 'grid-root');

    const gCells = gRoot.selectAll('g.cell')
      .data(data, d => d.region)
      .join(enter => {
        const g = enter.append('g')
          .attr('class', 'cell')
          .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

        // BURBUJA (radio según VIF, color según satisfacción)
        g.append('circle')
          .attr('r', 0)
          .attr('fill', d => (window.Scales?.color ? window.Scales.color(d.satisfaccion) : '#3a4366'))
          .attr('stroke', '#233055')
          .attr('stroke-width', 2)
          .transition().duration(600)
          .attr('r', d => rScale(d.vif));

        // NOMBRE REGIÓN (encima del círculo, ajustado por radio)
        g.append('text')
          .attr('class', 'lbl-region')
          .attr('text-anchor', 'middle')
          .attr('y', d => -rScale(d.vif) - 12)
          .attr('fill', '#cbd6ff')
          .attr('font-size', d => Math.min(16, Math.max(10, rScale(d.vif) * 0.32)))
          .text(d => d.region);

        // VALORES DENTRO
        const t = g.append('text')
          .attr('class', 'lbl-valores')
          .attr('text-anchor', 'middle')
          .attr('fill', '#eef3ff')
          .attr('font-weight', 700)
          .attr('font-size', d => Math.min(18, Math.max(11, rScale(d.vif) * 0.38)));

        t.append('tspan').attr('x', 0).attr('dy', '-0.2em').text(d => `VIF ${fmtPct(d.vif)}`);
        t.append('tspan').attr('x', 0).attr('dy', '1.4em').text(d => `Del ${fmtPct(d.delitos)}`);
        return g;
      });

    // Update suave al cambiar de año
    gCells.transition().duration(600)
      .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

    gCells.select('circle').transition().duration(600)
      .attr('r', d => rScale(d.vif))
      .attr('fill', d => (window.Scales?.color ? window.Scales.color(d.satisfaccion) : '#3a4366'));

    gCells.select('text.lbl-region')
      .attr('y', d => -rScale(d.vif) - 12)
      .attr('font-size', d => Math.min(16, Math.max(10, rScale(d.vif) * 0.32)));

    gCells.select('text.lbl-valores')
      .attr('font-size', d => Math.min(18, Math.max(11, rScale(d.vif) * 0.38)));
  }

  // ===== Datos =====
  async function getData() {
    if (window.serieData && window.serieData.rows) return window.serieData;
    const r = await fetch(DATA_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ===== Init =====
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

      const year = sel ? (Number(sel.value) || data.years[0]) : data.years[0];
      renderGrid(year, data.rows[String(year)] || []);

      if (sel) {
        sel.addEventListener('change', () => {
          const y = Number(sel.value);
          renderGrid(y, data.rows[String(y)] || []);
        });
      }
    } catch (err) {
      console.error('burbujas.js → Error:', err);
      svg.append('text')
        .attr('x', 20).attr('y', 30)
        .attr('fill', '#f66')
        .attr('font-size', 16)
        .text('No se pudo cargar data/series.json');
    }
  }

  loadAndInit();
})();
