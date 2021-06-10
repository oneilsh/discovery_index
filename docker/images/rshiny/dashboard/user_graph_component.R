

user_graph_ui <- function(id) {
  ns <- NS(id)
  
  
  tagList(
    fluidRow(
      box(selectizeInput(inputId = ns("searchResult"), 
                         label = "Search for profiles to display:",
                         choices = NULL,
                         multiple = TRUE,
                         selected = NULL),
          width = 12)
    ),
    fluidRow(
      box(visNetworkOutput(ns("network"), height = "500px"), width = 12),
      ##box(width = 2),
      box(HTML("<b>Publication Summary of Selected Profiles (from ORCiD):</b><br />"), dataTableOutput(ns("pubTable")), width = 12)
    )
    
  )
  
}





user_graph_server <- function(id) {
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
      run_query(query) %>% 
        drop_leaves(nodetypes = c("GithubProfile", "ExternalId")) %>%
        drop_by_prop(list("admin" = function(value) {tolower(value) == "true"})) # covers boolean and string representations
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
      AND
      (NOT exists(r.admin) OR r.admin = false OR r.admin = 'false')
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
