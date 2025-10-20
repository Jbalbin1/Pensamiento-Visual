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
  const vifPsico = document.getElementById('vifPsico'); // Ya no se usará directamente
  const vifFisica = document.getElementById('vifFisica'); // Ya no se usará directamente
  const delitosUL = document.getElementById('delitosList');
  delitosUL.innerHTML = ''; (data.delitos_estudiados || []).forEach(t => { const li = document.createElement('li'); li.textContent = t; delitosUL.appendChild(li); });

  // --- NUEVO: Elemento para mostrar el año ---
  const yearDisplay = document.getElementById('detailYear');

  // --- NUEVO: Referencias al SVG del gráfico de torta y a la leyenda ---
  const pieChartSvg = d3.select('#vifPieChart');
  const legendContainer = document.getElementById('vifLegend');

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

      // Al cambiar a modo comparar forzamos un resize interno
  yearSel.addEventListener('change', () => {
    refresh();
    if (yearSel.value === 'compare') {
      // pequeño delay para que el DOM esté listo
      setTimeout(() => {
        ['#mapSvgL', '#mapSvgR'].forEach(sel => {
          const svg = document.querySelector(sel);
          if (!svg) return;
          // fuerza re-cálculo del viewBox
          const vb = svg.getAttribute('viewBox');
          svg.setAttribute('viewBox', '');   // reset
          svg.setAttribute('viewBox', vb);   // reaplica
        });
      }, 60);
    }
  });

  // ====== Detalle / rankings (se mantienen) ======
  function ordinal(n) { return `${n}.º lugar`; }

  // --- MODIFICADO: Función computeRanks para usar la numeración oficial de Chile ---
  function computeRanks(rows) {
    // Definimos el orden oficial de las regiones de Chile (I a XVI)
    const officialOrder = [
      "Arica y Parinacota",     // I
      "Tarapacá",               // II
      "Antofagasta",            // III
      "Atacama",                // IV
      "Coquimbo",               // V
      "Valparaíso",             // VI
      "Metropolitana",          // RM
      "O'Higgins",              // VII
      "Maule",                  // VIII
      "Ñuble",                  // IX
      "Biobío",                 // X
      "Araucanía",              // XI
      "Los Ríos",               // XII
      "Los Lagos",              // XIV
      "Aysén",                  // XV
      "Magallanes"              // XVI
    ];

    // Creamos un objeto que asigna el número oficial a cada región
    const regionNumber = Object.fromEntries(officialOrder.map((name, i) => [name, i + 1]));

    const bySat = [...rows].sort((a, b) => d3.descending(a.satisfaccion, b.satisfaccion));
    const byDel = [...rows].sort((a, b) => d3.ascending(a.delitos, b.delitos));
    const byVIF = [...rows].sort((a, b) => d3.ascending(a.vif, b.vif));

    const rank = arr => Object.fromEntries(arr.map((d, i) => [d.region, i + 1]));
    return {
      sat: rank(bySat),
      del: rank(byDel),
      vif: rank(byVIF),
      total: rows.length,
      number: regionNumber // <-- Nuevo: añadimos el número oficial de región
    };
  }

  // --- NUEVO: Función para dibujar el gráfico de torta ---
  function drawVifPieChart(psico, fisica) {
    // Limpiamos el SVG
    pieChartSvg.selectAll('*').remove();

    // Calculamos el valor de "Otros"
    const otros = 100 - psico - fisica;
    const data = [
      { name: 'Psicológica', value: psico, color: '#FF6B6B' }, // Rojo vibrante (similar a los tonos rosados del título)
      { name: 'Física', value: fisica, color: '#4ECDC4' },     // Turquesa (contraste)
      { name: 'Otros', value: otros, color: '#95A5A6' }        // Gris claro (neutro)
    ].filter(d => d.value > 0); // Solo incluimos categorías con valor > 0

    if (data.length === 0) return; // Si no hay datos, no dibujamos nada

    const width = 180, height = 180;
    const radius = Math.min(width, height) / 2 - 20;

    // Creamos el grupo centralizado
    const g = pieChartSvg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Definimos la escala de colores
    const colorScale = d3.scaleOrdinal()
      .domain(data.map(d => d.name))
      .range(data.map(d => d.color));

    // Definimos el generador de arcos
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.6) // Para hacerlo un donut
      .outerRadius(radius);

    // Dibujamos los arcos
    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(d.data.name))
      .attr('stroke', '#233055')
      .attr('stroke-width', 1);
  }

  // --- NUEVO: Función para actualizar la leyenda ---
  function updateVifLegend(psico, fisica, otros) {
    // Limpiamos la leyenda
    legendContainer.innerHTML = '';

    // Definimos los colores (deben coincidir con los del gráfico)
    const colors = {
      'Psicológica': '#FF6B6B',
      'Física': '#4ECDC4',
      'Otros': '#95A5A6'
    };

    // Creamos los elementos de la leyenda
    const categories = [
      { name: 'Psicológica', value: psico },
      { name: 'Física', value: fisica },
      { name: 'Otros', value: otros }
    ];

    categories.forEach(cat => {
      if (cat.value > 0) {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = colors[cat.name];

        const text = document.createElement('span');
        text.textContent = `${cat.name}: ${cat.value.toFixed(1)}%`;

        item.appendChild(colorBox);
        item.appendChild(text);
        legendContainer.appendChild(item);
      }
    });
  }

  function fillDetail(name, row, ranks) {
    detail.dataset.region = name;
    // --- MODIFICADO: Formato del título con el número oficial ---
    const regionNumber = ranks.number[name]; // Obtenemos el número oficial de región
    titleEl.textContent = `Región (${regionNumber}): ${name}`;
    // --- FIN MODIFICADO ---

    // --- NUEVO: Mostrar el año ---
    const currentYear = yearSel.value === 'compare' ? years[0] : yearSel.value;
    yearDisplay.textContent = `Datos de: ${currentYear}`;

    satValue.textContent = `${row.satisfaccion.toFixed(1)}%`;
    delValue.textContent = `${row.delitos.toFixed(2)}%`;
    vifValue.textContent = `${row.vif.toFixed(2)}%`;
    satRank.textContent = `${ordinal(ranks.sat[name])} en satisfacción`;
    delRank.textContent = `${ordinal(ranks.del[name])} en delitos`;
    vifRank.textContent = `${ordinal(ranks.vif[name])} en VIF`;

    // --- NUEVO: Actualizar los valores de VIF Psicologica y Fisica ---
    let psicoValue = 0, fisicaValue = 0;
    if (Number.isFinite(row.vif_psicologica)) {
      psicoValue = row.vif_psicologica;
    }
    if (Number.isFinite(row.vif_fisica)) {
      fisicaValue = row.vif_fisica;
    }

    // --- NUEVO: Calcular "Otros" ---
    const otrosValue = 100 - psicoValue - fisicaValue;

    // --- NUEVO: Dibujar el gráfico de torta ---
    drawVifPieChart(psicoValue, fisicaValue);

    // --- NUEVO: Actualizar la leyenda ---
    updateVifLegend(psicoValue, fisicaValue, otrosValue);
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
    // --- CORREGIDO: Aplicar inversión de color como en el mapa ---
    const [minSat, maxSat] = window.Scales.satDomain || [70, 85];
    const fill = window.Scales.color(minSat + maxSat - row.satisfaccion); // ← igual que el mapa
    // --- FIN CORREGIDO ---
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

    // --- MODIFICADO: Cálculo del scale con límites para regiones pequeñas ---
    // Calculamos el scale ideal
    const scaleX = (tb.width * 0.82) / sb.width;
    const scaleY = (tb.height * 0.82) / sb.height;
    let scale = Math.min(scaleX, scaleY);

    // Establecemos un límite inferior y superior para el scale
    // Esto evita que regiones muy pequeñas se agranden demasiado y que regiones muy grandes se reduzcan demasiado
    const minScale = 1.0; // Mínimo: no se reduce
    const maxScale = 8.0; // Máximo: no se agranda más de 8 veces

    scale = Math.max(minScale, Math.min(maxScale, scale));

    // --- NUEVO: Ajuste adicional para Valparaíso ---
    // Aplicamos un factor de aumento específico para Valparaíso
    if (/valpara/i.test(row.region)) {
        scale *= 1.35; // Ajusta este número si es necesario
    }
    // --- FIN NUEVO ---

    // Calculamos los puntos de origen y destino
    const x0 = sb.left + sb.width / 2, y0 = sb.top + sb.height / 2;
    const x1 = tb.left + tb.width / 2, y1 = tb.top + tb.height / 2;

    const start = `translate(${x0}px, ${y0}px) scale(1) translate(${-sb.width / 2}px, ${-sb.height / 2}px)`;
    const end = `translate(${x1}px, ${y1}px) scale(${scale}) translate(${-sb.width / 2}px, ${-sb.height / 2}px)`;

    flyPath.style.opacity = '0.98';
    flyPath.style.transform = start;
    requestAnimationFrame(() => { flyPath.style.transform = end; });

    flyPath.addEventListener('transitionend', () => {
      const d = d3.select(targetSvgEl);
      d.selectAll('*').remove(); // Limpiar antes de dibujar
      const g = d.append('g');

      // Path final con grosor aumentado
      g.append('path')
        .attr('d', dAttr)
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('stroke-width', 3) // Grosor aumentado para mejor visibilidad
        .attr('fill-opacity', 0.8); // Relleno ligeramente transparente

      // Calculamos el bbox original
      const bb = sourcePathEl.getBBox();
      // Aplicamos el padding proporcional
      const pad = Math.max(sb.width, sb.height) * 0.15; // 15% del tamaño original
      d.attr('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + 2 * pad} ${bb.height + 2 * pad}`);
      overlay.remove();
    }, { once: true });
  }

})();