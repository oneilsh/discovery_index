// Example Usage:
/*

// API URL, username, and password to send data to
var POST_URL = "https://tehr-discovery-index-dev.cgrb.oregonstate.edu/admin/";
var API_USER = "admin"
var API_PASSWORD = "somepassword"


// project name - all data will be isolated from other projects via this project name 
var PROJECT = "tislab-demo"

// for use in deleting data associated with a prior submission for this form via clearExistingFormData() below
var FORM_SOURCE = "demo-form1"

FormApp.getActiveForm()
eval(UrlFetchApp.fetch('https://tehr-discovery-index-dev.cgrb.oregonstate.edu/static/appsScript/script.js').getContentText())


function onSubmit(e) {
    // get questions containing (ID: Something) in the description, make them indexable by "Something"
    var questions = getQuestionsByIds()

    // get the response text for questions with these IDs
    var name = questions["Name"].response
    var orcid = questions["ORCiD"].response
    var github = questions["GitHub"].response

    // we'll use github ID as primary ID for data submitted
    var primaryId = github

    // delete existing data from this form for the given primaryId
    clearExistingFormData(primaryId)

    // Add data to the main Profile
    // "name" is special and is used in the display of the primary profile
    updateProfile(primaryId, "name", name)
    updateProfile(primaryId, "orcid_id", orcid)
    updateProfile(primaryId, "github_username", github)


    // grab data from github and orcid IDs, associating it with the given primaryId
    updateGithub(primaryId, github)
    updateOrcid(primaryId, orcid)

    // create a new node via a basic text response (could be a short answer, long answer, dropdown, radio button, date, or time)
    options = { 
                edgeType: "IN_TIMEZONE",
                nodeType: "Timezone", 
                edgeStyle: {label: "In"},
                nodeStyle: {label: "Timezone: ${response}"}
              }
    formTextItemToNode(primaryId, questions["Timezone"], options)


    // Checkbox lists are treated as repeated basic text entries; a node is created for each response
    options = { 
                edgeType: "HAS_SKILL",
                nodeType: "Skill", 
                edgeStyle: {label: "Has", color: "darkgreen"},
                nodeStyle: {label: "Skill: ${response}"}
              }
    formCheckboxesToNodes(primaryId, questions["HaveSkills"], options)


    options = { 
                edgeType: "WANTS_SKILL",
                nodeType: "Skill", 
                edgeStyle: {color: "darkred"},
                nodeStyle: {label: "Skill: ${response}"}
              }
    formCheckboxesToNodes(primaryId, questions["NeedSkills"], options)

    // for numeric scales, we can get the response and use it in a new node based on a simple text input
    // but we style the edge using the numeric value given (setting "value" which sets edge width in visNetwork, the plotting library)
    ice_cream_value = questions["IceCream"].response
    options = { 
                edgeType: "LIKES",
                nodeType: "Food", 
                edgeStyle: {value: ice_cream_value},
                nodeStyle: {label: "Food: Ice Cream", title: "Ice Cream"},
                nodeProperties: {foodName: "Ice Cream"},
                edgeProperties: {value: ice_cream_value},
              }
    formTextItemToNode(primaryId, questions["IceCream"], options)


    // for grid items (checkbox or radio buttons), we create a node for each selection
    // for each selection we have access to the row_text and column_text of the selection
    options = { 
            edgeType: "PARTICIPATES_IN_PROJECT",
            nodeType: "Project", 
            edgeStyle: {label: "${column_text}", title: "Role: ${column_text}"},
            nodeStyle: {label: "Project: ${row_text}", title: "${row_text}"},
            nodeProperties: {projectName: "${row_text}"},
            edgeProperties: {projectRole: "${column_text}"},
          }
    formGridToNodes(primaryId, questions["ProjectRoles"], options)

};


*/



// set payload with JSON.stringify()
var POST_OPTIONS = {
    "method": "post",
    "contentType": "application/json",      
    "headers": {Authorization: "Basic " + Utilities.base64Encode(API_USER + ":" + API_PASSWORD)},
    "muteHttpExceptions": true
};


