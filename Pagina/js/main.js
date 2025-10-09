(async function init(){

  // 1) Cargar datos
  const data = await fetch('data/series.json').then(r=>r.json());
  const years = data.years || [];
  const rowsByYear = data.rows || {};

  // 2) Dominio real de satisfacción (para que el color ocupe todo el rango)
  const allRows = Object.values(rowsByYear).flat();
  const sats = allRows.map(d => d?.satisfaccion).filter(Number.isFinite);
  const minSat = d3.min(sats) ?? 70;
  const maxSat = d3.max(sats) ?? 85;

  // 3) Escalas compartidas
  // Color: azul -> rojo (suave), sin blanco al medio (interpolación HCL)
  window.Scales = {
    satDomain: [minSat, maxSat],
    color: d3.scaleLinear()
      .domain([minSat, maxSat])
      .range([d3.hcl(215, 60, 55), d3.hcl(10, 65, 55)]) // azul → rojo
      .interpolate(d3.interpolateHcl)
      .clamp(true),
    radius: d3.scaleSqrt()
      .domain([minSat, maxSat])
      .range([10, 40])
  };

  // 4) Filtro de año
  const yearSel = document.getElementById('yearSel');
  years.forEach(y => { const o=document.createElement('option'); o.value=y; o.textContent=y; yearSel.appendChild(o); });
  yearSel.value = years[0] || '';

  // 5) Inicializar vistas
  if(window.Bubbles && window.MapChile){
    Bubbles.init?.();
    await MapChile.init?.();            // dibuja mapa y leyenda

    function refresh(){
      const y = yearSel.value;
      const rows = rowsByYear[y] || [];
      Bubbles.update?.(y, rows);
      MapChile.colorize?.(y, rows);     // pinta regiones con misma escala
    }
    yearSel.addEventListener('change', refresh);
    refresh();
  } else {
    console.warn('Faltan módulos Bubbles/MapChile');
  }
})();
