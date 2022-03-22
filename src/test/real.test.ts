import "mocha"
import { expect } from 'chai'

import { setDefaultFakeClientValue, useFakeClient } from '../fakeClient';
setDefaultFakeClientValue(false)

import { PostgresConnection } from "../pg"
import { SqlClient, SqlTable } from "../index"

export const client: SqlClient = new SqlClient(
    new PostgresConnection("localhost", 5432, "test", "test", "test"),
    1000 * 10,
    true,
)

import {
    acceptFriendship,
    accountTable,
    createAccount,
    friendshipTable,
    getFriends,
    requestFriendship
} from "./friendship"

useFakeClient() && console.log(
    `If you want to run test with a real postgres database set the 'PG_FAKE_CLIENT' environment variable to 'false'!
    The test database needs to be reachable over localhost:5432 with username, password and database 'test'.`
)
!useFakeClient() && describe('real pg database test', () => {
    before('test get tables query', async () => {
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
        ])

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
