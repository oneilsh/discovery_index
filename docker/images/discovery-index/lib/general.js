var { runCypher } = require('./neo4j.js')
var hash = require('object-hash')
var _ = require('lodash')

// profile should be a simple map of scalars and primaryId a scalar, e.g. primaryId = 123456, profile = {age: 37, name: "Shawn"}
exports.updateProfile = async function(primaryId, profile) {
  try {
    // SET overwrites every field in the created/matched node, including primaryId, so it needs to be part of the profile itself
    // (even though the signature of this function is desiged to make primaryId a seperate parameter)

    profile.diProject = profile.diProject || "default"
    profile.primaryId = primaryId
    var params = {"primaryId": primaryId, "profile": profile}
    var query = `
MERGE (p:PrimaryProfile {primaryId: $primaryId})
SET p = $profile
RETURN p
`

    var result = await runCypher(query, params)
    return profile
  } catch(e) {
    throw e
  }
}

deleteBySource = exports.deleteBySource = async function(primaryId, source, diProject = "default") {
  try {
    var params = {"primaryId": primaryId, "source": source, "diProject": diProject}

    // delete all relationships with the given source and primaryId
    // then find all nodes without an ASSOC_PRIMARY relationship to a primary profile and delete them
    var query = `
MATCH (s) -[r {source: $source, primaryId: $primaryId, diProject: $diProject}]-> (t)
DELETE r
WITH r as r
  MATCH (n {diProject: $diProject}) WHERE
  NOT (n) -[:ASSOC_PRIMARY]-> (:PrimaryProfile) AND
  NOT (n:PrimaryProfile)
  DETACH DELETE n
`
    console.log("Removing relationships and nodes for primaryId " + primaryId + " from source " + source + " in project " + diProject)
    await runCypher(query, params)

  } catch(e) {
    throw(e)
  }
}

async function updateRelationshipsCanonical(primaryId, relationships, edgeLabel = "GENERIC_RELATIONSHIP", nodeLabels = "GENERIC_NODE", diProject = "default") {
  try {
    var params = {"primaryId": primaryId, "relationships": relationships, "diProject": diProject}

    /*
    The hashId and this merge, set, merge, set strategy allow for filling properties from an object (w/ set) but
    creating a new relationship or node where needed by merging on the hashId which summarizes all of the object info
    */
    var query = `
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
WITH $primaryId AS primaryId, $relationships AS relationships, p as p, $diProject as diProject
 UNWIND relationships AS relationship
   MERGE (t:${nodeLabels} {hashId: relationship.target.properties.hashId})
   SET t = relationship.target.properties
   SET t.diProject = diProject
   WITH relationship, p, t, primaryId, diProject
     MERGE (p) -[r:${edgeLabel} {hashId: relationship.edge.properties.hashId}]-> (t)
     MERGE (t) -[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: relationship.source, primaryId: primaryId, diProject: diProject}]-> (p)
     SET r = relationship.edge.properties
     SET r.source = relationship.source
     SET r.primaryId = primaryId
     SET r.diProject = diProject
     `

    var result = await runCypher(query, params)
    return relationships

  } catch(e) {
    throw(e)
  }
}

// should get JSON body matching update_relationship schema
// required: primaryId, source, edge.label, target.labels
// optional: repeat, convert, clearFirst, diProject, ignoreIfAnyEmpty, edge.style, target.style
//   target.properties.diStyle and edge.properties.diStyle if defined should be objects e.g. {color: "#a4cc54", title: "hovertext here", label: "Display Name", ...}
//   where keys are config options defined by vizNetwork (https://datastorm-open.github.io/visNetwork/nodes.html and https://datastorm-open.github.io/visNetwork/edges.html)
//   we store them as JSON string in the db
exports.updateRelationshipFromApi = async function(relationship) {
  try {
    relationship.diProject = _.get(relationship, "diProject", "default")

    if(relationship.clearFirst) {
      await deleteBySource(relationship.primaryId, relationship.source, relationship.diProject)
    }
    var ignoreIfAnyEmpty = []
    if(relationship.ignoreIfAnyEmpty) {
      ignoreIfAnyEmpty = relationship.ignoreIfAnyEmpty
    }

    // make sure properties exists at least even if empty
    relationship.target.properties = _.get(relationship, "target.properties", {})
    relationship.edge.properties = _.get(relationship, "edge.properties", {})

    // convert diStyle objects to string for DB storage
    if(relationship.target.properties.diStyle) { relationship.target.properties.diStyle = JSON.stringify(relationship.target.properties.diStyle)}
    if(relationship.edge.properties.diStyle) { relationship.edge.properties.diStyle = JSON.stringify(relationship.edge.properties.diStyle)}

    canonicalRelationships = []

    if(relationship.repeat) {
      // extract property path to set entries, value, split
      var property = relationship.repeat.property  // e.g. edge.properties.prop0
      var values = _.get(relationship, property, null)       // e.g. "value_1, value_2, value_3"
      if(!values) {throw({"error": property + " is not a valid path in input.", "input": relationship})}

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

    canonicalRelationships.forEach(relationship => {
      if(relationship.convert) {
        for(path in relationship.convert) {
          var value = _.get(relationship, path, null)
          if(!value) {throw({"error": property + " is not a valid path in input.", "input": relationship})}

          var targetType = relationship.convert[path]
          if(targetType == "integer") {
            _.set(relationship, path, parseInt(value))
          } else if(targetType == "float") {
            _.set(relationship, path, parseFloat(value))
          }
        }
        delete relationship.convert
      }

      relationship.edge.properties.hashId = hash(relationship.edge)
      relationship.target.properties.hashId = hash(relationship.target)
    })

    canonicalRelationships = canonicalRelationships.filter(rel => {
      var ok = true
      for(var i = 0; i < ignoreIfAnyEmpty.length; i++) {
        var checkPath = ignoreIfAnyEmpty[i]
        var relValue = _.get(rel, checkPath, "")
        if(relValue == "") { ok = false }
      }
      return ok
    })

    var edgeLabel = relationship.edge.label
    var nodeLabels = relationship.target.labels.join(":")
    return updateRelationshipsCanonical(relationship.primaryId, canonicalRelationships, edgeLabel, nodeLabels, relationship.diProject)

  } catch (e) {
    throw(e)
  }
}
