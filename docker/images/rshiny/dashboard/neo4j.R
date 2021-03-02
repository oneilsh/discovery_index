library(neo4r)
library(dplyr)
library(RColorBrewer)
library(digest)
library(visNetwork)

ggplotColors <- function(g){
  d <- 360/g
  h <- cumsum(c(15, rep(d,g - 1)))
  hcl(h = h, c = 30, l = 80, alpha = 1)
}

colors_107 <- ggplotColors(107)

`%.%` <- function(a, b) {
  paste0(a, b)
}

# turns an R character vector into a list formatted for use in cypher queries
# WARNING: be careful if using unsanitized input in queries!
chr_to_list <- function(x) {
  result <- "'" %.% x %.% "'" %>% paste(collapse = ", ")
  result <- "[" %.% result %.% "]"
  print(result)
  return(result)
}


con <- neo4j_api$new(
  url = Sys.getenv("NEO_URL", "https://DEBUGtehr-discovery-index.cgrb.oregonstate.edu:7473"),
  user = Sys.getenv("NEO4J_USER", "neo4j"),
  password = Sys.getenv("NEO4J_PASS", "neo4j")
)

run_query <- function(query_str) {
  G <- query_str %>%
    call_neo4j(con, type = "graph") %>%
    format_nodes()
    #neo_to_propgraph()
  return(G)
}

run_query_table <- function(query_str) {
  t <- query_str %>%
    call_neo4j(con, type = "row")
  return(t)
}



format_nodes <- function(G) {
  G$relationships$from <- G$relationships$startNode
  G$relationships$to <- G$relationships$endNode
  G$relationships$label <- G$relationships$type
  # just never show these edges - easier this way than modifying 
  # queries to exclude them, could be a performance hit someday
  G$relationships <- G$relationships[G$relationships$type != "ASSOC_PRIMARY", ]

  G$relationships$relId <- G$relationships$id
  G$nodes$firstLabel <- lapply(G$nodes$label, function(x) {return(x[[1]])}) %>% unlist()

  #G$nodes$group <- G$nodes$firstLabel

  G <- format_Default(G)
  G <- format_OrcidProfile(G)
  G <- format_OrcidWork(G)
  G <- format_PrimaryProfile(G)
  G <- format_GithubProfile(G)
  G <- format_GithubRepo(G)
  G <- format_URL(G)
  G <- format_ExternalId(G)
  G <- format_ProgrammingLanguage(G)
  return(G)
}

format_Default <- function(G) {
  G$nodes$label <- ""
  G$nodes$title <- ""
  G$nodes$size <- 20
  G$relationships$width <- 2
  G$relationships$label <- ""
  G$relationships$title <- ""
  G$relationships$arrows <- "middle"
  
  select <- G$nodes$title == ""
  # pick indices for colors into the colors_107 by getting a hash digest of each relationship type
  # and mapping it to an int between 1 and 107
  color_indices <- G$nodes$firstLabel[select] %>% digest2int() %>% `%%`(107) %>% `+`(1)
  G$nodes$color[select] <- colors_107[color_indices]
  
  G$nodes$label[select] <- "Other: " %.% G$nodes$firstLabel[select] 
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<h3>Node</h3><p>" %.% 
      paste("<b>" %.% names(x) %.% "</b>" %.% ": " %.% x, collapse = "<br /><br />") %.%
    "</p>"
  }) %>% unlist()
 
  select <- G$relationships$title == ""
  # pick indices for colors into the colors_107 by getting a hash digest of each relationship type
  # and mapping it to an int between 1 and 107
  color_indices <- G$relationships$type[select] %>% digest2int() %>% `%%`(107) %>% `+`(1)
  G$relationships$color[select] <- colors_107[color_indices]
  G$relationships$title[select] <- "<h3>Edge: " %.% G$relationships$type[select] %.% "</h3>" %.%
    (lapply(G$relationships$properties[select], function(x) {
    "<p>" %.% "<br /><br />" %.%
      "<b>Type:</b> " %.% x$type %.% 
      paste("<b>" %.% names(x) %.% "</b>" %.% ": " %.% x, collapse = "<br /><br />") %.%
      "</p>"
     }) %>% unlist())
  
  
  return(G)
}


format_ProgrammingLanguage <- function(G) {
  select <- G$nodes$firstLabel == "ProgrammingLanguage"
  G$nodes$color[select] <- "#fb9a99"
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "Prog. Language: " %.% x$name
  })
  
  select <- G$relationships$type == "HAS_PROGRAMMING_LANGUAGE"
  G$relationships$color[select] <- "#fb9a99"
  G$relationships$title[select] <- "Main Programming Language (GitHub guess)"
  return(G)
}



format_ExternalId <- function(G) {
  select <- G$nodes$firstLabel == "ExternalId"
  G$nodes$color[select] <- "#d9d9d9"
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "UID: " %.% x$type
  })  
  G$nodes$size[select] <- 10
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<p>" %.% 
      "<b>Type:</b> " %.% x$type %.% "<br /><br />" %.%
      "<b>ID:</b> " %.% x$id %.% "<br /><br />" %.%
      "</p>"
  }) %>% unlist()
  return(G)
}



format_URL <- function(G) {
  select <- G$nodes$firstLabel == "URL"
  G$nodes$color[select] <- "#ffed6f"
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "URL: " %.% x$title
  })  
  
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<p>" %.% 
      "<b>Link:</b> " %.% "<a href='" %.% x$url %.% "'>" %.%  x$title %.% "</a><br /><br />" %.%
      "<b>URL:</b> " %.% x$url %.% "<br /><br />" %.%
      "</p>"
  }) %>% unlist()
  
  select <- G$relationships$type == "HAS_URL"
  G$relationships$color[select] <- "#ffed6f"
  G$relationships$title[select] <- "Has URL"
  return(G)
}


