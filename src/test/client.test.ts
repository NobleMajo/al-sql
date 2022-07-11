import "mocha"
import { expect } from 'chai'

if (
    typeof process.env.PG_FAKE_CLIENT != "string" ||
    process.env.PG_FAKE_CLIENT.length == 0
) {
    process.env.PG_FAKE_CLIENT = "true"
}

import { PostgresConnection } from "../pg"
import { SqlClient } from "../index"
import {
    createFriendshipTables, FriendshipTables
} from "./friendship"

export const client: SqlClient = new SqlClient(
    new PostgresConnection("127.0.0.1", 5432, "test", "test", "test"),
    1000 * 10,
    true,
)

describe('client base test', () => {
    let tables: FriendshipTables
    before('test get tables query', async () => {
        tables = createFriendshipTables(client)

        await client.connect()
    })

    beforeEach("clear query list", () => {
        client.clearQuerys()
    })

    after('close fake connection', async () => {
        await client.close()
    })

    it('create tables', async () => {
        await client.createAllTables()
    })

    it('insert test data', async () => {
        await tables.accountTable.insert({
            name: "tester1",
            email: "tester1@testermail.com",
        })
        await tables.accountTable.insert({
            name: "tester2",
            email: "tester2@testermail.com",
        })
        await tables.accountTable.insert({
            name: "tester3",
            email: "tester3@testermail.com",
        })
        await tables.accountTable.insert({
            name: "tester4",
            email: "tester4@testermail.com",
        })
        await tables.accountTable.insert({
            name: "tester5",
            email: "tester5@testermail.com",
        })

        client?.shiftQuery()
        client?.shiftQuery()
        client?.shiftQuery()
        client?.shiftQuery()
    })

    it('drop all tables', async () => {
        await client.dropAllTables()
        client?.shiftQuery()
        client?.shiftQuery()
    })

    it('friendship example create account', async () => {
        await tables.accountTable.createTable()
        client?.shiftQuery()

        expect((await tables.accountTable.select(
            "id"
        )).length).is.equals(0)
    })

    it('friendship example create friendship', async () => {
        await tables.friendshipTable.createTable()
        expect((await tables.friendshipTable.select(
            "id"
        )).length).is.equals(0)
    })
})
