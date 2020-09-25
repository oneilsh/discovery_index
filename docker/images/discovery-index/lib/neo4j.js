var axios = require('axios')

exports.runCypher = function(query, params, on_result, on_error, endpoint = "http://localhost:7474/db/data/cypher") {
  var payload = {"query": query, "params": params}
  var user_pass = Buffer.from(process.env.NEO4J_USER + ':' + process.env.NEO4J_PASS).toString('base64')
  var head = {"Authorization" : "Basic " + user_pass,
              "Content-Type": "application/json",
              "Accept": "application/json"}

  axios.post(endpoint, payload, {headers: head})
        .then(resp => on_result(resp.data))
        .catch(err => on_error(err))
}

