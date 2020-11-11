/*console.log("alkjsdf")
d3.selectAll("p").style("color", function() {
  console.log("checking")
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

var simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.metadata.id)) 
  .force("charge", d3.forceManyBody().strength(-100))
  .force("center", d3.forceCenter(0, 0))
  .force("collide", d3.forceCollide().radius(10))
  //.force("charge", d3.forceManyBody().strength(-20).distanceMin(40))
  .on("tick", ticked)


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
//    .attr('opacity', d => {Math.min(ageOpacity(d.source), ageOpacity(d.target))})
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .on('click', function(event, d) {edges.splice(edges.indexOf(d), 1)})

  circleGroup
    .selectAll('g group')
    .data(nodes)
    .join(enter => {
      // var group = enter.append('g')
      //   .attr('transform', d => "translate(" + d.x + "," + d.y + ")")
       //  .classed('group', true)
       enter
       .append('circle')
        .attr("fill", ageFill)
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("r", 10)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .call(drag(simulation))
        .raise()
    
       //group.append('text') 
       //  .text(d => d.metadata.id)
  
     })

/*  circleGroup
    .selectAll('circle')
    .data(nodes)
    .join(enter => enter.append('circle')) 
    .attr("transform", d => "translate(" + d.x + "," + d.y + ")")
    .attr("fill", ageFill)
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("r", 10)
    .call(drag(simulation))
    .raise()
    //.on('click', function(event, d) {if(!event.defaultPrevented) console.log("check"); nodes.splice(nodes.indexOf(d), 1)})
    //.on('click', function(event, d) {delNeighborhood(d)})

  circleGroup
   .selectAll('text')
   .data(nodes)
   .join(enter => enter.append('text'))
   //.attr("transform", d => "translate(" + d.x + "," + d.y + ")")
   .text(n => n.metadata.id)
   .attr("x", d => d.x)
   .attr("y", d => d.y)
   .raise()  */

}

function ageFill(d) {
  var myColor = d3.scaleLinear().domain([0, 1]).range(["white", "teal"])
  var point = 1 - Math.min((d.age || 0)/10, 1)
  return myColor(point)
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



updateVis(nodes, edges)

