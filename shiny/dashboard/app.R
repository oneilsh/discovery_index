## app.R ##
library(shinydashboard)

header <- dashboardHeader(title = "TEHR Discovery Index")

body <- dashboardBody(
    # Boxes need to be put in a row (or column)
    tabItems(
        # First tab content
        tabItem(tabName = "dashboard",
                fluidRow(
                    box(plotOutput("plot1", height = 250)),
                    
                    box(
                        title = "Controls",
                        sliderInput("slider", "Number of observations:", 1, 100, 50)
                    )
                )
        ),
        
        # Second tab content
        tabItem(tabName = "neoTest",
                fluidRow(
                    box(textInput(inputId = "query", label = "Query", width = "100%", placeholder = "match (n) return n"), width = 12)
                    ),
                fluidRow(
                    box(width = 2),
                    box(textOutput(outputId = "result"), width = 10)
                    )
                )
        )
    )


sidebar <- dashboardSidebar(
    sidebarMenu(
        menuItem("Dashboard", tabName = "dashboard", icon = icon("dashboard")),
        menuItem("Neo4j", tabName = "neoTest", icon = icon("th"))
    )
)


ui <- dashboardPage(header, sidebar, body)

server <- function(input, output) {
    set.seed(122)
    histdata <- rnorm(500)
    
    output$result <- renderPrint({ 
        return(input$query)
        })
    
    output$plot1 <- renderPlot({
        data <- histdata[seq_len(input$slider)]
        hist(data)
    })
}

shinyApp(ui, server)