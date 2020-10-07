The `certs` dir is setup for inclusion in the neo4j image as a bind-mount volume (for neo4j 3.5; 
not that 4.X uses a different set of locations and options for specifying these). Notice they are named `public.crt` and `private.key`; a copy of
`public.crt` should be in `certs` and `certs/trusted`. The API server also accesses them for SSL encryption if
the port is specified as `443`. 

`RUN_VARS` specifies environment variables; you may want to set them like so:

```
##########################
######### Neo4j settings
##########################

# Set https and http ports and listen address (note that 443 is used by the API container)
NEO4J_dbms_connector_https_listen__address=0.0.0.0:7473
NEO4J_dbms_connector_http_listen__address=0.0.0.0:7474

# set advertised hostname with corresponding port
NEO4J_dbms_connector_https_advertised__address=your.hostname.tld:7473
NEO4J_dbms_connector_http_advertised__address=your.hostname.tld:7474

# set neo4j admin username and password (note the replication of the password in two spots)
NEO4J_USER=neo4j
NEO4J_PASS=somepassword
NEO4J_AUTH=neo4j/somepassword

##########################
######### API server settings
##########################

# set github access token for github API calls
GITHUB_ACCESS_TOKEN=8e086bd8canotarealtoken7f3ef9646b9f61db797ca
```
