var simplelogger = require('simple-node-logger')
                       .createSimpleFileLogger({
                         logFilePath: "/var/log/discovery_index/admin_requests.txt",
                         timestampFormat:'YYYY-MM-DD_HH:mm:ss.SSS'
                       });
var _ = require('lodash')


exports.stdOutLogger = function(req, res, next) {
  console.log("== Request received:")
  console.log("  - Method: ", req.method)
  console.log("  - URL: ", req.url)

  next()
}


exports.adminRequestLogger = function(req, res, next) {
  headers_copy = _.cloneDeep(req.headers)
  if(headers_copy.authorization) { headers_copy.authorization = "REDACTED" }
  simplelogger.info({"method": req.method, "data": req.body, "url": req.url, "headers": headers_copy})
  next()
}
