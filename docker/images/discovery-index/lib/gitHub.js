var psJson = require('../package.json')

if(!process.env.GITHUB_ACCESS_TOKEN) {
  console.log("Sorry, running this server requires GITHUB_ACCESS_TOKEN environment variable to be set.")
  process.exit(1)
}

var { Octokit } = require('@octokit/rest')

exports.octokit = new Octokit({
  userAgent: 'DiscoveryIndex ' + psJson.version,
  auth: process.env.GITHUB_ACCESS_TOKEN
})

