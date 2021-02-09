library(neo4r)
library(dplyr)


con <- neo4j_api$new(
  url = Sys.getenv("NEO_URL", "https://tehr-discovery-index-dev.cgrb.oregonstate.edu:7473"),
  user = Sys.getenv("NEO_USER", "neo4j"),
  password = Sys.getenv("NEO_PASS", "neo4j")
)

run_query <- function(query_str) {
  G <- query_str %>%
    call_neo4j(con, type = "graph") %>%
    neo_to_propgraph()
  return(G)
}

neo_to_propgraph <- function(G) {
  neoRels <- G$relationships
  neoNodes <- G$nodes
  irels <- data.frame(from = neoRels$startNode, to = neoRels$endNode, label = neoRels$type, relId = neoRels$id)
  relProps <- neoRels$properties %>% map(names) %>% unlist() %>% unique()
  names(relProps) <- relProps
  
  getPropValues <- function(props_list, propertyStr) {
    props_list %>% map(~ if(!is.null(.x[[propertyStr]])) {.x[[propertyStr]]} else {NA} ) %>% unlist() %>% return()
  }
  
  relPropCols <- relProps %>% map(~getPropValues(neoRels$properties, .x)) %>% as.data.frame()
  irels <- cbind(irels, relPropCols)
  
  nodeProps <- neoNodes$properties %>% map(names) %>% unlist() %>% unique()
  names(nodeProps) <- nodeProps
  
  nodePropCols <- nodeProps %>% map(~getPropValues(neoNodes$properties, .x)) %>% as.data.frame()
  nodeFirstLabels <- neoNodes$label %>% map(~.x[[1]]) %>% unlist()
  inodes <- cbind(id = neoNodes$id, firstLabel = nodeFirstLabels, nodePropCols)
  
  return(list(nodes = inodes, edges = irels))
}


if(FALSE) {
  ig <- neo_to_propgraph(G)
  
  nodes <- ig$nodes
  edges <- ig$edges

nodes <- nodes %>%
mutate(title = case_when(firstLabel == "GithubRepo" ~ name,
                           firstLabel == "Work" ~ title,
                           TRUE ~ ""))
nodes$group <- nodes$firstLabel
visNetwork(nodes, edges) %>%
  visGroups(groupname = "PrimaryProfile", color = list(background = "gray"))
  
  


forceNetwork(Links = edges, Nodes = nodes, Source = "from", Target = "to", NodeID = "nodeId", Group = "nodeFirstLabels")
}