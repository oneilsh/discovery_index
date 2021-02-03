/*
d3.selectAll("p").style("color", function() {
  return "hsl(" + Math.random() * 360 + ",100%,50%)";
});*/

var width = $('#graphSvg').width()
var height = $('#graphSvg').height()
// select svg and center coordinates on 0, 0 in middle of drawing area
var svg = d3.select('#graphSvg')
  .attr("viewBox", [-width / 2, -height / 2, width, height])
var circleGroup = svg.append("g")
var lineGroup = svg.append("g")

//var nodes = [{id: "0", name: "Shawn"}, {id: "1", name: "Brandon"}, {id: "2", name: "Julie"}, {id: "3", name: "Melissa"}]
//var links = [{source: "0", target: "1", value: 2}, {source: "1", target: "2", value: 4}]
var nodes = [
             {metadata: {id: "0", labels: ["PrimaryProfile"]}, data: {primaryId: "oneils"}},
             {metadata: {id: "1", labels: ["GithubProfile"]}, data: {username: "oneilsh"}},
             {metadata: {id: "2", labels: ["PrimaryProfile"]}, data: {}},
             {metadata: {id: "3", labels: ["OrcidProfile"]}, data: {primaryId: "0000-0020-0020-0020", firstName: "James", lastName: "Smith"}}
            ]
var edges = [
             {metadata: {id: "7", type: "HAS_SECONDARY_PROFILE", data: {ofType: "GitHub"}}, source: "0", target: "1"},
             {metadata: {id: "8", type: "HAS_SECONDARY_PROFILE", data: {ofType: "Orcid"}}, source: "2", target: "3"},
             {metadata: {id: "9", type: "KNOWS", data: {}}, source: "0", target: "2"},
             {metadata: {id: "10", type: "LINKS_TO", data: {}}, source: "1", target: "3"}
            ]

var current_id = 100
function addNode() {
  current_id = current_id + 1
  nodes.push({id: current_id.toString(), metadata: {id: current_id.toString()}, name: "node_" + current_id.toString()})
  if(current_id > 103) {
    // why does this not work?
    edges.push({source: current_id.toString(), target: (current_id - (current_id % 3 + 1)).toString()})
  }

  // age the nodes
  nodes = nodes.map(d => {
    d.age = (d.age || 0) + 1;
    if(d.age < 10) {
      return d
    } else {
      delNeighborhood(d)
    }
  }).filter(n => n)   // undefined will be filtered as evaulating falsy

  //nodes = nodes.filter(n => {})

  // get the simulation to initialize edges with node references sourced from the ID strings given
  simulation.nodes(nodes)
  simulation.force('link').links(edges)

  simulation.alpha(0.25).restart()
}

// returns an array of [nodes, edges] connected to the given node
function getNeighborhood(d) {
  var links = edges.filter(e => e.source == d || e.target == d)
  var neighbors = links.map(function(e) {
     if(e.source != d) {
       return e.source
     } else {
       return e.target
     }
  })

  return [neighbors, links]
}

// removes d and it's neighbors and links from nodes and edges
function delNeighborhood(d) {
  var nhood = getNeighborhood(d)
  var delNeighbors = nhood[0]
  var delLinks = nhood[1]
  edges = edges.filter(function(e) {
    return delLinks.indexOf(e) == -1
  })
  /*nodes = nodes.filter(function(n) {
    return delNeighbors.indexOf(n) == -1
  })*/
  nodes = nodes.filter(n => n != d)
}


function updateVis(nodes, edges) {
  simulation.nodes(nodes)
  simulation.force('link', d3.forceLink(edges).id(d => d.metadata.id))


  var l = lineGroup
    .selectAll('line')
    .data(edges)

  l
    .join(enter => enter.append('line'))
    .attr('stroke', '#555555')
    .attr('stroke-width', 2)
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .attr("opacity", edgeAgeOpacity)
    .on('click', function(event, d) {edges.splice(edges.indexOf(d), 1)})



  var node = circleGroup
    .selectAll('g')
    .data(nodes, d => d.metadata.id)
    .join(function(enter) {
      var g = enter.append('g')

      g.append('circle')
        .attr("fill", "white")
        .attr("r", 15)
      g.append('circle')
        .attr("class", "opacityByAge")
        .attr("fill", "teal")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("r", 15)
        .attr("opacity", ageOpacity)
      g.append('text')
        .attr("class", "opacityByAge")
        .text(d => d.metadata.id)
        .attr("dominant-baseline", "middle") // center vertically
        .attr("text-anchor", "middle")       // center horizontally
        .attr("opacity", ageOpacity)
      return g
    })
    // all nodes:
    .attr("transform", d => "translate(" + d.x + "," + d.y + ")")
    .call(drag(simulation))
    //.on('click', (event, d) => {d.age = 1000; simulation.alpha(0.25).restart(); return d})
    .on('click', (event, d) => {
      var currentTarget = d3.select(event.currentTarget)
      currentTarget.classed("fixed", !currentTarget.classed("fixed"))

      if(!currentTarget.classed("fixed")) {
       d.fx = null; d.fy = null
       d3.select(event.currentTarget)
          .selectAll('.popout')
          .remove()
      } else {
       d.fx = d.x; d.fy = d.y;
       d3.select(event.currentTarget)
         .append('circle').attr('class', 'popout')
           .attr('r', 8)
           .raise()
           .attr("transform", "translate(20, 0)")
           .attr("transform", "rotate(90, -20, 0)")
      }
     })
    //.on('mouseout', (event, d) => {
    //   var selection = d3.select(event.currentTarget)
    //     .selectAll('.popout')
    //     .remove()
    // })

    circleGroup
      .selectAll('g')
      .selectAll('.opacityByAge')
      .attr("opacity", ageOpacity)


    circleGroup.raise()

}

function ageOpacity(d) {
  var point = 1 - Math.min((d.age || 0)/10, 1)
  return point
}

function edgeAgeOpacity(e) {
  return Math.min(ageOpacity(e.source), ageOpacity(e.target))
}

function ticked() {
  updateVis(nodes, edges)
}


var drag = function(simulation) {
  function dragStarted(event) {
    if(!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragEnded(event) {
    if(!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }

  return d3.drag()
   .on("start", dragStarted)
   .on("drag", dragged)
   .on("end", dragEnded)

}

var simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.metadata.id))
  .force("charge", d3.forceManyBody().strength(-100))
  .force("center", d3.forceCenter(0, 0))
  .force("collide", d3.forceCollide().radius(10))
  //.force("charge", d3.forceManyBody().strength(-20).distanceMin(40))
  .on("tick", ticked)



updateVis(nodes, edges)
