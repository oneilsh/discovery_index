/*console.log("alkjsdf")
d3.selectAll("p").style("color", function() {
  console.log("checking")
  return "hsl(" + Math.random() * 360 + ",100%,50%)";
});*/
var svg = d3.select('#graphSvg')
var width = $('#graphSvg').width()
var height = $('#graphSvg').height()

//var nodes = [{id: "0", name: "Shawn"}, {id: "1", name: "Brandon"}, {id: "2", name: "Julie"}, {id: "3", name: "Melissa"}]
//var links = [{source: "0", target: "1", value: 2}, {source: "1", target: "2", value: 4}]
var nodes = [
             {id: "0", metadata: {id: "0", labels: ["PrimaryProfile"]}, data: {primaryId: "oneils"}}, 
             {id: "1", metadata: {id: "1", labels: ["GithubProfile"]}, data: {username: "oneilsh"}}, 
             {id: "2", metadata: {id: "2", labels: ["PrimaryProfile"]}, data: {}}, 
             {id: "3", metadata: {id: "3", labels: ["OrcidProfile"]}, data: {primaryId: "0000-0020-0020-0020", firstName: "James", lastName: "Smith"}} 
            ]
var edges = [
             {metadata: {id: "7", type: "HAS_SECONDARY_PROFILE", data: {ofType: "GitHub"}}, source: "0", target: "1"},
             {metadata: {id: "8", type: "HAS_SECONDARY_PROFILE", data: {ofType: "Orcid"}}, source: "2", target: "3"},
             {metadata: {id: "9", type: "KNOWS", data: {}}, source: "0", target: "2"},
             {metadata: {id: "10", type: "LINKS_TO", data: {}}, source: "1", target: "3"}
            ]

function addNode() {
  nodes.push({id: "9", metadata: {id: "9"}, name: "Anne"})
  edges.push({source: "0", target: "9"})
  simulation.force('link').links(edges)
}


var simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.id)) 
  .force("charge", d3.forceManyBody().strength(-100))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collide", d3.forceCollide().radius(10))
  //.force("charge", d3.forceManyBody().strength(-20).distanceMin(40))
  .on("tick", ticked)


function updateVis(nodes, edges) {
  simulation.nodes(nodes)
  simulation.force('link', d3.forceLink(edges).id(d => d.id))


  var l = d3.select('svg')
    .selectAll('line')
    .data(edges)

  l
    .join(enter => enter.append('line'))
    .attr('stroke', '#555555')
    .attr('stroke-width', 2)
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  var u = d3.select('svg')
    .selectAll('circle')
    .data(nodes)

  u
   .join(enter => enter.append('circle')) 
   .attr("fill", "red")
   .attr("stroke", "white")
   .attr("stroke-width", 2)
   .attr("r", 10)
   .attr('cx', d => d.x)
   .attr('cy', d => d.y)
   .call(drag(simulation))
   .raise()
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

