var { stdOutLogger, adminRequestLogger } = require('./lib/logger')
var logger = stdOutLogger

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')
var path = require('path')
var _ = require('lodash')

var basicAuth = require('express-basic-auth')
var validate = require('jsonschema').validate;

var { runCypher } = require('./lib/neo4j.js')
var { updateGithub } = require('./lib/gitHub.js')
var { updateOrcid } = require('./lib/orcid.js')
var { updateProfile, updateRelationships, deleteBySource, updateRelationshipFromApi, getNodesByLabel} = require('./lib/general.js')
var { orNa, getUser } = require('./lib/utils.js')


var { createProxyMiddleware } = require('http-proxy-middleware')

// proxy middleware options
const options = {
  target: 'http://rshiny:3838', // target host
  changeOrigin: true, // needed for virtual hosted sites
  autoRewrite: false,
  ws: true, // proxy websockets
  logLevel: 'info',
  pathRewrite: {
    '^/dashboard': '', // remove base path
  }
}

app.use('/dashboard', createProxyMiddleware(options))


// TODO: drop usage of backpointers in favor of explicit searching for nodes without paths to
// PrimaryProfile nodes via technique at https://stackoverflow.com/questions/27778120/neo4j-cypher-search-for-nodes-with-no-path-between-them


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
  app.use('/admin', basicAuth({users: user_pass_map, 
                               unauthorizedResponse: req => {
                                 return {result: "authError", auth: req.auth}
                               }
                             }), authRouter)
}



// call this function for every request; if it sees application/json, it parses it and stores it in the req object before continuing on
app.use(bodyParser.json())
authRouter.use(bodyParser.json())

// basic logging - call logger middleware regardless of method; it calls next() to pass process on to the next middlewares
// note the location: after authRouter.use(bodyParser.json()) (so that the logger has access to req.body as JSON)
authRouter.use(adminRequestLogger)

// access files in static/ via /static/filename
// __dirname is the location of this file
app.use('/static', express.static(path.join(__dirname, 'static')))


// make sure there's an uniqueness constraing on PrimaryProfile nodes' primaryId field.
// first arg: indices to created
// second arg: uniqueness constraints to create (also creates an index)
// third arg: whether to delete existing constraints first
runCypher(`CALL apoc.schema.assert(
  {},
  {PrimaryProfile:['primaryId'],
   OrcidProfile:['orcid'],
   GitHubProfile:['username']
 },
  false
) `, {})
  .then(res => console.log("Constraints created (if necessary) successfully."))
  .catch(res => { console.log("Error creating constraints: "); console.log(res) })



///////////////////////////////////////
//     UPDATE RELATIONSHIP VIA API
///////////////////////////////////////

var update_relationship_schema = JSON.parse(fs.readFileSync('./static/schemas/update_relationship.json'))

authRouter.post('/update_relationship', function(req, res) {
  var validate_result = validate(req.body, update_relationship_schema)
  if(validate_result.valid) {
    updateRelationshipFromApi(req.body) // inconsistent w/ others
      .then(result => { res.status(200).json(result) })
      .catch(result => { res.status(400).json(result) })

  } else {
    res.status(400).json({ "jsonschemaError": validate_result })
  }

})

///////////////////////////////////////
//     UPDATE GITHUB
///////////////////////////////////////

var update_github_schema = JSON.parse(fs.readFileSync('./static/schemas/update_github.json'))

authRouter.post('/update_github', function(req, res) {
  var validate_result = validate(req.body, update_github_schema)
  if(validate_result.valid) {
    updateGithub(req.body.primaryId, req.body.username, _.get(req, "body.diProject", "default"))
      .then(result => {res.status(200).json(result)})
      .catch(result => {console.log(result); res.status(400).json(result)})

  } else {
    res.status(400).json({ "jsonschemaError": validate_result })
  }

})

///////////////////////////////////////
//     UPDATE ORCID
///////////////////////////////////////

var update_orcid_schema = JSON.parse(fs.readFileSync('./static/schemas/update_orcid.json'))

authRouter.post('/update_orcid', function(req, res) {
  var validate_result = validate(req.body, update_orcid_schema)
  console.log("ORCID REQUEST")
  console.log(req.body)
  if(validate_result.valid) {
    updateOrcid(req.body.primaryId, req.body.orcidId, _.get(req, "body.diProject", "default"))
      .then(result => {console.log({"result": result}); res.status(200).json(result)})
      .catch(result => {console.log({"result": result}); res.status(400).json(result)})

  } else {
    console.log({ "jsonschemaError": validate_result })
    res.status(400).json({ "jsonschemaError": validate_result })
  }

})

///////////////////////////////////////
//     UPDATE PROFILE
///////////////////////////////////////

var update_profile_schema = JSON.parse(fs.readFileSync('./static/schemas/update_profile.json'))

authRouter.post('/update_profile', function(req, res) {
  var validate_result = validate(req.body, update_profile_schema)
  if(validate_result.valid) {
    // this is confusing: the api is {primaryId: "somebody", diProject: "myProject", profile: {"Name": "Joe Schmoe", Age: 39}}
    // but we put the diProject into the profile since in the call SET is used to set all properties at once from the profile
    req.body.profile.diProject = _.get(req, "body.diProject", "default")
    updateProfile(req.body.primaryId, req.body.profile)
      .then(result => {res.status(200).json(result)})
      .catch(result => {res.status(400).json(result)})

  } else {
    res.status(400).json({ "jsonschemaError": validate_result })
  }

})


///////////////////////////////////////
//     DELETE SOURCE
///////////////////////////////////////

var delete_source_schema = JSON.parse(fs.readFileSync('./static/schemas/delete_source.json'))

authRouter.post('/delete_source', function(req, res) {
  var validate_result = validate(req.body, delete_source_schema)
  if(validate_result.valid) {
    if(!req.body.clearFirst) { req.body.clearFirst = false }
    if(!req.body.diProject) { req.body.diProject = "default" }
    deleteBySource(req.body.primaryId, req.body.source, req.body.diProject)
      .then(result => {res.status(200).json(result)})
      .catch(result => {res.status(400).json(result)})

  } else {
    res.status(400).json({ "jsonschemaError": validate_result })
  }

})


var get_nodes_schema = JSON.parse(fs.readFileSync('./static/schemas/get_nodes.json'))

app.get('/public/nodes', function(req, res) {
  var validate_result = validate(req.query, get_nodes_schema)

  if(validate_result.valid) {
    getNodesByLabel(req.query.label, req.query.diProject || "default")
    .then(result => {res.status(200).json(result)})
    .catch(result => {res.status(400).json(result)})
  } else {
    res.status(400).json({ "jsonschemaError": validate_result })
  }
})



// debugs & tests
authRouter.post('/echo', function(req, res) {
  res.status(200).json(req.body)
})

/*
app.get('/user/:primaryId', function(req, res) {
  var primaryId = req.params.primaryId
  getUser(primaryId)
    .then(result => {res.status(200).json(result)})
    // TODO: don't return raw errors - can leak info (especially basic auth info in headers)
    .catch(err => {res.status(400).json(err)})

})
*/

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
