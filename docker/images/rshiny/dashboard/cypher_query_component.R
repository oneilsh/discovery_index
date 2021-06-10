

cypher_query_ui <- function(id) {
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

cypher_query_server <- function(id) {
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
