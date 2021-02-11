var { runCypher } = require('./neo4j.js')
var { doGet, orNa } = require('./utils.js')
var { deleteBySource } = require('./general.js')
var _ = require('lodash')


exports.updateOrcid = async function updateOrcid(primaryId, orcidId, diProject = "default") {
  try {
    // allow e.g. https://orcid.org/0000-0001-6220-7080/ (leading orcid.org/ and/or trailing /)
    var orcidId = orcidId.replace(/^.*?orcid.org\//,"").replace(/\/$/,"")

    var profile = await orcidPerson(orcidId)
    var works = await orcidWorks(orcidId)
    profile.works = works
    profile.primaryId = primaryId
    profile.diProject = diProject

    await deleteBySource(primaryId, "orcid", diProject)

    // create node if not exist
    var query = `
MERGE (o:OrcidProfile {orcid: $orcid})
SET o+=     {firstName: $firstName,
            lastName: $lastName,
            creditName: $creditName,
            bio: $bio,
            diProject: $diProject
          }
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
MERGE (o) -[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]-> (p)
MERGE (p) -[:HAS_SECONDARY_PROFILE {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]-> (o)
`

    await runCypher(query, profile)


    // merge in urls
    var query = `
MERGE (o:OrcidProfile {orcid: $orcid, diProject: $diProject})
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
WITH $urls as urls, o as o, p as p
 UNWIND urls as urlEntry
   MERGE (u:URL {title: urlEntry.title,
                 url: urlEntry.url,
                 source: 'orcid',
                 diProject: $diProject})
   MERGE (o)-[:HAS_URL {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(u)
   MERGE (u)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(p)
`
    await runCypher(query, profile)

    // merge in emails
    var query = `
MERGE (o:OrcidProfile {orcid: $orcid, diProject: $diProject})
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
WITH $emails as emails, o as o, p as p
 UNWIND emails as emailEntry
   MERGE (e:Email {email: emailEntry, diProject: $diProject})
   MERGE (o)-[:HAS_EMAIL {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(e)
   MERGE (e)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(p)
`

    await runCypher(query, profile)

    // merge in keywords
    var query = `
MERGE (o:OrcidProfile {orcid: $orcid, diProject: $diProject})
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
 WITH $keywords as keywords, o as o, p as p
 UNWIND keywords as keywordEntry
   MERGE (k:Keyword {keyword: keywordEntry, diProject: $diProject})
   MERGE (o)-[:HAS_KEYWORD {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(k)
   MERGE (k)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(p)
`

    await runCypher(query, profile)

    // merge in works
    // TODO: workEntry.url should be a URL node
    var query = `
MERGE (o:OrcidProfile {orcid: $orcid, diProject: $diProject})
MERGE (p:PrimaryProfile {primaryId: $primaryId, diProject: $diProject})
WITH $works as works, o as o, p as p
 UNWIND works as workEntry
   MERGE (w:Work {title: workEntry.title,
                  journalTitle: workEntry.journalTitle,
                  url: workEntry.url,
                  type: workEntry.type,
                  year: workEntry.pubYear,
                  month: workEntry.pubMonth,
                  day: workEntry.pubDay,
                  diProject: $diProject
          })
   MERGE (o)-[:HAS_WORK {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(w)
   MERGE (w)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(p)
   WITH workEntry, o, w, p
     UNWIND workEntry.externalIds as externalId
       MERGE (eid:ExternalId {type: externalId.type,
                              id: externalId.id,
                              diProject: $diProject
                              })
       MERGE (w)-[:HAS_EXTERNAL_ID {source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(eid)
       MERGE (eid)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'orcid', primaryId: $primaryId, diProject: $diProject}]->(p)
`



    await runCypher(query, profile)

    return profile
  } catch(e) {
    throw e
  }
}


async function orcidPerson(orcidId, onResult, onError = console.error) {
  var headers = {"Content-Type": "application/json",
              "Accept": "application/orcid+json"}
  try {
    var result = await doGet("https://pub.orcid.org/v3.0/" + orcidId + "/person", headers)
    result = result.data

    var record = {'orcid': orcidId}
    // using []-syntax as hyphens aren't suppored with .-syntax
    record.firstName = orNa(result, "name.given-names.value")

    record.lastName = orNa(result, "name.family-name.value")
    record.creditName = orNa(result, "name.credit-name.value")
    record.bio = orNa(result, "biography.content")
    record.urls = []

    result['researcher-urls']['researcher-url'].forEach(function(entry) {
      var urlMap = {}
      urlMap.title = orNa(entry, "url-name")
      urlMap.url = orNa(entry, "url.value")
      record.urls.push(urlMap)
    })

    record.emails = []
    result.emails.email.forEach(function(entry) {
      record.emails.push(entry.email)
    })

    record.keywords = []
    result.keywords.keyword.forEach(function(entry) {
      // TODO: parse keyword info
      record.keywords.push(entry.content)
    })

    record.externalIds = []
    var externalIds = result['external-identifiers']['external-identifier'] || []
    externalIds.forEach(function(entry) {
      var idMap = {}
      idMap.type = orNa(entry, 'external-id-type')
      idMap.value = orNa(entry, 'external-id-value')
      idMap.url = orNa(entry, 'external-id-url.value')
      record.externalIds.push(idMap)
    })

    return record
  } catch(e) {
    throw e
  }
}

// on_result is called on the processed result from orcid (a list of records)
async function orcidWorks(orcidId) {
  var headers = {"Content-Type": "application/json",
              "Accept": "application/orcid+json"}

  try {
    var result = await doGet("https://pub.orcid.org/v3.0/" + orcidId + "/works", headers)
    var records = []

    result.data.group.forEach(function(entry) {
      var workMap = {}
      workMap.externalIds = []
      entry['external-ids']['external-id'].forEach(function(extId) {
        workMap.externalIds.push({'type': extId['external-id-type'], 'id': extId['external-id-value']})
      })

      var mainSummary = entry['work-summary'][0]

      workMap.title = orNa(mainSummary, "title.title.value")
      // TODO: subtitle?
      //workMap.journalTitle = _.get(mainSummary, 'journal-title.value', null)
      workMap.journalTitle = orNa(mainSummary, 'journal-title.value')
      workMap.type = orNa(mainSummary, 'type')
      workMap.url = orNa(mainSummary, 'url.value')

      workMap.pubYear = orNa(mainSummary, 'publication-date.year.value')
      workMap.pubMonth = orNa(mainSummary, 'publication-date.month.value')
      workMap.pubDay = orNa(mainSummary, 'publication-date.month.day')

      records.push(workMap)
    })

    return records
  } catch(e) {
    throw e
  }
}