format_GithubRepo <- function(G) {
  select <- G$nodes$firstLabel == "GithubRepo"
  G$nodes$color[select] <- "#ccebc5"
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "Repo: " %.% x$name
  })  
  G$nodes$size[select] <- lapply(G$nodes$properties[select], function(x) {
    log(1+x$watchersCount) + 20
  })  
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<p>" %.% 
      "<b>Name:</b> " %.% "<a href='" %.% x$url %.% "'>" %.%  x$name %.% "</a><br /><br />" %.%
      "<b>Created:</b> " %.% x$createdAt %.% "<br /><br />" %.%
      "<b>Description:</b> " %.% x$description %.% "<br /><br />" %.%
      "<b>Last Push:</b> " %.% x$pushedAt %.% "<br /><br />" %.%
      "<b>Watchers:</b> " %.% x$watchersCount %.% "<br /><br />" %.%
      "</p>"
  }) %>% unlist()
  
  select <- G$relationships$type == "HAS_REPO"
  G$relationships$title[select] <- "Owns Repo"
  G$relationships$color[select] <- "#ccebc5"
  return(G)
}

format_GithubProfile <- function(G) {
  select <- G$nodes$firstLabel == "GithubProfile"
  G$nodes$color[select] <- "#fdbf6f"
  # increase the size only for nodes where we have a name
  G$nodes$size[select] <- G$nodes$size[select] * (
    lapply(G$nodes$properties[select], function(x) {
      ifelse(!is.null(x$name), 1.5, 1.0)
    }) %>% unlist()
  )
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "Github: " %.% x$username
  })  
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<p>" %.% 
      ifelse(is.null(x$username), "", "<b>Username:</b> " %.% x$username %.% "<br /><br />") %.%
      ifelse(is.null(x$name), "", "<b>Name:</b> " %.% "<a href='https://github.com/" %.% x$username %.% "'>" %.%  x$name %.% "</a><br /><br />") %.%
      ifelse(is.null(x$company), "", "<b>Company:</b> " %.% x$company %.% "<br /><br />") %.%
      ifelse(is.null(x$location), "", "<b>Location:</b> " %.% x$location %.% "<br /><br />") %.%
      ifelse(is.null(x$followersCount), "", "<b>Followers:</b> " %.% x$followersCount %.% "<br /><br />") %.%
      ifelse(is.null(x$followingCount), "", "<b>Following:</b> " %.% x$followingCount %.% "<br /><br />") %.%
      ifelse(is.null(x$createdAt), "", "<b>Created At:</b> " %.% x$createdAt %.% "<br /><br />") %.%
      "</p>"
  }) %>% unlist()
  
  select <- G$relationships$type == "FOLLOWS"
  G$relationships$title[select] <- "Follows"
  
  return(G)
}

format_PrimaryProfile <- function(G) {
  select <- G$nodes$firstLabel == "PrimaryProfile"
  G$nodes$color[select] <- "#a6cee3"
  G$nodes$size[select] <- G$nodes$size[select]*2
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "Primary: " %.% x$primaryId
  })
  
  select <- G$relationships$type == "HAS_SECONDARY_PROFILE"
  G$relationships$label[select] <- ""
  G$relationships$title[select] <- "Has Profile"
  G$relationships$color[select] <- "#1f78b4"
  return(G)
}


format_OrcidWork <- function(G) {
  select <- G$nodes$firstLabel == "Work"
  G$nodes$color[select] <- "#b2df8a"
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "Work: " %.% x$journalTitle %.% ", " %.%  x$year
  })
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
    "<p>" %.% 
      "<b>Title:</b> " %.% "<a href='" %.% x$url %.% "'>" %.%  x$title %.% "</a><br /><br />" %.%
      "<b>Type:</b> " %.% x$type %.% "<br /><br />" %.%
      "<b>Year:</b> " %.% x$year %.% "<br /><br />" %.%
      "<b>Venue:</b> " %.% x$journalTitle %.% "<br /><br />" %.%
      "</p>"
  }) %>% unlist()
  
  select <- G$relationships$type == "HAS_WORK"
  G$relationships$title[select] <- "Has Work"
  G$relationships$color[select] <- "#b2df8a"
  return(G)
}

format_OrcidProfile <- function(G) {
  select <- G$nodes$firstLabel == "OrcidProfile"
  G$nodes$color[select] <- "#1f78b4"
  G$nodes$size[select] <- G$nodes$size[select]*1.5
  G$nodes$label[select] <- lapply(G$nodes$properties[select], function(x) {
    "ORCiD: " %.% x$firstName %.% " " %.% x$lastName 
  }) %>% unlist()
  G$nodes$title[select] <- lapply(G$nodes$properties[select], function(x) {
     "<p>" %.% 
      "<b>ORCiD:</b> " %.% x$orcid %.% "<br /><br />" %.%
      "<b>Bio:</b> " %.% x$bio %.% "<br /><br />" %.%
      "</p>"
  }) %>% unlist()

  return(G)
}



G <- run_query("match (o) -[r2 {primaryId: 'melissa@tislab.org'}]-> (t)  return o, r2, t")
print(visNetwork(G$nodes, G$relationships) %>%
  visIgraphLayout(smooth = TRUE, physics = TRUE) ) %>%
  visOptions(highlightNearest = list(enabled = T, degree = 1, hover = T), collapse = TRUE)
#visPhysics(stabilization = FALSE, maxVelocity = 300, solver = "repulsion", repulsion = list(nodeDistance = 200, springConstant = 0.2)) 

