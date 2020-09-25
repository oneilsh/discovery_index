var { stdOutLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')

var { runCypher } = require('./lib/neo4j.js')
var { octokit } = require('./lib/gitHub.js')


// basic logging - call logger middleware regardless of method; it calls next() to pass process on to the next middlewares
app.use(logger)

// call this function for every request; if it sees application/json, it parses it and stores it in the req object before continuing on
app.use(bodyParser.json())




// next is optional?
app.post('/newuser', function(req, res) {
  // ensure the body has been parsed from JSON and there's a username attached
  if(req.body && req.body.username) {
    var query = "CREATE (n:Person { username : $username }) RETURN n"
    var params =  {"username": req.body.username}
    
    runCypher(query, 
              params, 
              resp => {
                res.status(200).json(resp)
              }, err => {
                res.status(400).json(err)
                console.error("Cypher query error: ")
                console.error(err)
              })

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
