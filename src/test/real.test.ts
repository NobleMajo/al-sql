import "mocha"
import { expect } from 'chai'

if (
    typeof process.env.PG_FAKE_CLIENT != "string" ||
    process.env.PG_FAKE_CLIENT.length == 0
) {
    process.env.PG_FAKE_CLIENT = "true"
}

import { useFakeClient } from '../fakeClient';
import { PostgresConnection } from "../pg"
import { SqlClient } from "../index"
import {
    acceptFriendship,
    createAccount,
    getFriends,
    requestFriendship,
    FriendshipTables,
    createFriendshipTables,
} from "./friendship"

export const client: SqlClient = new SqlClient(
    new PostgresConnection("127.0.0.1", 5432, "test", "test", "test"),
    1000 * 10,
    true,
)

useFakeClient() && console.info(
    `
    If you want to run test with a real postgres database set the 'PG_FAKE_CLIENT' environment variable to 'false'!
    The test database needs to be reachable over localhost:5432 with username, password and database 'test'.
    `
)
!useFakeClient() && console.info(
    `Try to run tests with real postgres database!
    The test database needs to be reachable over localhost:5432 with username, password and database 'test'.
    To disable this feature and use a fake-client for tests set 'PG_FAKE_CLIENT' environment variable to 'true'.
    `
)

!useFakeClient() && describe('real pg database test', () => {
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

    let tester1Id: number
    let tester2Id: number
    let tester3Id: number
    let tester4Id: number

    it('friendship example fill account', async () => {
        tester1Id = await createAccount(tables.accountTable, "tester1", "tester1@testermail.com")
        tester2Id = await createAccount(tables.accountTable, "tester2", "tester2@testermail.com")
        tester3Id = await createAccount(tables.accountTable, "tester3", "tester3@testermail.com")
        tester4Id = await createAccount(tables.accountTable, "tester4", "tester4@testermail.com")

        expect((await tables.accountTable.select(
            "id"
        )).length).is.equals(4)

        expect(typeof tester1Id).is.equals("number")
        expect(typeof tester4Id).is.equals("number")
    })

    it('friendship example fill friendship', async () => {
        await Promise.all([
            requestFriendship(tables.friendshipTable, tester1Id, tester2Id),
            requestFriendship(tables.friendshipTable, tester1Id, tester3Id),
            requestFriendship(tables.friendshipTable, tester1Id, tester4Id),
            requestFriendship(tables.friendshipTable, tester3Id, tester2Id),
            requestFriendship(tables.friendshipTable, tester4Id, tester3Id),
            requestFriendship(tables.friendshipTable, tester4Id, tester2Id)
        ])
        await Promise.all([
            acceptFriendship(tables.friendshipTable, tester1Id, tester2Id),
            acceptFriendship(tables.friendshipTable, tester1Id, tester3Id),
            acceptFriendship(tables.friendshipTable, tester3Id, tester2Id),
            acceptFriendship(tables.friendshipTable, tester4Id, tester2Id)
        ])

        expect((await tables.friendshipTable.select(
            "id"
        )).length).is.equals(6)
    })

    it('friendship example check friendship', async () => {
        expect((await tables.friendshipTable.select(
            "id",
            ["accepted", true]
        )).length).is.equals(4)
        expect((await tables.friendshipTable.select(
            "id",
            ["accepted", false]
        )).length).is.equals(2)
        expect((await getFriends(tables.friendshipTable, tester1Id)).length).is.equals(2)
        expect((await getFriends(tables.friendshipTable, tester2Id)).length).is.equals(3)
        expect((await getFriends(tables.friendshipTable, tester3Id)).length).is.equals(2)
        expect((await getFriends(tables.friendshipTable, tester4Id)).length).is.equals(1)
    })
})
