FROM rocker/shiny:3.6.3

RUN apt-get update && apt-get install -y libssl-dev

RUN R -e "install.packages('shinydashboard')"
RUN R -e "install.packages('dplyr')"
RUN R -e "install.packages('visNetwork')"
RUN R -e "install.packages('purrr')"
RUN R -e "install.packages('neo4r')"
RUN R -e "install.packages('RColorBrewer')"
RUN R -e "install.packages('digest')"
RUN R -e "install.packages('shiny')"

USER shiny

WORKDIR /srv/shiny-server
COPY dashboard/* ./

# this run.sh is a workaround for shiny-server *not* having access to system environment variables
# (for security they say), unless they are explicitly listed in a special file; this script exports
# the environment to that file before starting shiny-server
COPY run.sh .

COPY shiny-server.conf /etc/shiny-server/shiny-server.conf

ENTRYPOINT [ "./run.sh" ]
