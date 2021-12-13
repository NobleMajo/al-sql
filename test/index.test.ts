import "mocha"
import { expect } from 'chai';
import { PostgresConnection } from "../src/pg"
import { showResult, showTable, SqlClient, SqlTable } from "../src/index"

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

import { acceptFriendship, createAccount, getFriends, requestFriendship } from "../example/friendship";

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

    it('friendship example test', async () => {
        expect((await accountTable.select(
            "id"
        )).length).is.equals(0)

        const tester1Id = await createAccount("tester1", "tester1@testermail.com")
        const tester2Id = await createAccount("tester2", "tester2@testermail.com")
        const tester3Id = await createAccount("tester3", "tester3@testermail.com")
        const tester4Id = await createAccount("tester4", "tester4@testermail.com")

        expect((await accountTable.select(
            "id"
        )).length).is.equals(4)

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
