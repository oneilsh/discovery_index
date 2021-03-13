#for docker_build and docker_push scripts:

#IMAGE oneilsh/discovery-index
#TAG 0.1.0

FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

# set port variable to 443 to use ssl (in docker-compose file)
ENV NODE_ENV=production
RUN npm install

COPY package.json server.js ./ 
COPY lib/ ./lib/
COPY static/ ./static/
COPY wait-for-it.sh ./

CMD ["./wait-for-it.sh", "-t", "0", "neo4j:7474", "--", "npm", "run", "prod"]
