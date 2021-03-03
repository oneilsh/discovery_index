## app.R ##
#library(renv)


library(shinydashboard)
library(dplyr)
library(visNetwork)
library(purrr)


source("neo4j.R")



primaryIdUI <- function(id) {
  ns <- NS(id)
  
  primaryIdDf <- run_query_table("match (n:PrimaryProfile) return n.primaryId") %>% as.data.frame()
  colnames(primaryIdDf) <- "primaryId"

  tagList(
    fluidRow(
      box(selectizeInput(inputId = ns("searchResult"), 
                        label = "Search...",
                        choices = primaryIdDf$primaryId,
                        multiple = TRUE,
                        selected = NULL),
          width = 12)
    ),
    fluidRow(
      box(visNetworkOutput(ns("network"), height = "500px"), width = 12)
      ##box(width = 2),
      #box(dataTableOutput(outputId = "result"), width = 10)
    )
    
  )
  
}


primaryIdServer <- function(id) {
  moduleServer(id, function(input, output, session) {
    
    G <- eventReactive(input$searchResult, {
      query <- "match (n) -[r]-> (q) WHERE 
       (r.primaryId IN " %.% chr_to_list(input$searchResult) %.% ")
      AND
      ((NOT exists(r.type)) OR
        (NOT r.type = 'ASSOC_PRIMARY')
      )
      return n, r, q"
      run_query(query)
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