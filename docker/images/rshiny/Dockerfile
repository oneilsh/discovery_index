FROM rocker/shiny:3.6.3

RUN apt-get update && apt-get install -y libssl-dev

RUN R -e "install.packages('shinydashboard')"
RUN R -e "install.packages('dplyr')"
RUN R -e "install.packages('visNetwork')"
RUN R -e "install.packages('purrr')"
RUN R -e "install.packages('RColorBrewer')"
RUN R -e "install.packages('digest')"
RUN R -e "install.packages('shiny')"

# libssl is needed for neo4r deps, --allow-releaseinfo-change and 
# exit 0 to avoid errors relating to old ubuntu version used in the old rocker/shiny image; exit 0s and multiple updates may not be needed
RUN apt-get --allow-releaseinfo-change update && apt-get install -y apt-transport-https; exit 0
RUN apt-get --allow-releaseinfo-change update && apt-get install -y libssl-dev; exit 0
RUN R -e "install.packages('neo4r')"


USER shiny

WORKDIR /srv/shiny-server
COPY dashboard/* ./

# this run.sh is a workaround for shiny-server *not* having access to system environment variables
# (for security they say), unless they are explicitly listed in a special file; this script exports
# the environment to that file before starting shiny-server
COPY run.sh .

COPY shiny-server.conf /etc/shiny-server/shiny-server.conf

COPY wait-for-it.sh ./

ENTRYPOINT [ "./wait-for-it.sh", "-t", "0", "neo4j:7474", "--", "./run.sh" ]
