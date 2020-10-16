var psJson = require('../package.json')
var { runCypher } = require('./neo4j.js')
var { orNa } = require('./utils.js')

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
    var record = await getUser(username)
		record.repos = await getRepos(username)
    record.primaryId = primaryId
    

    // create node if not exist
    var query = "MERGE (o:GithubProfile {username: $login, \
                              name: $name,   \
                              company: $company, \
                              location: $location, \
                              followersCount: $followersCount, \
                              followingCount: $followingCount, \
                              createdAt: $createdAt \
                              }) \
                 MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 MERGE (u:URL {urlName: 'Blog', url: $blog}) \
                 MERGE (o) -[:HAS_URL]-> (u) \
                 MERGE (o) -[:ASSOC_PRIMARY]-> (p) \
                 MERGE (u) -[:ASSOC_PRIMARY]-> (p) \
                 MERGE (p) -[:HAS_SECONDARY_PROFILE]-> (o)"
                                           
    await runCypher(query, record)
    
    var query = "MERGE (o:GithubProfile {username: $login}) \
                 MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 WITH $followers as followers, o as o, p as p \
                   UNWIND followers as follower \
                     MERGE (f:GithubProfile {username: follower}) \
                     MERGE (f)-[:FOLLOWS]->(o) \
                     MERGE (f)-[:ASSOC_PRIMARY]->(p) \
                 "
    
    console.log("Running cypher: " + query) 
    await runCypher(query, record)

    var query = "MERGE (o:GithubProfile {username: $login}) \
                 MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 WITH $following as following, o as o, p as p \
                   UNWIND following as followed \
                     MERGE (f:GithubProfile {username: followed}) \
                     MERGE (o)-[:FOLLOWS]->(f) \
                     MERGE (f)-[:ASSOC_PRIMARY]->(p) \
                 "
  
    console.log("Running cypher: " + query) 
    await runCypher(query, record)
    
    // TODO: organizations (why doesn't it return mine?)
                     
    // TODO: need to not create NA entries for programming languages 
    // (or other expected-to-be-shared nodes, it's mostly noise)

    var query = "MERGE (o:GithubProfile {username: $login}) \
                 MERGE (p:PrimaryProfile {primaryId: $primaryId}) \
                 WITH $repos as repos, o as o, p as p \
                   UNWIND repos as repo \
                     MERGE (r:GithubRepo {name: repo.name, \
                                          description: repo.description, \
                                          isFork: repo.isFork, \
                                          createdAt: repo.createdAt, \
                                          pushedAt: repo.pushedAt, \
                                          forksCount: repo.forksCount, \
                                          openIssuesCount: repo.openIssuesCount, \
                                          watchersCount: repo.watchersCount \
                                          }) \
                     MERGE (u:URL {url_name: 'repo', url: repo.url}) \
                     MERGE (l:ProgrammingLanguage {name: repo.primaryLanguage}) \
                     MERGE (o)-[:HAS_REPO]->(r) \
                     MERGE (r)-[:HAS_URL]->(u) \
                     MERGE (r)-[:HAS_PROGRAMMING_LANGUAGE {role: 'primary'}]->(l) \
                     MERGE (r)-[:ASSOC_PRIMARY]->(p) \
                     MERGE (u)-[:ASSOC_PRIMARY]->(p) \
                     MERGE (l)-[:ASSOC_PRIMARY]->(p) \
                 "
  
    console.log("Running cypher: " + query) 
    await runCypher(query, record)

		return record
  } catch(e) {
    throw e
  }
}

async function getRepos(user) {
	try {
		var result = await octokit.request('GET /users/' + user + '/repos')
    var records = await Promise.all(
  	  result.data.map(async function(entry) {
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
        /*repo.stargazers = []
        var stargazers = await octokit.request('GET ' + entry.stargazers_url.replace("https://api.github.com", "")) 
        stargazers.data.forEach(function(gazer) {
          repo.stargazers.push(gazer.login)
        })    
    
        var languages_bytes = await octokit.request('GET ' + entry.languages_url.replace("https://api.github.com", ""))  
        repo.languages_bytes = languages_bytes.data*/
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





