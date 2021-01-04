var { runCypher } = require('./neo4j.js')

// profile should be a simple map of scalars and primaryId a scalar, e.g. primaryId = 123456, profile = {age: 37, name: "Shawn"}
exports.updateProfile = async function(primaryId, profile) {
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

// for use in creating edge + target relationships to the primaryId node
// see expected relationships array in server.js updateRelationships
exports.updateRelationships = async function(primaryId, relationships) {
  try {
    var params = {"primaryId": primaryId, "relationships": relationships}
    /*
    The hashId and this merge, set, merge, set strategy allow for filling properties from an object (w/ set) but
    creating a new relationship or node where needed by merging on the hashId which summarizes all of the object info
    */
    var query = "MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 WITH $primaryId AS primaryId, $relationships AS relationships, p as p \
                   UNWIND relationships AS relationship \
                     MERGE (t:TARGET_TOPIC {hashId: relationship.target.properties.hashId}) \
                     SET t = relationship.target.properties \
                     WITH relationship as relationship, p as p, t as t \
                       MERGE (p) -[r:RELATES_TO {hashId: relationship.edge.properties.hashId}]-> (t) \
                       SET r = relationship.edge.properties"
    
    var result = await runCypher(query, params)
    return relationships 

  } catch(e) {
    throw(e)
  }
}
