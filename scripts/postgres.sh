#!/bin/bash

cd ..

docker network create postgres_net 2> /dev/null

docker rm -f postgres-test

docker run -d --rm \
    --network postgres_net \
    --name postgres-test \
    -e POSTGRES_USER="admin" \
    -e POSTGRES_PASSWORD="postgres" \
    -e POSTGRES_DB="default" \
    -p 35432:5432/tcp \
    -p 35432:5432/udp \
    postgres:14