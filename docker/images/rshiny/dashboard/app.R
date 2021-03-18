## app.R ##
#library(renv)


library(shinydashboard)
library(dplyr)
library(visNetwork)
library(purrr)
library(stringr)


source("neo4j.R")

diProject <- function(session) {
  query <- parseQueryString(session$clientData$url_search)
  if(!is.null(query) && !is.null(query$diProject)) {
    # sanitize
    return(str_replace_all(query$diProject, "[^A-Za-z0-9_-]", ""))
  } else {
    res <- run_query_table("match (n) return n.diProject limit 1")
    return(res$n.diProject[1,1])
  }
}




primaryIdUI <- function(id) {
  ns <- NS(id)
  


  tagList(
    fluidRow(
      box(selectizeInput(inputId = ns("searchResult"), 
                        label = "Search...",
                        choices = NULL,
                        multiple = TRUE,
                        selected = NULL),
          width = 12)
    ),
    fluidRow(
      box(visNetworkOutput(ns("network"), height = "500px"), width = 12),
      ##box(width = 2),
      box(dataTableOutput(ns("pubTable")), width = 12)
    )
    
  )
  
}


primaryIdServer <- function(id) {
  moduleServer(id, function(input, output, session) {
    
    observe({
      diProject <- diProject(session)
      primaryIdDf <- run_query_table("match (n:PrimaryProfile {diProject: '" %.% diProject %.% "'}) return n.primaryId, n.name") %>% as.data.frame()
      if(ncol(primaryIdDf) > 0) {
        colnames(primaryIdDf) <- c("primaryId", "name")
        choices <- primaryIdDf$primaryId
        names(choices) <- ifelse(!is.na(primaryIdDf$name), primaryIdDf$name %.% " (" %.% primaryIdDf$primaryId %.% ")", primaryIdDf$primaryId)
        updateSelectizeInput(inputId = "searchResult", session, choices = choices)
      }
    })
      
    G <- eventReactive(input$searchResult, {
      project <- diProject(session)
      
      query <- "match (n) -[r {diProject: '"  %.% project %.%  "'}]-> (q) WHERE 
       (r.primaryId IN " %.% chr_to_list(input$searchResult) %.% ")
      AND
      ((NOT exists(r.type)) OR
        (NOT r.type = 'ASSOC_PRIMARY')
      )
      return n, r, q"
      run_query(query)
    })
    
    dt <- eventReactive(input$searchResult, {
      project <- diProject(session)
      
      query <- "match (n) -[r {diProject: '"  %.% project %.%  "'}]-> (q) WHERE 
       (r.primaryId IN " %.% chr_to_list(input$searchResult) %.% ")
      AND
      ((NOT exists(r.type)) OR
        (NOT r.type = 'ASSOC_PRIMARY')
      )
      AND
      (q:Work)
      return DISTINCT r.primaryId AS `Primary ID`, q.journalTitle AS `Venue`, count(q.journalTitle) as `Count`"
      res_df <- data.frame(`Primary ID` = c(), Venue = c(), Count = c())
      res <- run_query_table(query) %>% as.data.frame()
      if(ncol(res) > 0) {
        colnames(res) <- c("Primary ID", "Venue", "Count")
        res_df <- rbind(res, res_df)
      }
      return(res_df)
    })
    
    output$network <- renderVisNetwork({
      ig <- G()
      # so visNetwork doesn't want an id col on the relationships table - it'll F things up by reading data from the nodes table apparently...
      ig$relationships$id <- NULL
      
      visNetwork(ig$nodes, ig$relationships) %>%
        visOptions(highlightNearest = list(enabled = T, degree = 1, hover = T), collapse = TRUE) %>%
        visIgraphLayout(smooth = TRUE, physics = TRUE, type = "full") 
      #visPhysics(stabilization = FALSE, maxVelocity = 300, solver = "repulsion", repulsion = list(nodeDistance = 200, springConstant = 0.2)) 
      
    })
    
    output$pubTable <- renderDataTable({
      dt()
      # TODO: hmm how do I show a better message for no data
    }, options = list(language = list(infoEmpty = 'My Custom No Data Message'), paging = TRUE))
    
  })
}


cypherQueryUI <- function(id) {
  ns <- NS(id)
    
  tagList(
            fluidRow(
              box(textAreaInput(inputId = ns("query"), 
                                label = "Query", 
                                width = "100%", 
                                rows = 6,
                                value = "match (n) -[r]-> (q) WHERE 
(r.primaryId = 'thomas.sharpton@oregonstate.edu' OR
r.primaryId = 'maude.david@oregonstate.edu')
AND
((NOT exists(r.type)) OR
(NOT r.type = 'ASSOC_PRIMARY'))
return n, r, q"),
                  actionButton(ns("submitButton"), "Submit Query", width = "100%"),
                  width = 12)
            ),
            fluidRow(
              box(visNetworkOutput(ns("network"), height = "100%"), width = 12)
              ##box(width = 2),
              #box(dataTableOutput(outputId = "result"), width = 10)
            )
    
  )
  
}

cypherQueryServer <- function(id) {
  moduleServer(id, function(input, output, session) {
    
    G <- eventReactive(input$submitButton, {
      run_query(input$query)
    })
    
    output$network <- renderVisNetwork({
      ig <- G()
      
      visNetwork(ig$nodes, ig$relationships) %>%
        visOptions(highlightNearest = list(enabled = T, degree = 1, hover = T), collapse = TRUE) %>%
        visIgraphLayout(smooth = TRUE, physics = TRUE, type = "full") 
      #visPhysics(stabilization = FALSE, maxVelocity = 300, solver = "repulsion", repulsion = list(nodeDistance = 200, springConstant = 0.2)) 
      
      
    })
    
  })
}


header <- dashboardHeader(title = "TEHR Discovery Index")
body <- dashboardBody(
  # Boxes need to be put in a row (or column)
  tabItems(
    tabItem(tabName = "neoTest", 
            tagList(
              primaryIdUI("primaryId")
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

  primaryIdServer("primaryId")
}

shinyApp(ui, server)