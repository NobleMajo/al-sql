#!/bin/sh

cd ..

docker run -it --rm \
    --network postgres_net
    -e POSTGRES_HOST="postgres-test" \
    -e POSTGRES_PORT="5432" \
    -e POSTGRES_USER="admin" \
    -e POSTGRES_PASSWORD="adminPw" \
    -e POSTGRES_DB="adminDb" \
    --name al_sql \
    al_sql_img