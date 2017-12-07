# DCS HR tracker

## Setup

DCS HR tracker is hosted as a static web app.

## Prerequisites

````
install npm
install nodejs
npm install http-server -g
````

## Hosting

````
./run_local.sh
````

The app contains dynamic registration at:

* manifest: http://localhost:8088/.well-known/smart/manifest.json

The app is available for SMART Launch at:

* launch_url: http://localhost:8088/launch.html
* redirect_uri: http://localhost:8088/index.html

With client id:

* {Register app w SMART sandbox provider to obtain client_id; update /config/config.json w client_id}