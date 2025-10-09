// Módulo mínimo para burbujas
window.Bubbles = (function(){
  let svg, g, x, y;

  const short = {
    "Arica y Parinacota": "Arica",
    "Valparaíso": "Valpo",
    "Metropolitana": "Stgo",
    "O'Higgins": "O'Hig.",
    "Antofagasta": "Antofa",
    "Araucanía": "Arauc.",
    "Magallanes": "Magal.",
    "Los Ríos": "L. Ríos",
    "Los Lagos": "L. Lagos"
  };
  const labelRegion = name => short[name] || name;

  function init(){
    svg = d3.select('#bubbleSvg');
    g = svg.append('g').attr('transform','translate(60,30)');
    x = d3.scaleLinear().domain([0.9,1.4]).range([0, 780]);
    y = d3.scaleLinear().domain([0.55,1.45]).range([540, 0]);
    g.append('g').attr('transform','translate(0,540)')
      .call(d3.axisBottom(x).ticks(5).tickFormat(d=>d.toFixed(1)+'%'));
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d=>d.toFixed(1)+'%'));
  }

  function update(year, rows){
    const r = window.Scales.radius;
    const color = window.Scales.color;

    const sel = g.selectAll('.node').data(rows, d=>d.region);
    sel.exit().remove();

    const en = sel.enter().append('g').attr('class','node');
    en.append('circle');
    en.append('text').attr('dy','.35em').attr('text-anchor','middle').style('font-size','11px');

    const all = en.merge(sel);
    all.attr('transform', d=>`translate(${x(d.delitos)},${y(d.vif)})`);
    all.select('circle')
      .attr('r', d=>r(d.satisfaccion))
      .attr('fill', d=>color(d.satisfaccion));
    all.select('text').text(d=>labelRegion(d.region));
  }

  return { init, update };
})();
