FROM rocker/shiny:3.6.3

RUN apt-get update && apt-get install -y libssl-dev

RUN R -e "install.packages(c('shinydashboard', 'dplyr', 'visNetwork', 'purrr', 'neo4r', 'RColorBrewer', 'digest'))"

# WHYYYYY doesn't this read from the env :(
#RUN echo 'NEO_URL=${NEO_URL}' >> /home/shiny/.Renviron
#RUN echo 'NEO4J_USER=${NEO4J_USER}' >> $R_HOME/etc/.Renviron
#RUN echo 'NEO4J_ADMIN=${NEO4J_PASS}' >> $R_HOME/etc/.Renviron
#RUN chown shiny.shiny /home/shiny/.Renviron

USER shiny

WORKDIR /srv/shiny-server
COPY dashboard/* ./
COPY run.sh .

COPY shiny-server.conf /etc/shiny-server/shiny-server.conf

ENTRYPOINT [ "./run.sh" ]
