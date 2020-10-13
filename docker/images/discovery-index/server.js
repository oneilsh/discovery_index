var { stdOutLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')

var basicAuth = require('express-basic-auth')

var { runCypher } = require('./lib/neo4j.js')
var { updateGithub } = require('./lib/gitHub.js')
var { updateOrcid } = require('./lib/orcid.js')
var { updatePrimaryId } = require('./lib/general.js')

var api_insecure = process.env.API_INSECURE || "false"
api_insecure = api_insecure === "true"

// create an express router to handle endpoints under /admin
// read admin username and password from vars
var authRouter = express.Router()
admin_user = process.env.API_ADMIN_USER || "admin"
admin_password = process.env.API_ADMIN_PASSWORD || "admin"
user_pass_map = {}
user_pass_map[admin_user] = admin_password
if(api_insecure) {
  app.use('/admin', authRouter)
} else {
  app.use('/admin', basicAuth({users: user_pass_map}), authRouter)
}

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

// just for testing basicAuth, under /admin/testing
authRouter.get('/testing', function(req, res) {
  res.status(200).json({result: "Hey that tickles!"})
})


authRouter.post('/updateuser', function(req, res) {
  
  if(req.body && req.body.primaryId) {
    updateAll(req)
      .then(result => {console.log(result); res.status(200).json(result)})
      .catch(err => {console.log(err); res.status(400).json(err)})
 
 } else {
    res.status(400).json({err: "Error: must post json with at least primaryId field."})
  }
})


// last resort if no previous route matched
app.use('*', function(req, res, next) {
  res.status(404).send({err: "The requested resource doesn't exist."})
})




/////////   Run main proces
var port = process.env.API_PORT || 443

if(api_insecure) {
  app.listen(port, function() {
    console.log("== Server is listening with http on port " + port)
  })

} else {
  var httpsServer = https.createServer({
    key: fs.readFileSync('git-crypt/certs/private.key'),
    cert: fs.readFileSync('git-crypt/certs/public.crt')
  }, app)

  httpsServer.listen(port, () => {
    console.log("== Server is listening with https on port " + port)
  })

}

