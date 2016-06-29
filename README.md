![Manada](http://files.gandi.ws/gandi76242/image/logo_full.png)
=====
[![GitHub release](https://img.shields.io/github/release/j8la/manada-client.svg)](https://github.com/j8la/manada-client)
[![GitHub issues](https://img.shields.io/github/issues/j8la/manada-client.svg)](https://github.com/j8la/manada-client/issues)
[![Docker Stars](https://img.shields.io/docker/pulls/jbla/manada.io.clt.svg)](https://hub.docker.com/r/jbla/manada.io.clt/)
[![GitHub license](https://img.shields.io/badge/license-AGPL-red.svg)](https://raw.githubusercontent.com/j8la/manada-client/master/LICENSE)
=====
Manada Client is a web client, provided as a container, that is used to manage Manada containers and their store.

### Howto

To install :
```
docker pull jbla/manada.io.clt
```

To start a Manada client container, you need to specify the Manada Cluster ID because he is using host dicovery to get instances on the network. If the Manada Cluster ID is not specified, the following ID will be used : "manada".

To use with "--net=host" option :
```
docker run -d --net=host jbla/manada.io.clt [ID]
```

To use with "--net=weave" option :
```
docker run -d --net=weave -p 8080:8080 jbla/manada.io.clt [ID]
```

[Check the documentation for more informations.](https://github.com/j8la/manada/wiki)
