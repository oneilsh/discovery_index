var { runCypher } = require('./neo4j.js')

// profile should be a simple map of scalars and primaryId a scalar, e.g. primaryId = 123456, profile = {age: 37, name: "Shawn"}
exports.updatePrimaryId = async function(primaryId, profile) {
  try {
    // SET overwrites every field in the created/matched node, including primaryId, so it needs to be part of the profile itself
    // (even though the signature of this function is desiged to make primaryId a seperate parameter)
    profile.primaryId = primaryId
    var params = {"primaryId": primaryId, "profile": profile}
    var query = "MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 SET p = $profile \
                 RETURN p "
    //console.log("Running cypher: " + query) 
    var result = await runCypher(query, params)
    return profile
  } catch(e) {
    throw e
  }
}
