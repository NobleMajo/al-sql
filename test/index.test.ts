import "mocha"
import { expect } from 'chai';

import { PostgresConnection } from "../src/pg"
import { SqlClient, SqlTable } from "../src/index"

describe('fake client', () => {
    let con: PostgresConnection
    let client: SqlClient

    it("create postgres connection", () => {
        con = new PostgresConnection(
           process.env.POSTGRES_HOST ?? "localhost",
           process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 4321,
           process.env.POSTGRES_USER ??  "admin",
           process.env.POSTGRES_PASSWORD ??  "postgres",
           process.env.POSTGRES_DB ?? "default"
        )
    })

    it("create fake client", () => {
        client = new SqlClient(
            con,
            1000 * 60,
            true,
        )
    })

    it('test fake client connection', async () => {
        const result = await client.getTables()
        if (
            typeof result != "object" ||
            !Array.isArray(result.rows)
        ) {
            throw new Error("Result is not a rows object!")
        }
        const query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT * FROM pg_catalog.pg_tables WHERE schemaname != \'pg_catalog\' AND schemaname != \'information_schema\''
        )
    })

    let accountTable: SqlTable
    it('create account test table', async () => {
        accountTable = client.getTable(
            "account",
            [
                {
                    name: "id",
                    type: "SERIAL",
                    primaryKey: true,
                    nullable: false,
                },
                {
                    name: "name",
                    type: "VARCHAR",
                    unique: true,
                    nullable: false,
                    size: 32,
                },
                {
                    name: "email",
                    type: "VARCHAR",
                    unique: true,
                    nullable: false,
                    size: 128,
                },
            ]
        )
        await accountTable.createTable()
        const query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'CREATE TABLE IF NOT EXISTS "account"(id SERIAL PRIMARY KEY NOT NULL, name VARCHAR(32) UNIQUE NOT NULL, email VARCHAR(128) UNIQUE NOT NULL)'
        )
    })

    let friendshipTable: SqlTable
    it('create friendship test table', async () => {
        friendshipTable = client.getTable(
            "friendship",
            [ // column example:
                {
                    name: "id",
                    type: "SERIAL",
                    primaryKey: true,
                    nullable: false,
                },
                {
                    name: "sender_id",
                    type: "INT",
                    nullable: false,
                },
                {
                    name: "receiver_id",
                    type: "INT",
                    nullable: false,
                },
                {
                    name: "accepted",
                    type: "BOOL",
                    nullable: false,
                    default: false,
                },
            ],
            [// foreign keys example:
                {
                    columnName: "sender_id",
                    foreignColumnName: "id",
                    foreignTableName: "account"
                },
                {
                    columnName: "receiver_id",
                    foreignColumnName: "id",
                    foreignTableName: "account"
                }
            ]
        )
        await friendshipTable.createTable()
        const query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'CREATE TABLE IF NOT EXISTS "friendship"(id SERIAL PRIMARY KEY NOT NULL, sender_id INT NOT NULL, receiver_id INT NOT NULL, accepted BOOL NOT NULL DEFAULT FALSE, FOREIGN KEY(sender_id) REFERENCES "account" (id) ON DELETE CASCADE, FOREIGN KEY(receiver_id) REFERENCES "account" (id) ON DELETE CASCADE)'
        )
    })

    it('insert data test data', async () => {
        let query
        let result

        result = await accountTable.insert({
            name: "tester",
            email: "tester@tester.com"
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "account" (name, email) VALUES ($1, $2)'
        )

        result = await accountTable.insert({
            name: "majo",
            email: "halsmaulmajo@coreunit.net"
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "account" (name, email) VALUES ($1, $2)'
        )

        result = await friendshipTable.insert({
            sender_id: 1,
            receiver_id: 2
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "friendship" (sender_id, receiver_id) VALUES ($1, $2)'
        )
    })

    it('select with complex where tables', async () => {
        let query
        let result

        result = await accountTable.select(
            ["name"]
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "name" FROM "account"'
        )

        result = await accountTable.select(
            ["id"],
            ["name", "tester"]
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "id" FROM "account" WHERE account.name = $1'
        )

        result = await friendshipTable.select(
            [
                ["ra", "name"],
                ["sa", "name"],
            ],
            [
                "AND",
                [["accepted", "NOT"], true],
                [
                    "OR",
                    ["receiver_id", 1],
                    ["sender_id", 1],
                ],
            ],
            -1,
            {
                as: "ra",
                sourceKey: "receiver_id",
                targetTable: "account",
                targetKey: "id"
            },
            {
                as: "sa",
                sourceKey: "sender_id",
                targetTable: "account",
                targetKey: "id"
            },
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "ra"."name", "sa"."name" FROM "friendship" INNER JOIN "account" ra ON "ra".id = "friendship".receiver_id INNER JOIN "account" sa ON "sa".id = "friendship".sender_id WHERE (friendship.accepted != $1 AND (friendship.receiver_id = $2 OR friendship.sender_id = $3))'
        )

        result = await friendshipTable.update(
            {
                "accepted": true
            },
            [
                "OR",
                ["receiver_id", 1],
                ["sender_id", 1]
            ]
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'UPDATE "friendship" SET accepted=$1 WHERE (friendship.receiver_id = $2 OR friendship.sender_id = $3)'
        )

        result = await friendshipTable.select(
            [
                ["ra", "name"],
                ["sa", "name"],
            ],
           [["accepted", "NOT"], false],
            -1,
            {
                as: "ra",
                sourceKey: "receiver_id",
                targetTable: "account",
                targetKey: "id"
            },
            {
                as: "sa",
                sourceKey: "sender_id",
                targetTable: "account",
                targetKey: "id"
            },
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "ra"."name", "sa"."name" FROM "friendship" INNER JOIN "account" ra ON "ra".id = "friendship".receiver_id INNER JOIN "account" sa ON "sa".id = "friendship".sender_id WHERE friendship.accepted != $1'
        )
    })

    it('drop tables', async () => {
        await client.dropAllTables()

        let query
        query = client?.shiftQuery()?.shift()

        expect(query).is.equals(
            'DROP TABLE IF EXISTS "friendship" CASCADE'
        )
        query = client?.shiftQuery()?.shift()

        expect(query).is.equals(
            'DROP TABLE IF EXISTS "account" CASCADE'
        )
    })

    it('recreate tables', async () => {
        await client.createAllTables()
        client?.shiftQuery()?.shift()
        client?.shiftQuery()?.shift()
    })

    it('insert test data', async () => {
        await client.createAllTables()
        client?.shiftQuery()?.shift()
        client?.shiftQuery()?.shift()
    })

    it('close fake connection', async () => {
        await client.close()
    })
})
