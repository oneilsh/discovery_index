var { stdOutLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')

var { runCypher } = require('./lib/neo4j.js')
var { updateGithub } = require('./lib/gitHub.js')
var { updateOrcid } = require('./lib/orcid.js')
var { updatePrimaryId } = require('./lib/general.js')

// updateOrcid("0000-0001-6220-7080").then(res => console.log(res)).catch(e => console.log(e))
// updateGithub("oneilsh").then(res => {console.log(res)}).catch(e => {})

// basic logging - call logger middleware regardless of method; it calls next() to pass process on to the next middlewares
app.use(logger)

// call this function for every request; if it sees application/json, it parses it and stores it in the req object before continuing on
app.use(bodyParser.json())

// just an async function so we can await multiple calls and concatenate the results for return
// takes the request as given to express below
async function updateAll(req) {
  try {
    if(!req.body.profile) { req.body.profile = {} }
    var resultMap = {}
    console.log("updating primary...")
    resultMap.primaryResult = await updatePrimaryId(req.body.primaryId, req.body.profile)
    
    if(req.body.githubId) {
      console.log("updating github...")
      resultMap.githubResult = await updateGithub(req.body.primaryId, req.body.githubId)
    }
    if(req.body.orcidId) { 
      console.log("updating orcid...")
      resultMap.ordicResult = await updateOrcid(req.body.primaryId, req.body.orcidId) 
    }
 
    return resultMap
  } catch(e) {
    throw e
  }
}

app.post('/updateuser', function(req, res) {
  if(req.body && req.body.primaryId) {
    updateAll(req)
      .then(result => {console.log(result); res.status(200).json(result)})
      .catch(err => {console.log(err); res.status(400).json(err)})
 
 } else {
    res.status(400).json({err: "Error: must post json with at least primaryId field."})
  }
})

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
 





// last resort if no previous route matched
app.use('*', function(req, res, next) {
  res.status(404).send({err: "The requested resource doesn't exist."})
})




/////////   Run main proces
var port = 443
if(process.env.PORT) {
  port = process.env.PORT
}

if(port != 443) {
  app.listen(port, function() {
    console.log("== Server is listening on port " + port)
  })

} else {
  var httpsServer = https.createServer({
    key: fs.readFileSync('git-crypt/certs/private.key'),
    cert: fs.readFileSync('git-crypt/certs/public.cert')
  }, app)

  httpsServer.listen(port, () => {
    console.log("== Server is listening with https on port " + port)
  })

}

