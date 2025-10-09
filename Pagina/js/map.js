// Módulo mínimo para mapa (colorea por satisfacción si la fila existe)
window.MapChile = (function () {
  const URL = 'data/chile-regions.json'; // GADM gadm41_CHL_1.json guardado local
  let svg, g, path;

  // Alias para que coincida con tus etiquetas de datos
  const alias = {
    "SantiagoMetropolitan": "Metropolitana",
    "LibertadorGeneralBernardoO'Hi": "O'Higgins",
    "La Araucanía": "Araucanía",
    "AyséndelGeneralIbañezdelCam": "Aysén",
    "Magallanes y de la Antártica Chilena": "Magallanes",
    "AricayParinacota": "Arica y Parinacota",
    "Bío-Bío": "Biobío",
    "LosRíos": "Los Ríos",
    "LosLagos": "Los Lagos",
    "MagallanesyAntárticaChilena": "Magallanes"
    // el resto ya coincide
  };
  const regionName = (f) => alias[f.properties.NAME_1] || f.properties.NAME_1;

  async function init() {
    svg = d3.select('#mapSvg');
    g = svg.select('#mapGroup');

    const projection = d3.geoMercator().center([-72.5, -39]).scale(1200).translate([350, 500]);
    path = d3.geoPath(projection);

    try {
      const geo = await fetch(URL).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

      g.selectAll('path')
        .data(geo.features, (f) => regionName(f))
        .join('path')
        .attr('class', 'region region-grow')
        .attr('d', path)
        .attr('fill', '#263363'); // base antes de colorize()

      // --- Leyenda de color (barra horizontal arriba del mapa) ---
      drawLegend();

    } catch (err) {
      console.error('Error cargando GeoJSON:', err);
      g.append('text').attr('x', 20).attr('y', 30).attr('fill', '#f66')
        .text('No se pudo cargar el mapa (revisa data/chile-regions.json)');
    }
  }

  function colorize(year, rows) {
    const byName = Object.fromEntries(rows.map((d) => [d.region, d]));
    const color = window.Scales?.color || ((x)=>'#888');
    const missing = [];

    g.selectAll('path')
      .transition().duration(400)
      .attr('fill', (f) => {
        const name = regionName(f);
        const row = byName[name];
        if (!row || !Number.isFinite(row.satisfaccion)) {
          missing.push(name);
          return '#3a4366'; // gris azulado para "sin dato / sin match"
        }
        return color(row.satisfaccion); // misma escala que burbujas
      });

    if (missing.length) {
      const uniq = [...new Set(missing)].sort();
      console.warn('Regiones sin dato / nombre no coincide:', uniq);
    }
  }

  // (Opcional) expón click de región para abrir popup
  function onRegionClick(handler) {
    g.selectAll('path').on('click', function (ev, f) {
      handler(regionName(f), this);
    });
  }

  // ---------- Leyenda ----------
  function drawLegend(){
    // Limpia si existe
    svg.select('#legend').remove();

    const domain = window.Scales?.satDomain || [70, 85];
    const [minSat, maxSat] = domain;
    const legendW = 300, legendH = 12;
    const margin = {x: 24, y: 16};

    const legend = svg.append('g').attr('id','legend')
      .attr('transform', `translate(${margin.x},${margin.y})`);

    // Gradiente
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const grad = defs.append('linearGradient')
      .attr('id','legendGrad')
      .attr('x1','0%').attr('y1','0%')
      .attr('x2','100%').attr('y2','0%');

    // Muestreamos la escala para que el degradado sea suave
    const color = window.Scales.color;
    const N = 40;
    for (let i=0; i<=N; i++){
      const t = i / N;
      grad.append('stop')
        .attr('offset', `${t*100}%`)
        .attr('stop-color', color(minSat + t*(maxSat-minSat)));
    }

    // Barra
    legend.append('rect')
      .attr('width', legendW).attr('height', legendH)
      .attr('rx', 4).attr('ry', 4)
      .attr('fill', 'url(#legendGrad)')
      .attr('stroke', '#233055').attr('stroke-width', 1);

    // Ticks y etiquetas
    const scale = d3.scaleLinear().domain(domain).range([0, legendW]);
    const axis = d3.axisBottom(scale)
      .ticks(4)
      .tickFormat(d => d.toFixed(1) + '%');

    legend.append('g')
      .attr('transform', `translate(0, ${legendH})`)
      .call(axis)
      .selectAll('text').attr('fill', '#cbd6ff');

    // Título
    legend.append('text')
      .attr('x', 0).attr('y', -6)
      .attr('fill', '#cbd6ff')
      .attr('font-size', 12)
      .text('Satisfacción de la vida (%)');
  }

  return { init, colorize, onRegionClick };
})();
