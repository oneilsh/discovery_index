
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

### POST /update_profile

This method creates (if it doesn't exist already) a single node in the database to represent a person as their "primary" identifier that other secondary profiles (e.g. GitHub or ORCiD) can relate to. 

### POST /update_github

Example body: 

```json
{
  "primaryId": "username@someplace.com",
  "username": "oneilsh",
  "diProject": "someProject"
}
```

**Required:** `primaryId` and `username`



<!-- div:right-panel -->

<!-- panels:end -->

