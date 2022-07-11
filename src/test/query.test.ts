import "mocha"
import { expect } from 'chai'

if (
    typeof process.env.PG_FAKE_CLIENT != "string" ||
    process.env.PG_FAKE_CLIENT.length == 0
) {
    process.env.PG_FAKE_CLIENT = "true"
}

import { PostgresConnection } from "../pg"
import { SqlClient, SqlTable } from "../index"

export const client: SqlClient = new SqlClient(
    new PostgresConnection("127.0.0.1", 5432, "test", "test", "test"),
    1000 * 10,
    true,
)

describe('query generation test', () => {
    before('test get tables query', async () => {
        await client.connect()
    })

    beforeEach("clear query list", () => {
        client.clearQuerys()
    })

    after('close fake connection', async () => {
        await client.close()
    })

    it('test get tables query', async () => {
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

    let userTable: SqlTable
    it('create account test table', async () => {
        userTable = client.getTable(
            "user",
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
        await userTable.createTable()
        const query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'CREATE TABLE IF NOT EXISTS "user"(id SERIAL PRIMARY KEY NOT NULL, name VARCHAR(32) UNIQUE NOT NULL, email VARCHAR(128) UNIQUE NOT NULL)'
        )
    })

    let friendstateTable: SqlTable
    it('create friendship test table', async () => {
        friendstateTable = client.getTable(
            "friendstate",
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
                    foreignTableName: "user"
                },
                {
                    columnName: "receiver_id",
                    foreignColumnName: "id",
                    foreignTableName: "user"
                }
            ]
        )
        await friendstateTable.createTable()
        const query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'CREATE TABLE IF NOT EXISTS "friendstate"(id SERIAL PRIMARY KEY NOT NULL, sender_id INT NOT NULL, receiver_id INT NOT NULL, accepted BOOL NOT NULL DEFAULT FALSE, FOREIGN KEY(sender_id) REFERENCES "user" (id) ON DELETE CASCADE, FOREIGN KEY(receiver_id) REFERENCES "user" (id) ON DELETE CASCADE)'
        )
    })

    it('insert data test data', async () => {
        let query
        let result

        result = await userTable.insert({
            name: "tester",
            email: "tester@tester.com"
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "user" (name, email) VALUES ($1, $2)'
        )

        result = await userTable.insert({
            name: "majo",
            email: "majo@coreunit.net"
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "user" (name, email) VALUES ($1, $2)'
        )

        result = await friendstateTable.insert({
            sender_id: 1,
            receiver_id: 2
        })
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'INSERT INTO "friendstate" (sender_id, receiver_id) VALUES ($1, $2)'
        )
    })

    it('select with complex where tables', async () => {
        let query
        let result

        result = await userTable.select(
            ["name"]
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "name" FROM "user"'
        )

        result = await userTable.selectOne(
            ["id"],
            ["name", "tester"]
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "id" FROM "user" WHERE "user".name = $1 LIMIT 1'
        )

        result = await friendstateTable.select(
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
                targetTable: "user",
                targetKey: "id"
            },
            {
                as: "sa",
                sourceKey: "sender_id",
                targetTable: "user",
                targetKey: "id"
            },
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "ra"."name", "sa"."name" FROM "friendstate" INNER JOIN "user" ra ON "ra".id = "friendstate".receiver_id INNER JOIN "user" sa ON "sa".id = "friendstate".sender_id WHERE ("friendstate".accepted != $1 AND ("friendstate".receiver_id = $2 OR "friendstate".sender_id = $3))'
        )

        result = await friendstateTable.update(
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
            'UPDATE "friendstate" SET accepted=$1 WHERE ("friendstate".receiver_id = $2 OR "friendstate".sender_id = $3)'
        )

        result = await friendstateTable.select(
            [
                ["ra", "name"],
                ["sa", "name"],
            ],
            [["accepted", "NOT"], false],
            -1,
            {
                as: "ra",
                sourceKey: "receiver_id",
                targetTable: "user",
                targetKey: "id"
            },
            {
                as: "sa",
                sourceKey: "sender_id",
                targetTable: "user",
                targetKey: "id"
            },
        )
        query = client?.shiftQuery()?.shift()
        expect(query).is.equals(
            'SELECT "ra"."name", "sa"."name" FROM "friendstate" INNER JOIN "user" ra ON "ra".id = "friendstate".receiver_id INNER JOIN "user" sa ON "sa".id = "friendstate".sender_id WHERE "friendstate".accepted != $1'
        )
    })

    it('drop tables', async () => {
        await client.dropAllTables()

        let query
        query = client?.shiftQuery()?.shift()

        expect(query).is.equals(
            'DROP TABLE IF EXISTS "friendstate" CASCADE'
        )
        query = client?.shiftQuery()?.shift()

        expect(query).is.equals(
            'DROP TABLE IF EXISTS "user" CASCADE'
        )
    })
})
