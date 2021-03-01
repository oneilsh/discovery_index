FROM rocker/shiny:4.0.3

RUN R -e "install.packages(c('shinydashboard', 'dplyr', 'visNetwork', 'purrr', 'neo4r', 'RColorBrewer', 'digest'))"

WORKDIR /srv/shiny-server
COPY dashboard/* ./
