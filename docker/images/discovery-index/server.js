var { stdOutLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')
var path = require('path')

var basicAuth = require('express-basic-auth')

var { runCypher } = require('./lib/neo4j.js')
var { updateGithub } = require('./lib/gitHub.js')
var { updateOrcid } = require('./lib/orcid.js')
var { updatePrimaryId } = require('./lib/general.js')
var { getUser } = require('./lib/utils.js')

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
authRouter.use(bodyParser.json())

// access files in static/ via /static/filename
// __dirname is the location of this file
app.use('/static', express.static(path.join(__dirname, 'static')))


// just an async function so we can await multiple calls and concatenate the results for return
// takes the request as given to express below
async function updateAll(req) {
  try {
    if(!req.body.profile) { req.body.profile = {} }
    var resultMap = {}
    console.log("updating primary...")
    // allow setting profile variables by entries prefixed by profile_ (makes ingestion from qualtrics easier)
    for(var param in req.body) {
      if(param.startsWith("profile_")) {
        var newParam = param.replace(/^profile_/, "")
        req.body.profile[newParam] = req.body[param]
      }
    }

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

app.get('/user/:primaryId', function(req, res) {
  var primaryId = req.params.primaryId
  getUser(primaryId)
    .then(result => {console.log(result); res.status(200).json(result)})
    // TODO: don't return raw errors - can leak info (especially basic auth info in headers)
    .catch(err => {console.log("um"); res.status(400).json(err)})
 
})

authRouter.post('/updateuser', function(req, res) {
  
  if(req.body && req.body.primaryId) {
    updateAll(req)
      .then(result => {console.log(result); res.status(200).json(result)})
      .catch(err => {console.log(err); res.status(400).json(err)})
 
 } else {
    console.log(req)
    res.status(400).json({err: "Error: must post json with at least primaryId field. :-P"})
  }
})


// last resort if no previous route matched
//app.use('*', function(req, res, next) {
//  res.status(404).send({err: "The requested resource doesn't exist."})
//})




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

