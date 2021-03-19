
<!-- panels:start --> 

<!-- div:title-panel -->

# Discovery Index

<!-- div:left-panel -->

The Discovery Index (developed in collaboration with the [OSU TEHR](https://ehsc.oregonstate.edu/)) is a set of services 
designed to accept user-submitted form data (especially Google Forms and Qualtrics via a REST API) and convert answers to relationships
stored in a graph database made available for visualization and querying. 

DI is designed to store data primarily about *people*, and provides mechanisms for harvesting information from GitHub and ORCiD. 


<br />

![](media/architecture_diagram.png ':size=70%')

<br />
<br />

### Data Refreshing

To protect personal privacy, one of DI's design principles is removal of existing data on update: harvesting data from GitHub or ORCiD for a given 
user first removes all data associated with that user for that source, allowing users the opportunity to, for example, make a GitHub repository private or
remove information from their ORCiD profile and trigger a data refresh by resubmitting the ingestion form. This is also enabled for form-sourced information, and 
works well with forms like Google and Qualtrics which support re-taking responses. 

<!-- div:right-panel -->

<!-- panels:end -->




<!-- panels:start -->

<!-- div:title-panel -->

## Deployment

<!-- div:left-panel -->

DI is deployed via [docker compose](https://docs.docker.com/compose/) and configured via environment variables:

```bash
git clone https://github.com/oneilsh/discovery_index.git
CERTS_PATH=/path/to/certs \
  GITHUB_TOKEN=8a96da92be1096ccc6bebb765e09910a568c \
  ADMIN_USER=admin \
  ADMIN_PASS=supersecret \
  docker-compose up -d
```

where `ADMIN_USER` and `ADMIN_PASSWORD` are the desired API username and password, `GITHUB_TOKEN` is a GitHub personal access token with read- or access-only scopes enabled, and `CERTS_PATH` is a folder with structure (including filenames and the empty `revoked` subfolder):

```
private.key
public.crt
revoked/
trusted/public.crt
```

The service will run on port 443. To run on another port (e.g. 80) without certificates, use `API_PORT=80 API_INSECURE=true`.

#### *Fine print*

The docker-compose file creates a named volume for the database, permitting upgrades without data loss with `docker-compose`. Note however
that the neo4j container stores authentication in the named volume, so to update the `ADMIN_PASS` (the only setting affected by this issue) be sure to run `docker-compose exec neo4j rm -f data/dbms/auth`
before restarting the the neo4j service should you need to. 

<!-- div:right-panel -->

<!-- panels:end -->






<!-- panels:start -->

<!-- div:title-panel -->

## Usage/API (Qualtrics or other)

<!-- div:left-panel -->

Data is ingested via basic-auth secured (using the `ADMIN_USER` and `ADMIN_PASS` from deployment) REST endpoints which can be targetted by Qualtrics,
Google Forms, or other software capable of making such requests. While ingesting data via GitHub username and ORCiD ID is straightforward, the `update_relationship`
endpoint is more complex to allow for flexible graph-database relationship generation from form questions. All endpoints read and write `application/JSON`, authorization is handled via REST header, e.g. `Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQK` (where `dXNlcm5hbWU6cGFzc3dvcmQK` is the base-64 encoding of "username:password" if `username` and `password` were the actual username and password).

[JSON-schemas](https://json-schema.org/) used for validation can be found in the repo under `docker/images/discovery-index/static/schemas`. 



<!-- div:right-panel -->

<!-- panels:end --> 






<!-- panels:start -->

<!-- div:left-panel -->

### POST /admin/update_profile

This method creates (if it doesn't exist already) a single node in the database to represent a person as their "primary" identifier that other secondary profiles (e.g. GitHub or ORCiD) can relate to. Attached to that node are user-defined properties.

**Required:** `primaryId` and `profile` (can be empty, `{}`)

`primaryId`: is used throughout the discovery index to associate information with a specific individual; this field must be a string, and should be something that is 
stable over time (we don't have a way to change it currently).

`profile`: entries here can only be strings or numbers and keys should be simple (`camelCase` or `snake_case`). 

`diProject`: is also used throughout the index; it defaults to `"default"` if unspecified and provides a way to store multiple projects in the same database instance (namespaces, effectively). Note though that there is only one admin username and password for the entire DI instance.

Other endpoints below also create a primary profile node if it doesn't already exist to connect to.

Here's an example of how this endpoint can be targetted from Qualtrics, via the "Survey Flow" tool with embedded question answers:

![](media/qualtrics_update_profile.png ':size=70%')

<!-- div:right-panel -->

Example body: 

```json
{
  "primaryId": "username@someplace.com",
  "diProject": "someProject",
  "profile": {
              "firstName": "Katie", 
              "lastName": "O'Neil", 
              "age": 31
             }
}
```

<!-- panels:end --> 





<!-- panels:start -->

<!-- div:left-panel -->

### POST /admin/update_github

This method creates (if it doesn't exist already) a GithubProfile node with various properties set, connected to the primary profile node with a "HAS_SECONDARY_PROFILE" relationship. This in turn is potentially connected to other GithubProfile nodes (via FOLLOWS relationships), a Url node (via HAS_URL), and GithubRepo nodes (HAS_REPO). 
GithubRepo nodes in turn may be connected to a ProgrammingLanguage node (via HAS_PROGRAMMING_LANGUAGE) reflecting GitHub's guess at the repo's primary language. 




**Required:** `primaryId` and `username`

`username`: the individual's Github username, prefixed with an `@` or not (both `oneilsh` and `@oneilsh` are accepted).

<!-- div:right-panel -->

Example body: 

```json
{
  "primaryId": "username@someplace.com",
  "diProject": "someProject",
  "username": "oneilsh"
}
```

<!-- panels:end --> 





