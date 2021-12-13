import "mocha"
import { expect } from 'chai';
import { PostgresConnection } from "../src/pg"
import { SqlClient, SqlTable } from "../src/index"

export const con: PostgresConnection = new PostgresConnection(
    process.env.POSTGRES_HOST ?? "postgres-test",
    process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 35432,
    process.env.POSTGRES_USER ?? "admin",
    process.env.POSTGRES_PASSWORD ?? "postgres",
    process.env.POSTGRES_DB ?? "default"
)
export const client: SqlClient = new SqlClient(
    con,
    1000 * 10,
    true,
)

import { acceptFriendship, accountTable, createAccount, friendshipTable, getFriends, requestFriendship } from "../example/friendship";

describe('client', () => {
    before('test client connect', async () => {
        await client.connect()
            .catch((err) => {
                delete (con as any).client
                client.close().catch(() => { })
                console.error("connection failed: ", con)
                throw err
            })
    })

    before('test get tables query', async () => {
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

    after('close fake connection', async () => {
        await client.close()
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
            email: "halsmaulmajo@coreunit.net"
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
                ["ra", "name", "rname"],
                ["sa", "name", "sname"],
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
            `SELECT "ra"."name" AS "rname", "sa"."name" AS "sname" FROM "friendstate" INNER JOIN "user" ra ON "ra".id = "friendstate".receiver_id INNER JOIN "user" sa ON "sa".id = "friendstate".sender_id WHERE "friendstate".accepted != $1`
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

    it('recreate tables', async () => {
        await client.createAllTables()
        client?.shiftQuery()
        client?.shiftQuery()
    })

    it('insert test data', async () => {
        await client.createAllTables()
        client?.shiftQuery()
        client?.shiftQuery()
    })

    it('drop all tables', async () => {
        await client.dropAllTables()
        client?.shiftQuery()
        client?.shiftQuery()
    })

    it('friendship example create account', async () => {
        await accountTable.createTable()
        client?.shiftQuery()

        expect((await accountTable.select(
            "id"
        )).length).is.equals(0)
    })

    let tester1Id: number
    let tester2Id: number
    let tester3Id: number
    let tester4Id: number

    it('friendship example fill account', async () => {
        tester1Id = await createAccount("tester1", "tester1@testermail.com")
        tester2Id = await createAccount("tester2", "tester2@testermail.com")
        tester3Id = await createAccount("tester3", "tester3@testermail.com")
        tester4Id = await createAccount("tester4", "tester4@testermail.com")

        expect((await accountTable.select(
            "id"
        )).length).is.equals(4)

        expect(typeof tester1Id).is.equals("number")
        expect(typeof tester4Id).is.equals("number")
    })

    it('friendship example create friendship', async () => {
        await friendshipTable.createTable()
        expect((await friendshipTable.select(
            "id"
        )).length).is.equals(0)
    })

    it('friendship example fill friendship', async () => {
        await Promise.all([
            requestFriendship(tester1Id, tester2Id),
            requestFriendship(tester1Id, tester3Id),
            requestFriendship(tester1Id, tester4Id),
            requestFriendship(tester3Id, tester2Id),
            requestFriendship(tester4Id, tester3Id),
            requestFriendship(tester4Id, tester2Id)
        ])
        await Promise.all([
            acceptFriendship(tester1Id, tester2Id),
            acceptFriendship(tester1Id, tester3Id),
            acceptFriendship(tester3Id, tester2Id),
            acceptFriendship(tester4Id, tester2Id)
        ]);

        expect((await friendshipTable.select(
            "id"
        )).length).is.equals(6)
    })

    it('friendship example check friendship', async () => {
        expect((await friendshipTable.select(
            "id",
            ["accepted", true]
        )).length).is.equals(4)
        expect((await friendshipTable.select(
            "id",
            ["accepted", false]
        )).length).is.equals(2)
        expect((await getFriends(tester1Id)).length).is.equals(2)
        expect((await getFriends(tester2Id)).length).is.equals(3)
        expect((await getFriends(tester3Id)).length).is.equals(2)
        expect((await getFriends(tester4Id)).length).is.equals(1)
    })
})
