import "mocha"
import { expect } from 'chai'

import { setDefaultFakeClientValue } from '../fakeClient';
setDefaultFakeClientValue(false)

import { PostgresConnection } from "../pg"
import { SqlClient, SqlTable } from "../index"

export const client: SqlClient = new SqlClient(
    new PostgresConnection("", 0, "", "", ""),
    1000 * 10,
    true,
)

import {
    accountTable,
    createAccount,
    friendshipTable,
} from "./friendship"

describe('client base test', () => {
    before('test get tables query', async () => {
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
        await accountTable.insert({
            name: "tester1",
            email: "tester1@testermail.com",
        })
        await accountTable.insert({
            name: "tester2",
            email: "tester2@testermail.com",
        })
        await accountTable.insert({
            name: "tester3",
            email: "tester3@testermail.com",
        })
        await accountTable.insert({
            name: "tester4",
            email: "tester4@testermail.com",
        })
        await accountTable.insert({
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
        await accountTable.createTable()
        client?.shiftQuery()

        expect((await accountTable.select(
            "id"
        )).length).is.equals(0)
    })

    it('friendship example create friendship', async () => {
        await friendshipTable.createTable()
        expect((await friendshipTable.select(
            "id"
        )).length).is.equals(0)
    })
})