function formCheckboxesToNodes(primaryId, 
                    formResponse, 
                    {edgeType, nodeType, edgeStyle, nodeStyle, edgeProperties, nodeProperties} = {}) {

  var responses = formResponse.getResponse()
  for(var i = 0; i < responses.length; i++) {
    var options = {primaryId: primaryId,
                  response_text: responses[i],
                  title: formResponse.getItem().getTitle(),
                  help_text: formResponse.getItem().getHelpText(),
                  edgeType: edgeType,
                  nodeType: nodeType,
                  edgeStyle: edgeStyle,
                  nodeStyle: nodeStyle,
                  edgeProperties: edgeProperties,
                  nodeProperties: nodeProperties}

  textToNode(options)

  }
}

// we just treat checkbox lists as a set of basic text entries; options are the same
function formCheckboxesToNodes(primaryId, 
                    formResponse, 
                    options = {}) {
  options = mergeDeep(default_textItemProperties, options)
  for(var i = 0; i < formResponse.response.length; i++) {
    var response_text = formResponse.response[i]
    var new_resp = {title: formResponse.title, help_text: formResponse.help_text, response: response_text}
    formTextItemToNode(primaryId, new_resp, options)
  }
}


function formGridToNodes(primaryId, formResponse, options = {}) {
    options = mergeDeep(default_gridItemProperties, options)

    validateAlphaNumericUnderscore(options.edgeType)
    validateAlphaNumericUnderscore(options.nodeType)

    var data = {primaryId: primaryId,
        edge: {label: options.edgeType, 
                properties: options.edgeProperties
                },
        target: {labels: [options.nodeType],
                  properties: options.nodeProperties
                },
        }

  data.edge.properties.diStyle = options.edgeStyle
  data.target.properties.diStyle = options.nodeStyle
  
  for(var i = 0; i < formResponse.rowLabels.length; i++) {
    var row_text = formResponse.rowLabels[i]
    var col = formResponse.response[i]
    // col will be null if no entries are available for the row
    if(col) {
      if(formResponse.type == "grid") {
        data2 = deepInterpolate(data, {title: formResponse.title, help_text: formResponse.help_text, column_text: col, row_text: row_text})
        addRelationships(data2)
      } else if(formResponse.type == "checkboxGrid") {
        for(var k = 0; k < col.length; k++) {
          data2 = deepInterpolate(data, {title: formResponse.title, help_text: formResponse.help_text, column_text: col[k], row_text: row_text})
          addRelationships(data2)
        }
      }
    }
    
  }

}

default_textItemProperties = {
  edgeType: "AnsweredQuestion",
  nodeType: "Answer",
  edgeStyle: {label: "", title: "<h3>${title}</h3><p>${help_text}</p><p>Response: ${response}</p>", length: 200, 'font.size': 18},
  nodeStyle: {label: "", title: "${response}", size: 30, 'font.size': 18},
  nodeProperties: {"response": "${response}"},
  edgeProperties: {}
}

default_gridItemProperties = {
  edgeType: "AnsweredQuestion",
  nodeType: "Answer",
  edgeStyle: {label: "", title: "<h3>${title}</h3><p>${help_text}</p><p>Response: ${row_text}/${column_text}</p>", length: 200, 'font.size': 18},
  nodeStyle: {label: "", title: "${row_text}", size: 30, 'font.size': 18},
  nodeProperties: {},
  edgeProperties: {}
}


function formTextItemToNode(primaryId, 
                    formResponse, 
                    options = {}) {
  options = mergeDeep(default_textItemProperties, options)

  validateAlphaNumericUnderscore(options.edgeType)
  validateAlphaNumericUnderscore(options.nodeType)

  var data = {primaryId: primaryId,
      edge: {label: options.edgeType, 
              properties: options.edgeProperties
              },
      target: {labels: [options.nodeType],
                properties: options.nodeProperties
              },
      }

  data.edge.properties.diStyle = options.edgeStyle
  data.target.properties.diStyle = options.nodeStyle

  data = deepInterpolate(data, {response: formResponse.response, title: formResponse.title, help_text: formResponse.help_text})

  addRelationships(data)
}



function updateProfile(primaryId, key, value) {
   var data = {primaryId: primaryId, profile: {}, diProject: PROJECT}
   data.profile[key] = value
   POST_OPTIONS.payload = JSON.stringify(data)
    
    Logger.log(POST_OPTIONS)
    var result = UrlFetchApp.fetch(POST_URL + "update_profile", POST_OPTIONS)
    Logger.log(result)
}



