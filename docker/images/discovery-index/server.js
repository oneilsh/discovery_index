var logger = require('./logger')
var psJson = require('./package.json')
var express = require('express')
var bodyParser = require('body-parser')
var app = express()

if(!process.env.GITHUB_ACCESS_TOKEN) {
  console.log("Sorry, running this server requires GITHUB_ACCESS_TOKEN environment variable to be set.")
  process.exit(1)
}

var { Octokit } = require('@octokit/rest')
var octokit = new Octokit({
  userAgent: 'DiscoveryIndex ' + psJson.version,
  auth: process.env.GITHUB_ACCESS_TOKEN
})





// basic logging - call logger middleware regardless of method; it calls next() to pass process on to the next middlewares
app.use(logger)

// call this function for every request; if it sees application/json, it parses it and stores it in the req object before continuing on
app.use(bodyParser.json())

// next is optional?
app.post('/newuser', function(req, res) {
  // ensure the body has been parsed from JSON and there's a username attached
  if(req.body && req.body.username) {
    res.status(201).json({message: "Success, got username " + req.body.username,
                          version: psJson.version})
  } else {
    res.status(400).json({err: "Error: Request needs a JSON body with username field."})
  }
})



app.get('/github-user/:userID', function(req, res, next) {
  octokit.request('GET /users/' + req.params.userID)
    .then((data) => {
      console.log("teehee!")
      res.status(200).send(data)
    })
    .catch((err) => {
      res.status(404).send(err)
    })  
})

// last resort if no previous route matched
app.use('*', function(req, res, next) {
  res.status(404).send({err: "The requested resource doesn't exist."})
})

/////////   Run main proces
var port = 8000
if(process.env.PORT) {
  port = process.env.PORT
}

app.listen(port, function() {
  console.log("== Server is listening on port " + port)
})
