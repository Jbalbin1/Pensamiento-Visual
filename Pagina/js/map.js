// ====== Fábrica de mapas de Chile (reutilizable) ======
(function(){
  const URL = 'data/chile-regions.json';

  // Alias para empatar nombres del GeoJSON con tu JSON de series
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
  };
  const nameFor = (f) => alias[f.properties.NAME_1] || f.properties.NAME_1;

  // ---- Crea una instancia apuntando a un SVG concreto ----
  function createInstance(svgSel, groupSel){
    let svg, g, path, _inited=false;

    async function init(){
      if (_inited) return;
      svg = d3.select(svgSel);
      g   = svg.select(groupSel);

      const projection = d3.geoMercator()
        .center([-72.5, -39])
        .scale(1200)
        .translate([350, 500]);
      path = d3.geoPath(projection);

      const geo = await fetch(URL).then(r=>{
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      g.selectAll('path')
        .data(geo.features, f=>nameFor(f))
        .join('path')
        .attr('class','region')
        .attr('d', path)
        .attr('fill', '#263363');

      drawLegend();     // leyenda propia por SVG
      wireHover();      // tooltip propio
      _inited = true;
    }

    function colorize(year, rows){
      const byName = Object.fromEntries(rows.map(d=>[d.region, d]));
      const color  = window.Scales?.color || (()=>'#888');

      g.selectAll('path')
        .transition().duration(400)
        .attr('fill', f=>{
          const row = byName[nameFor(f)];
          return (row && Number.isFinite(row.satisfaccion))
            ? color(row.satisfaccion)
            : '#3a4366';
        });
    }

    function onRegionClick(handler){
      g.selectAll('path').on('click', function(ev, f){
        handler(nameFor(f), this);
      });
    }

    // ----- Leyenda acoplada a este SVG -----
    function drawLegend(){
      svg.select('#legend').remove();
      const domain = window.Scales?.satDomain || [70,85];
      const [minSat, maxSat] = domain;
      const legendW = 300, legendH = 12;
      const margin = {x: 24, y: 16};

      const legend = svg.append('g').attr('id','legend')
        .attr('transform', `translate(${margin.x},${margin.y})`);

      const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
      const grad = defs.append('linearGradient')
        .attr('id', `legendGrad-${svgSel}`)
        .attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');

      const color = window.Scales.color;
      const N = 40;
      for (let i=0;i<=N;i++){
        const t=i/N;
        grad.append('stop')
          .attr('offset', `${t*100}%`)
          .attr('stop-color', color(minSat + t*(maxSat-minSat)));
      }

      legend.append('rect')
        .attr('width', legendW).attr('height', legendH)
        .attr('rx',4).attr('ry',4)
        .attr('fill', `url(#legendGrad-${svgSel})`)
        .attr('stroke','#233055').attr('stroke-width',1);

      const scale = d3.scaleLinear().domain(domain).range([0, legendW]);
      const axis  = d3.axisBottom(scale).ticks(4).tickFormat(d=>d.toFixed(1)+'%');
      legend.append('g')
        .attr('transform', `translate(0, ${legendH})`)
        .call(axis)
        .selectAll('text').attr('fill','#cbd6ff');

      legend.append('text')
        .attr('x',0).attr('y',-6).attr('fill','#cbd6ff')
        .attr('font-size',12).text('Satisfacción de la vida (%)');
    }

    // ----- Tooltip / hover por instancia -----
    function wireHover(){
      const tooltip = d3.select('body').append('div')
        .attr('class','map-tooltip')
        .style('position','absolute')
        .style('pointer-events','none')
        .style('opacity',0)
        .style('background','rgba(17,22,42,.95)')
        .style('color','#eef3ff')
        .style('padding','8px 14px')
        .style('border-radius','10px')
        .style('font-size','15px')
        .style('border','1px solid #3b4a7a')
        .style('box-shadow','0 6px 18px rgba(0,0,0,.35)')
        .style('transition','opacity .2s ease');

      g.selectAll('path')
        .on('mouseover', function (event, f) {
          g.selectAll('path').style('opacity', .35);
          d3.select(this).style('opacity', 1);
          tooltip.style('opacity',1).html(nameFor(f));
        })
        .on('mousemove', function (event) {
          tooltip.style('left', (event.pageX+12)+'px')
                 .style('top',  (event.pageY-28)+'px');
        })
        .on('mouseout', function(){
          g.selectAll('path').style('opacity',1);
          tooltip.style('opacity',0);
        });
    }

    return { init, colorize, onRegionClick };
  }

  // Exporta una instancia por defecto (modo 1 mapa)
  window.MapChile = createInstance('#mapSvg', '#mapGroup');

  // Exporta la fábrica para crear otras (modo comparar)
  window.createChileMap = createInstance;

})();
