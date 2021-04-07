var axios = require('axios')

exports.runCypher = async function runCypher(query, params, endpoint = process.env.NEO_4J_ENDPOINT || "http://localhost:7474/db/data/cypher") {
  var payload = {"query": query, "params": params}
  var userPass = Buffer.from(process.env.NEO4J_USER + ':' + process.env.NEO4J_PASS).toString('base64')
  var head = {"Authorization" : "Basic " + userPass,
              "Content-Type": "application/json",
              "Accept": "application/json"}
  try {
    var result = await axios.post(endpoint, payload, {headers: head})
    return result
  } catch(e) {
    throw e
  }
}
