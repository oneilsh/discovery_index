var { runCypher } = require('./neo4j.js')
var axios = require('axios')
var _ = require('lodash')


exports.getUser = async function(id) {
  var query = "MATCH (p:PrimaryProfile {primaryId: $primaryId}) -[r]-> (s) return p, r, s"
  var params = {primaryId: id}
  try {
    var result = await runCypher(query, params)
    return result.data
  } catch(e) {
    throw e
  }
}


// usage: 
// test = {a: 1, b: null}
// orNa(test, "a") returns 1
// orNa(test, "b") return "NA"
// orNa(test, "nokey") return "NA"
// orNa(test, "nokey.something-else") return "NA" (this is the case using lodash for)
exports.orNa = function(x, path) {
 var res = _.get(x, path, "NA") || "NA"
 return res
}

exports.doGet = async function(url, head = {}) {
  try {
    var result = await axios.get(url, {headers: head})
    return result;
  } catch(err) {
    throw err
  }
}
