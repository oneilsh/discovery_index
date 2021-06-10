## app.R ##
#library(renv)


library(shinydashboard)
library(dplyr)
library(visNetwork)
library(purrr)
library(stringr)

# needed by some of the files sourced below as well
diProject <- function(session) {
  query <- parseQueryString(session$clientData$url_search)
  if(!is.null(query) && !is.null(query$diProject)) {
    # basic sanitize
    return(str_replace_all(query$diProject, "[^A-Za-z0-9_-]", ""))
  } else {
    return("default")
  }
}



source("neo4j.R")
source("user_graph_component.R")






header <- dashboardHeader(title = "TEHR Discovery Index")
body <- dashboardBody(
  # Boxes need to be put in a row (or column)
  tabItems(
    tabItem(tabName = "neoTest", 
            tagList(
              user_graph_ui("primaryId")
              #cypherQueryUI("cypher")
            )
    )
  )
)


sidebar <- dashboardSidebar(
  sidebarMenu(
    menuItem("People", tabName = "neoTest", icon = icon("th"))
  )
)


ui <- dashboardPage(header, sidebar, body)

server <- function(input, output, session) {
  #cypherQueryServer("cypher")

  user_graph_server("primaryId")
}

shinyApp(ui, server)