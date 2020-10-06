#for docker_build and docker_push scripts:

#IMAGE oneilsh/discovery-index
#TAG 0.1.0

FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

# override port variable to 443 to use ssl
ENV PORT=8000 
ENV NODE_ENV=production
RUN npm install

COPY . .

CMD ["npm", "run", "prod"]
