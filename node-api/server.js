var logger = require('./logger')
var psJson = require('./package.json')
var express = require('express')
var bodyParser = require('body-parser')
var app = express()

var { Octokit } = require('@octokit/rest')
var octokit = new Octokit({
  userAgent: 'DiscoveryIndex ' + psJson.version
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




// if GET is called on /
app.get('/', function(req, res, next){
  res.status(200).send("Why hello there ;)")
})

app.get('/user/:userID', function(req, res, next){
  console.log(req.params)
  res.status(200).send({message: "Got userId " + req.params.userID})
})

//app.get('/github-user/:userID', function(req, res, next) {
//  
//})

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
