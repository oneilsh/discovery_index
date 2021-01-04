var { stdOutLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var hash = require('object-hash')

var basicAuth = require('express-basic-auth')

var { runCypher } = require('./lib/neo4j.js')
var { updateGithub } = require('./lib/gitHub.js')
var { updateOrcid } = require('./lib/orcid.js')
var { updateProfile, updateRelationships } = require('./lib/general.js')
var { orNa, getUser } = require('./lib/utils.js')


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



async function updateRelationshipsCanonical(primaryId, relationships) {
  // it seems pushing new items onto relationships while iterating over it
  // only iterates over the original set (rather than also covering
  // items added mid-loop). this seems kind of hacky though - if this werent the case
  // then hashes would be computed twice (once on add and once on later loop-over) with different results
  // TODO: should probably change this to just loop over original indices to avoid any ambiguity
  relationships.forEach( relationship => {
    if(relationship.repeat) {
      // using e.g. "for": "edge.properties.prop0"in the api would be nice; is there a _.set() that takes a path string? 
 
      // extract property path to set entries, value, split
      var property = relationship.repeat.property  // e.g. edge.properties.prop0
      var values = relationship.repeat.values       // e.g. "value_1, value_2, value_3"
      var splitChar = relationship.repeat.splitChar // e.g. ","
      // create canonical template as deep copy, deleting "repeat" entry
      var template = _.cloneDeep(relationship)
      delete template.repeat
      // for each entry in value split by split, create another canonical version from template and set property key to entry
      var valuesArray = values.split(splitChar)
      valuesArray.forEach(value => {
        var newRelationship = _.cloneDeep(template)
        _.set(newRelationship, property, value)
        // append new canonical version to relationships list
        newRelationship.edge.properties.hashId = hash(newRelationship.edge)
        newRelationship.target.properties.hashId = hash(newRelationship.target)
        relationships.push(newRelationship)
      })
    }

    relationship.edge.properties.hashId = hash(relationship.edge)
    relationship.target.properties.hashId = hash(relationship.target)
  })


  try {
    // after adding cononical reversions of "repeat"-type relationships, we only really add the canonical versions
    return updateRelationships(primaryId, _.filter(relationships, r => !r.repeat))
  } catch(e) {
    throw e
  }
}

// just an async function so we can await multiple calls and concatenate the results for return
// takes the request as given to express below
async function updateAll(req) {
  try {
    if(!req.body.relationships) { req.body.relationships = [] }
    var resultMap = {}
    console.log("updating primary...")
    // allow setting profile variables by entries prefixed by relationship_ (makes ingestion from qualtrics easier)

    resultMap.primaryResult = await updateProfile(req.body.primaryId, req.body.profile)
    resultMap.relationships = await updateRelationshipsCanonical(req.body.primaryId, req.body.relationships)
    
    if(req.body.githubId && req.body.githubId != "") {
      console.log("updating github...")
      resultMap.githubResult = await updateGithub(req.body.primaryId, req.body.githubId)
    }
    if(req.body.orcidId && req.body.orcidId != "") { 
      console.log("updating orcid...")
      resultMap.ordicResult = await updateOrcid(req.body.primaryId, req.body.orcidId) 
    }
 
    return req.body
  } catch(e) {
    throw e
  }
}


authRouter.post('/updateecho', function(req, res) {
  console.log(req.body)
  res.status(200).json(req.body)
})

authRouter.post('/updateuser', function(req, res) {
  if(req.body && req.body.primaryId && req.body.primaryId != "") {
    updateAll(req)
      .then(result => {console.log(result); res.status(200).json(result)})
      .catch(err => {console.log(err); res.status(400).json(err)})
 
 } else {
    console.log(req)
    res.status(400).json({err: "Error: must post json with body containing non-empty primaryId string. :-P"})
  }
})



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

