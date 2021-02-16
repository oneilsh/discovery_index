var simplelogger = require('simple-node-logger').createSimpleLogger("/var/log/discovery_index_requests.txt");

exports.stdOutLogger = function(req, res, next) {
  console.log("== Request received:")
  console.log("  - Method: ", req.method)
  console.log("  - URL: ", req.url)

  next()
}


exports.requestLogger = function(req, res, next) {
  simplelogger.info(req.body)
  next()
}
