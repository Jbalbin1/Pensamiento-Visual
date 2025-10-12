// js/burbujas.js
// Grilla: 1 burbuja por región, ordenadas por satisfacción (desc).
// Color usa la misma escala global que el mapa (window.Scales.color).
// Muestra dentro: VIF % y Delitos %.

(function () {
  const DATA_URL = 'data/series.json'; // ajusta si tu JSON está en otra ruta
  const svg = d3.select('#gridSvg');

  if (svg.empty()) return;
    svg.attr('viewBox', '0 0 1200 800');
    svg.attr('preserveAspectRatio', 'xMidYMid meet');


  const fmtPct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '—');

  function logWhereFetching() {
    try { console.log('burbujas.js → fetching:', new URL(DATA_URL, location.href).href); }
    catch { console.log('burbujas.js → fetching:', DATA_URL); }
  }

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
      window.Scales.color = color;
    }
  }
    function computeLayout(n, width, height) {
    // columnas por ancho disponible (desktop/tablet/móvil)
        let cols;
        if (width >= 1100) cols = 6;
        else if (width >= 900) cols = 5;
        else if (width >= 700) cols = 4;
        else if (width >= 520) cols = 3;
        else cols = 2;

        const rows = Math.ceil(n / cols);

        // padding alrededor y separación entre celdas
        const padX = 60, padY = 60;
        const gapX = 28, gapY = 28;

        const innerW = width - padX * 2 - gapX * (cols - 1);
        const innerH = height - padY * 2 - gapY * (rows - 1);

        const cellW = innerW / cols;
        const cellH = innerH / rows;

        // radio grande pero con margen (no tocar textos)
        const r = Math.max(28, Math.min(cellW, cellH) * 0.45);

        const centers = Array.from({ length: n }, (_, i) => {
            const c = i % cols;
            const rIdx = Math.floor(i / cols);
            const x = padX + c * (cellW + gapX) + cellW / 2;
            const y = padY + rIdx * (cellH + gapY) + cellH / 2;
            return [x, y];
    });

    // (debug opcional)
    console.log(`layout → n=${n}, cols=${cols}, rows=${rows}, r=${r.toFixed(1)}`);
    return { centers, r };
    }




    function renderGrid(year, rows) {
    svg.selectAll('g.grid-root').remove();

    const data = [...rows].sort((a, b) => d3.descending(a.satisfaccion, b.satisfaccion));
    console.log('burbujas.js → renderGrid year:', year, 'rows:', data.length);

    if (!data.length) {
        svg.append('text')
        .attr('x', 20).attr('y', 30)
        .attr('fill', '#f6a')
        .attr('font-size', 18)
        .text('Sin filas para el año seleccionado.');
        return;
    }

  if (!data.length) {
    svg.append('text')
      .attr('x', 20).attr('y', 30)
      .attr('fill', '#f6a')
      .attr('font-size', 18)
      .text('Sin filas para el año seleccionado.');
    return;
  }

    let vb = svg.attr('viewBox');
    let W = 900, H = 600;
    if (vb) {
      const parts = vb.split(/\s+/).map(Number);
      if (parts.length === 4) { W = parts[2]; H = parts[3]; }
    } else {
      svg.attr('viewBox', `0 0 ${W} ${H}`);
    }

    const { centers, r } = computeLayout(data.length, W, H);
    const gRoot = svg.append('g').attr('class', 'grid-root');

    const gCells = gRoot.selectAll('g.cell')
      .data(data, d => d.region)
      .join((enter) => {
        const g = enter.append('g')
          .attr('class', 'cell')
          .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

        g.append('circle')
          .attr('r', 0)
          .attr('fill', d => (window.Scales?.color ? window.Scales.color(d.satisfaccion) : '#3a4366'))
          .attr('stroke', '#233055')
          .attr('stroke-width', 2)
          .transition().duration(500)
          .attr('r', r);

        g.append('text')
            .attr('class', 'lbl-region')
            .attr('text-anchor', 'middle')
            .attr('y', -r - 10)
            .attr('fill', '#cbd6ff')
            .attr('font-size', Math.min(14, Math.max(10, r * 0.30))) // tope 14px
            .text(d => d.region);
            
        const t = g.append('text')
            .attr('class', 'lbl-valores')
            .attr('text-anchor', 'middle')
            .attr('fill', '#eef3ff')
            .attr('font-weight', 700)
            .attr('font-size', Math.min(16, Math.max(11, r * 0.38))); // tope 16px

            t.append('tspan').attr('x', 0).attr('dy', '-0.2em').text(d => `VIF ${fmtPct(d.vif)}`);
            t.append('tspan').attr('x', 0).attr('dy', '1.4em').text(d => `Del ${fmtPct(d.delitos)}`);


        return g;
      });

    // update posiciones/tamaños por si cambia el año
    gCells.transition().duration(600)
      .attr('transform', (_, i) => `translate(${centers[i][0]},${centers[i][1]})`);

    gCells.select('circle').transition().duration(600)
      .attr('r', r)
      .attr('fill', d => (window.Scales?.color ? window.Scales.color(d.satisfaccion) : '#3a4366'));

    gCells.select('text.lbl-region')
        .attr('y', -r - 10)
        .attr('font-size', Math.min(14, Math.max(10, r * 0.30)));

    gCells.select('text.lbl-valores')
        .attr('font-size', Math.min(16, Math.max(11, r * 0.38)));

  }

    async function getData() {
        // 🔧 usa inline sólo si existe y es válido
        if (window.serieData && window.serieData.rows) {
            console.info('burbujas.js → usando window.serieData inline');
            return window.serieData;
        }
        // si no, fetch
        logWhereFetching();
        const r = await fetch(DATA_URL);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    }

  async function loadAndInit() {
    try {
      const data = await getData();
      await ensureScales(data);

      // poblar selector de año
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
      const rows = data.rows[String(year)] || [];
      renderGrid(year, rows);

      if (window.MapChile && typeof window.MapChile.colorize === 'function') {
        window.MapChile.colorize(year, rows);
      }

      if (sel) {
        sel.addEventListener('change', () => {
          const y = Number(sel.value);
          const rws = data.rows[String(y)] || [];
          renderGrid(y, rws);
          if (window.MapChile && typeof window.MapChile.colorize === 'function') {
            window.MapChile.colorize(y, rws);
          }
        });
      }

      window.BubblesGrid = { update: (y) => {
        const rws = data.rows[String(y)] || [];
        renderGrid(y, rws);
      } };

    } catch (err) {
      console.error('burbujas.js → No se pudo cargar los datos:', err);
      svg.append('text')
        .attr('x', 20).attr('y', 30)
        .attr('fill', '#f66')
        .text('No se pudo cargar data/series.json (ver consola).');
    }
  }

  loadAndInit();
})();