function updateOrcid(primaryId, orcid) {
   var data = {primaryId: primaryId, orcidId: orcid, diProject: PROJECT}
   POST_OPTIONS.payload = JSON.stringify(data)
    
    Logger.log(POST_OPTIONS)
    var result = UrlFetchApp.fetch(POST_URL + "update_orcid", POST_OPTIONS)
    Logger.log(result)
}

function updateGithub(primaryId, github) {
   var data = {primaryId: primaryId, username: github, diProject: PROJECT}
   POST_OPTIONS.payload = JSON.stringify(data)
    
    Logger.log(POST_OPTIONS)
    var result = UrlFetchApp.fetch(POST_URL + "update_github", POST_OPTIONS)
    Logger.log(result)
}




function clearExistingFormData(primaryId) {
  var data = {primaryId: primaryId,
              source: FORM_SOURCE,
              diProject: PROJECT
              }

  POST_OPTIONS.payload = JSON.stringify(data)

  Logger.log(POST_OPTIONS)
  var result = UrlFetchApp.fetch(POST_URL + "delete_source", POST_OPTIONS)
  Logger.log(result)
}


// the "raw" API
function addRelationships(data) {
  data.diProject = PROJECT
  data.source = FORM_SOURCE
  POST_OPTIONS.payload = JSON.stringify(data)

  Logger.log(POST_OPTIONS)
  var result = UrlFetchApp.fetch(POST_URL + "update_relationship", POST_OPTIONS)
  Logger.log(result)
}




/////////// UTILS


String.prototype.interpolate = function(params) {
  const names = Object.keys(params);
  const vals = Object.values(params);
  return new Function(...names, `return \`${this}\`;`)(...vals);
}


deepInterpolateMutating = function(obj, settings) {
  // falsy things are base cases, nothing to do
  if(!obj) {return obj}
  // the interesting base case
  if(typeof obj == "string") {
    return obj.interpolate(settings)
  }

  // this identifies primitive types, also base cases (https://stackoverflow.com/a/31538091)
  if(obj !== Object(obj)) { return obj }

  // ok, recurse
  for(var key in obj) {
    obj[key] = deepInterpolateMutating(obj[key], settings)
  }

  return obj
}

deepInterpolate = function(obj, settings) {
  // falsy things are base cases, nothing to do
  if(!obj) {return obj}
  // the interesting base case
  if(typeof obj == "string") {
    return obj.interpolate(settings)
  }

  // cheater deep copy
  var objCopy = JSON.parse(JSON.stringify(obj));
  return deepInterpolateMutating(objCopy, settings)
}


function validateAlphaNumericUnderscore(input) {
  console.log("Validating alphanumericness for " + JSON.stringify(input))
  if(input.match(/^[A-Za-z0-9_]+$/)) {
    return true
  } else {
    throw "Error: input '" + input + "' can only contain letters, numbers, and underscores, and must be non-empty."
  }
}




// https://stackoverflow.com/a/37164538
// base case: if(stack overflow answer) use stack overflow answer
// recursive case: sleep 60*60*24; check stack overflow()
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item))
}
function mergeDeep(target, source) {
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = mergeDeep(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}


function getQuestionsByIds() {
    var form = FormApp.getActiveForm();
    var allResponses = form.getResponses();
    var latestResponse = allResponses[allResponses.length - 1];
    var responses = latestResponse.getItemResponses();

    result = {}

    for(var i = 0; i < responses.length; i++) {
      var response = responses[i]
      var help_text = response.getItem().getHelpText()
      var match = help_text.match(/\(ID: (\w+)\)/)
      if(match) {
        var id = match[1]
        result[id] = {response: response.getResponse(), 
                      title: response.getItem().getTitle(), 
                      help_text: response.getItem().getHelpText(),
                      type: "text"}
        if(response.getItem().getType() == FormApp.ItemType.GRID) {
          result[id].type = "grid"
          result[id].rowLabels = response.getItem().asGridItem().getRows()
        } else if(response.getItem().getType() == FormApp.ItemType.CHECKBOX_GRID) {
          result[id].type = "checkboxGrid"
          result[id].rowLabels = response.getItem().asCheckboxGridItem().getRows()
        }
      }
    }

    return result
}



