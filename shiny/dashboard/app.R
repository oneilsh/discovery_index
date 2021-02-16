## app.R ##
library(shinydashboard)
library(dplyr)
library(visNetwork)
library(purrr)

source("neo4j.R")

header <- dashboardHeader(title = "TEHR Discovery Index")

body <- dashboardBody(
    # Boxes need to be put in a row (or column)
    tabItems(
        tabItem(tabName = "neoTest",
                fluidRow(
                    box(textAreaInput(inputId = "query", 
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
                        actionButton("submitButton", "Submit Query", width = "100%"),
                        width = 12)
                    ),
                fluidRow(
                    box(visNetworkOutput("network"), width = 12)
                    ##box(width = 2),
                    #box(dataTableOutput(outputId = "result"), width = 10)
                    )
                )
        )
    )


sidebar <- dashboardSidebar(
    sidebarMenu(
        menuItem("Neo4j", tabName = "neoTest", icon = icon("th"))
    )
)


ui <- dashboardPage(header, sidebar, body)

server <- function(input, output) {
    set.seed(122)
    histdata <- rnorm(500)
    
    G <- eventReactive(input$submitButton, {
        run_query(input$query)
    })
    
    output$network <- renderVisNetwork({
        ig <- G()
        nodes <- ig$nodes
        edges <- ig$edges
        #str(nodes)
        
        #nodes <- nodes %>%
        #    mutate(title = case_when(firstLabel == "GithubRepo" ~ name,
        #                             firstLabel == "Work" ~ title,
        #                             TRUE ~ ""))
        nodes$title <- nodes$firstLabel
        nodes$group <- nodes$firstLabel
        visNetwork(nodes, edges) %>%
            visGroups(groupname = "PrimaryProfile", color = list(background = "gray")) %>%
            visPhysics(stabilization = FALSE, maxVelocity = 300, solver = "repulsion", repulsion = list(nodeDistance = 200, springConstant = 0.2)) 
            #visIgraphLayout()
        
        
    })
    #output$result <- renderDataTable({ 
    #    G()$nodes
    #    })
    
    output$plot1 <- renderPlot({
        data <- histdata[seq_len(input$slider)]
        hist(data)
    })
}

shinyApp(ui, server)