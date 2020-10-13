library(networkD3)

src <- c("A", "A", "A", "A",
         "B", "B", "C", "C", "D", "x")
target <- c("B", "C", "D", "J",
            "E", "F", "G", "H", "I", "Y")
networkData <- data.frame(src, target)

# Plot
x <- simpleNetwork(networkData)
