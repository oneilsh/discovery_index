library(visNetwork)

links <- data.frame(from = sample(letters, 15),
                    to = sample(letters, 15))

nodes <- data.frame(id = unique(unlist(links)))