var psJson = require('../package.json')
var { runCypher } = require('./neo4j.js')
var { orNa } = require('./utils.js')
var { updateProfile, deleteBySource } = require('./general.js')

if(!process.env.GITHUB_ACCESS_TOKEN) {
  console.log("Sorry, running this server requires GITHUB_ACCESS_TOKEN environment variable to be set.")
  process.exit(1)
}

var { Octokit } = require('@octokit/rest')

var octokit = new Octokit({
  userAgent: 'DiscoveryIndex ' + psJson.version,
  auth: process.env.GITHUB_ACCESS_TOKEN
})

exports.updateGithub = async function(primaryId, username) {
  try {
    // it's ok if @ is included...
    var username = username.replace(/^@/, "")

    var record = await getUser(username)
		record.repos = await getRepos(username)
    record.primaryId = primaryId

    deleteBySource(primaryId, "github")

    // create node if not exist
    var query = `
MERGE (o:GithubProfile {username: $login})
SET o +=    {name: $name,
            company: $company,
            location: $location,
            followersCount: $followersCount,
            followingCount: $followingCount,
            createdAt: $createdAt
            }
MERGE (p:PrimaryProfile {primaryId: $primaryId})
MERGE (o) -[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'github', primaryId: $primaryId}]-> (p)
MERGE (p) -[:HAS_SECONDARY_PROFILE {source: 'github', primaryId: $primaryId}]-> (o)
WITH o, p, $blog AS blog, $primaryId AS primaryId
  CALL apoc.do.when(
  blog <> 'NA',
  "MERGE (u:URL {title: 'Blog', url: blog})
  MERGE (o) -[:HAS_URL {source: 'github', primaryId: primaryId}]-> (u)
  MERGE (u) -[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'github', primaryId: $primaryId}]-> (p)",
  "",
  {o: o, p: p, blog: blog, primaryId: primaryId}) YIELD value
RETURN o
`

    await runCypher(query, record)

    var query = `
MERGE (o:GithubProfile {username: $login})
MERGE (p:PrimaryProfile {primaryId: $primaryId})
WITH $followers as followers, o as o, p as p
 UNWIND followers as follower
   MERGE (f:GithubProfile {username: follower})
   MERGE (f)-[:FOLLOWS {source: 'github', primaryId: $primaryId}]->(o)
   MERGE (f)-[:ASSOC_PRIMARY{type: 'ASSOC_PRIMARY', source: 'github', primaryId: $primaryId}]->(p)
`

    await runCypher(query, record)

    var query = `
MERGE (o:GithubProfile {username: $login})
MERGE (p:PrimaryProfile {primaryId: $primaryId})
WITH $following as following, o as o, p as p
 UNWIND following as followed
   MERGE (f:GithubProfile {username: followed})
   MERGE (o)-[:FOLLOWS {source: 'github', primaryId: $primaryId}]->(f)
   MERGE (f)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'github', primaryId: $primaryId}]->(p)
`

    await runCypher(query, record)

    // TODO: organizations (why doesn't it return mine?)

    // TODO: need to not create NA entries for programming languages
    // (or other expected-to-be-shared nodes, it's mostly noise)

    var query = `
MERGE (o:GithubProfile {username: $login})
MERGE (p:PrimaryProfile {primaryId: $primaryId})
WITH $repos as repos, o as o, p as p
UNWIND repos as repo
   MERGE (r:GithubRepo {name: repo.name,
                        description: repo.description,
                        isFork: repo.isFork,
                        createdAt: repo.createdAt,
                        pushedAt: repo.pushedAt,
                        forksCount: repo.forksCount,
                        openIssuesCount: repo.openIssuesCount,
                        watchersCount: repo.watchersCount,
                        url: repo.url
                        })
   MERGE (o)-[:HAS_REPO {source: 'github', primaryId: $primaryId}]->(r)
   MERGE (r)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'github', primaryId: $primaryId}]->(p)
   WITH repo, o, p, r
   CALL apoc.do.when(
     repo.primaryLanguage <> 'NA',
     "MERGE (l:ProgrammingLanguage {name: repo.primaryLanguage})
     MERGE (r)-[:HAS_PROGRAMMING_LANGUAGE {role: 'primary language', source: 'github', primaryId: primaryId}]->(l)
     MERGE (l)-[:ASSOC_PRIMARY {type: 'ASSOC_PRIMARY', source: 'github', primaryId: primaryId}]->(p)",
     "",
     {r: r, repo: repo, primaryId: $primaryId, p: p}
   ) YIELD value
   RETURN o
`

    await runCypher(query, record)

		return record
  } catch(e) {
    throw e
  }
}

async function getRepos(user) {
	try {
    var result = await octokit.paginate('GET /users/{user}/repos', {user: user})
    //var result = await octokit.paginate('GET /users/' + user + '/repos')
    var records = await Promise.all(
  	  result.map(async function(entry) {
        var repo = {}
        repo.name = orNa(entry, "name")
        repo.url = entry.html_url
        // TODO: using orNa for things I think might be null - should probably do all of them
        repo.description = orNa(entry, "description")
        repo.isFork = entry.fork
        repo.createdAt = entry.created_at
        repo.pushedAt = orNa(entry, "pushed_at")
        repo.primaryLanguage = orNa(entry, "language")
        repo.forksCount = entry.forks_count
        repo.openIssuesCount = entry.open_issues_count
        repo.watchersCount = entry.watchers
        // requests per repo - lots of extra calls for minimal info (this inner function doesn't need to be async unless these are called)
        // also - these may be better as octokit.request rather than .paginate (not tested)
        /*repo.stargazers = []
        var stargazers = await octokit.paginate('GET ' + entry.stargazers_url.replace("https://api.github.com", ""))
        stargazers.forEach(function(gazer) {
          repo.stargazers.push(gazer.login)
        })

        var languages_bytes = await octokit.paginate('GET ' + entry.languages_url.replace("https://api.github.com", ""))
        repo.languages_bytes = languages_bytes*/
        return repo
      })
    )

    return records

	} catch(e) {
		throw e
	}
}

async function getUser(user) {
  try {
    var result = await octokit.request('GET /users/' + user)
		result = result.data

    var record = {}
    record.login = result.login
    record.url = orNa(result, "html_url")
    record.name = orNa(result, "name")
    record.company = orNa(result, "company")
    record.blog = orNa(result, "blog")
    record.location = orNa(result, "location")
    record.twitterUsername = orNa(result, "twitter_username")
    record.followersCount = result.followers
    record.followingCount = result.following
    record.createdAt = result.created_at
    record.followers = []
	  var followers = await octokit.request('GET ' + result.followers_url.replace("https://api.github.com", ""))
	  followers.data.forEach(function(follower) {
			    record.followers.push(follower.login)
			  })

	  record.following = []
	  var following = await octokit.request(result.following_url.replace('\{/other_user\}', '').replace("https://api.github.com", ""))
	  following.data.forEach(function(person) {
			    record.following.push(person.login)
			  })

    var orgs = await octokit.request('GET ' + result.organizations_url.replace("https://api.github.com", ""))
	  record.organizations = orgs.data

	  return record

  } catch(e) {
    throw e
  }
}
