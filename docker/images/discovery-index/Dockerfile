#for docker_build and docker_push scripts:

#IMAGE oneilsh/discovery-index
#TAG 0.1.0

FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

ENV NODE_ENV=production
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE ${PORT}

#ENV GITHUB_ACCESS_TOKEN=dummy
CMD ["npm", "start"]
