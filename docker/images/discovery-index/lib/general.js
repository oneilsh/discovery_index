var { runCypher } = require('./neo4j.js')
var hash = require('object-hash')
var _ = require('lodash')

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

exports.deleteBySource = async function(primaryId, source) {
  try {
    var params = {"primaryId": primaryId, "source": source}
    
    var query = "MATCH (t) -[r:ASSOC_PRIMARY {source: $source}]-> (p:PrimaryProfile {primaryId:$primaryId}) \
                DELETE r \
                WITH t as t \
                  MATCH (n) WHERE \
                  NOT (n) -[:ASSOC_PRIMARY]-> (:PrimaryProfile) AND \
                  NOT (n:PrimaryProfile) \
                  DETACH DELETE n"
    concole.log("Removing relationships and nodes for primaryId " + primaryId + " from source " + source)
    await runCypher(query, params)
  
  } catch(e) {
    throw(e)
  }
}

async function updateRelationshipsCanonical(primaryId, relationships) {
  try {
    var params = {"primaryId": primaryId, "relationships": relationships}
 
    /*
    The hashId and this merge, set, merge, set strategy allow for filling properties from an object (w/ set) but
    creating a new relationship or node where needed by merging on the hashId which summarizes all of the object info
    */
    var query = "MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 WITH $primaryId AS primaryId, $relationships AS relationships, p as p \
                   UNWIND relationships AS relationship \
                     MERGE (t:GENERIC_NODE {hashId: relationship.target.properties.hashId}) \
                     SET t = relationship.target.properties \
                     WITH relationship as relationship, p as p, t as t \
                       MERGE (p) -[r:GENERIC_RELATIONSHIP {hashId: relationship.edge.properties.hashId}]-> (t) \
                       MERGE (t) -[:ASSOC_PRIMARY {source: relationship.edge.properties.source}]-> (p) \
                       SET r = relationship.edge.properties"
    
    var result = await runCypher(query, params)
    return relationships 

  } catch(e) {
    throw(e)
  }
}

exports.updateRelationships = async function(primaryId, relationships) {
  // it seems pushing new items onto relationships while iterating over it
  // only iterates over the original set (rather than also covering
  // items added mid-loop). this seems kind of hacky though - if this werent the case
  // then hashes would be computed twice (once on add and once on later loop-over) with different results
  // TODO: should probably change this to just loop over original indices to avoid any ambiguity
  canonicalRelationships = []
  relationships.forEach( relationship => {
    if(relationship.repeat) {
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
        canonicalRelationships.push(newRelationship)
      })
    } else {
      canonicalRelationships.push(relationship)
    }
  })

  /* now for all canonical relationships, we want to produce a hashId as a uniqueifying value for proper merge based on the objects
     before we do so, we ensure each relationship has a minimum structure:
     relationship:
       source: DEFAULT
       edge: 
         properties: 
           type: DEFAULT 
       target: 
         properties:
           type: DEFAULT
  */

  canonicalRelationships.forEach(relationship => {
    // there's gotta be a nicer way to do this...
    relationship.source = _.get(relationship, "source", "DEFAULT")
    relationship.target = _.get(relationship, "target", {"properties": {"type": "DEFAULT"}})
    relationship.edge = _.get(relationship, "edge", {"properties": {"type": "DEFAULT"}})
    relationship.target.properties = _.get(relationship, "target.properties", {"type": "DEFAULT"})
    relationship.edge.properties = _.get(relationship, "edge.properties", {"type": "DEFAULT"})
    relationship.target.properties.type = _.get(relationship, "target.properties.type", "DEFAULT")
    relationship.edge.properties.type = _.get(relationship, "edge.properties.type", "DEFAULT")

    relationship.edge.properties.hashId = hash(relationship.edge)
    relationship.target.properties.hashId = hash(relationship.target)

    // expects e.g. relationship = {"convert": {"relationship.edge.properties.someProp": "integer"}}
    if(relationship.convert) {
      for(path in relationship.convert) {
        var value = _.get(relationship, path, null)
        var targetType = relationship.convert[path]
        if(targetType == "integer") {
          _.set(relationship, path, parseInt(value))
        } else if(targetType == "float") {
          _.set(relationship, path, parseFloat(value))
        }
      }

      delete relationship.convert
    }
  })

  try {
    // after adding cononical reversions of "repeat"-type relationships, we only really add the canonical versions
    return updateRelationshipsCanonical(primaryId, canonicalRelationships)
  } catch(e) {
    throw e
  }
}


