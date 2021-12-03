import "mocha"
import { expect } from 'chai';

import { Client } from "../src/fakeClient"
import { PostgressConnection } from "../src/pg"
import { SqlClient } from "../src/index"

let fakeClient: Client
let con: PostgressConnection
let client: SqlClient

describe('fake client', () => {
    it('create fake client', () => {
        fakeClient = new Client({})
    })

    it('create fake postgres connection', () => {
        con = new PostgressConnection("", -1, "", "", "");
        (con as any).client = fakeClient
    })

    it('create fake sql client', () => {
        client = new SqlClient(
            con,
            1000 * 60,
            false,
        )
    })

    it('get tables', async () => {
        const result = await client.getTables()
        if (
            typeof result != "object" ||
            !Array.isArray(result.rows) ||
            result.rows.length != 0
        ) {
            throw new Error("Result is not a rows object!")
        }
        const query = fakeClient.shiftQuery()
        if (!query) {
            throw new Error("No query for get tables!")
        }
        expect(query[0]).is.equals(
            'SELECT * FROM pg_catalog.pg_tables WHERE schemaname != \'pg_catalog\' AND schemaname != \'information_schema\'')
    })

    it('create account test table', async () => {
        const account = await client.getTable(
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
        await account.createTable()
        const query = fakeClient.shiftQuery()
        if (!query) {
            throw new Error("No query for create table!")
        }
        expect(query[0]).is.equals(
            'CREATE TABLE IF NOT EXISTS "account"(id SERIAL PRIMARY KEY NOT NULL, name VARCHAR(32) UNIQUE NOT NULL, email VARCHAR(128) UNIQUE NOT NULL)'
        )
    })


    it('close fake connection', async () => {
        await client.close()
    })
})
