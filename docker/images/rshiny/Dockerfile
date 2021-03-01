FROM rocker/shiny:4.0.3

RUN R -e "install.packages(c('shinydashboard', 'dplyr', 'visNetwork', 'purrr', 'neo4r', 'RColorBrewer', 'digest'))"


WORKDIR /srv/shiny-server
COPY dashboard/* ./

RUN echo 'NEO_URL=${NEO_URL:-http://neo4j:7473}' >> $R_HOME/etc/Renviron
RUN echo 'NEO4J_USER=${NEO4J_USER:-neo4j}' >> $R_HOME/etc/Renviron
RUN echo 'NEO4J_ADMIN=${NEO4J_PASS:-admin}' >> $R_HOME/etc/Renviron
