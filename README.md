# al-sql

![uses npm](https://img.shields.io/npm/v/al-sql.svg?style=plastic&logo=npm&color=red)
![uses typescript](https://img.shields.io/badge/dynamic/json?style=plastic&color=blue&label=Typescript&prefix=v&query=devDependencies.typescript&url=https%3A%2F%2Fraw.githubusercontent.com%2FHalsMaulMajo%2Fal-sql%2Fmain%2Fpackage.json)
![uses github](https://img.shields.io/badge/dynamic/json?style=plastic&color=darkviolet&label=GitHub&prefix=v&query=version&url=https%3A%2F%2Fraw.githubusercontent.com%2FHalsMaulMajo%2Fal-sql%2Fmain%2Fpackage.json)
![can't load images](https://img.shields.io/badge/dynamic/json?style=plastic&color=orange&label=UnixTime&query=unixtime&suffix=sec&url=http%3A%2F%2Fworldtimeapi.org%2Fapi%2Ftimezone%2FEtc%2FUTC)

![](https://img.shields.io/badge/dynamic/json?color=darkred&label=open%20issues&query=open_issues&suffix=x&url=https%3A%2F%2Fapi.github.com%2Frepos%2FHalsMaulMajo%2Fal-sql)
![](https://img.shields.io/badge/dynamic/json?color=navy&label=forks&query=forks&suffix=x&url=https%3A%2F%2Fapi.github.com%2Frepos%2FHalsMaulMajo%2Fal-sql)
![](https://img.shields.io/badge/dynamic/json?color=green&label=subscribers&query=subscribers_count&suffix=x&url=https%3A%2F%2Fapi.github.com%2Frepos%2FHalsMaulMajo%2Fal-sql)

"al-sql" is a Abstraction_Layer for sql databases to perform simple sql querys.

You create or use a sql dialect interface and a sql connection interface for your sql database.
With this you can create a SqlClient instance which provides full controll over a database and its table structure.

There is already a working postgres abstraction implementation that you can use for a postgres databases or as base to create a own abstraction implementation (see [here](#getting-started-postgres)).


# table of contents 
- [al-sql](#al-sql)
- [table of contents](#table-of-contents)
- [Features](#features)
  - [General](#general)
  - [Sql query types](#sql-query-types)
  - [Additional](#additional)
- [Assets](#assets)
- [Getting started (postgres)](#getting-started-postgres)
  - [1. Install package](#1-install-package)
  - [2. Add tables.ts file](#2-add-tablests-file)
  - [3. Use the table](#3-use-the-table)
- [Layer Implementation](#layer-implementation)
  - [AbstractSqlConnection](#abstractsqlconnection)
  - [AbstractSqlDialect](#abstractsqldialect)
  - [Postgres connection via 'pg'](#postgres-connection-via-pg)
- [future features / ideas](#future-features--ideas)
- [contribution](#contribution)

# Features

## General
 - Abstract layer between objects and real database
 - One table and function definition for any sql (an nonesql) database
 - Database assets

## Sql query types
 - create table
 - drop table
 - select
 - update
 - insert
 - delete

## Additional
 - exact or custom where conditions
 - joins
 - foreign keys

Also see: [future features](#future-features--ideas)

# Assets
Example:  
showResult(object, ...options) / showTable(table, ...options)  
![showTables output](https://raw.githubusercontent.com/HalsMaulMajo/al-sql/main/docs/pics/showTables.png)

# Getting started (postgres)
## 1. Install package
```sh
npm i al-sql
```

## 2. Add tables.ts file
```ts
import { SqlClient } from "al-sql"
import { PostgresConnection } from "al-sql/dist/pg"

export const client = new SqlClient(
    new PostgresConnection(
        env.POSTGRES_HOST,
        env.POSTGRES_PORT,
        env.POSTGRES_USER,
        env.POSTGRES_PASSWORD,
        env.POSTGRES_DB
    )
)

// user table example:
export const accountTable = client.getTable(
    "account",
    [ // column example:
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

// friendship example:
export const friendshipTable = client.getTable(
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

export async function getAccountByName(
    name: string
): Promise<number> {
    const result = await accountTable.selectOne(
        ["id"], // SELECT "id" FROM "account" LIMIT 1
        // WHERE name = $1 ("name" is a prepared statement)
        ["name", name]
    )
    if (!result || typeof result.id != "number") {
        throw new Error("User with name '" + name + "' not exists!")
    }
    return result.id
}

export async function getAccountByEmail(
    email: string
): Promise<number> {
    const result = await accountTable.selectOne(
        ["id"], // SELECT "id" from "account" LIMIT 1
        // WHERE email = $1 ("email" is a prepared statement)
        ["email", email]
    )
    if (!result || typeof result.id != "number") {
        throw new Error("User with email '" + email + "' not exists!")
    }
    return result.id
}

export async function createAccount(
    name: string,
    email: string
): Promise<number> {
    const result = await accountTable.insert(
        { // INSERT INTO "account" (name, email) VALUES ($1, $2)
            name: name,
            email: email
        },
        ["id"] // RETURNING "ID"
    )
    if (!result || typeof result.id != "number") {
        throw new Error("User with email '" + email + "' not exists!")
    }
    return result.id
}

export async function requestFriendship(
    senderId: number,
    receiverId: number
): Promise<void> {
    await removeFriendship(senderId, receiverId)

    await friendshipTable.insert({ // INSERT INTO "friendship" (sender_id, receiver_id) VALUES ($1, $2)
        sender_id: senderId,
        receiver_id: receiverId
    })
}

export async function acceptFriendship(
    senderId: number,
    receiverId: number
): Promise<void> {
    await friendshipTable.update(
        { // UPDATE SET accepted = $1
            accepted: true
        },
        [ // WHERE sender_id = $1 AND receiver_id = $2
            "AND",
            ["sender_id", senderId],
            ["receiver_id", receiverId]
        ]
    )
}

export async function getFriends(
    user: number
): Promise<SqlQueryResult> {
    return await friendshipTable.select(
        [ // SELECT sender_id, receiver_id from "friendship"
            "sender_id",
            "receiver_id"
        ],
        [ // WHERE accepted = $1 AND (sender_id = $2 OR receiver_id = $3)
            "AND",
            ["accepted", true],
            [
                "OR",
                ["sender_id", user],
                ["receiver_id", user]
            ]
        ]
    )
}

export async function removeFriendship(
    user1: number,
    user2: number
): Promise<void> {
    await friendshipTable.delete(
        [ // WHERE sender_id = $1 OR receiver_id = $2 
            "OR",
            ["sender_id", user1],
            ["receiver_id", user2]
        ]
    )
}

```

## 3. Use the table
You can use the "createTable()" function of a table to create it.
```ts
import { userTable } from "./tables"

userTable.createTables() // <- returns a Promise<void>
```

You can use the "createTable()" function of a table to create it.
```ts
import { client } from "./tables"

// drops all tables (cascaded) in reversed order
client.dropAllTables() // <- returns a Promise<void>
    .then(async () => {
        // creates all tables in normal order
        await client.createAllTables() // <- returns a Promise<void>
    })
```

Here is a rish example:
```ts
import { showTable } from "al-sql";
import {
    client, accountTable, acceptFriendship,
    createAccount, friendshipTable, requestFriendship
} from "./tables";

(async (): Promise<void> => {
    await client.dropAllTables()
    await client.createAllTables()
    /*
    ----- ACCOUNT TABLE QUERY:
    CREATE TABLE IF NOT EXISTS "account" (
        id SERIAL PRIMARY KEY NOT NULL,
        name VARCHAR (32) UNIQUE NOT NULL,
        email VARCHAR (128) UNIQUE NOT NULL
    ) 
    ----- FRIENDSHIP TABLE QUERY:
    CREATE TABLE IF NOT EXISTS "friendship" (
        id SERIAL PRIMARY KEY NOT NULL,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        accepted BOOL NOT NULL DEFAULT FALSE,
        FOREIGN KEY (
            sender_id
        ) REFERENCES "account" (
            id
        ) ON DELETE CASCADE,
        FOREIGN KEY (
            receiver_id
        ) REFERENCES "account" (
            id
        ) ON DELETE CASCADE
    ) 
    */

    console.log("READY!")

    const tester1 = await createAccount(
        "tester1",
        "1"
    )

    const tester2 = await createAccount(
        "tester2",
        "2"
    )

    const tester3 = await createAccount(
        "tester3",
        "3"
    )

    const tester4 = await createAccount(
        "tester4",
        "4"
    )

    await requestFriendship(
        tester1,
        tester2
    )

    await requestFriendship(
        tester1,
        tester3
    )

    await requestFriendship(
        tester1,
        tester4
    )

    await requestFriendship(
        tester3,
        tester2
    )

    await acceptFriendship(
        tester3,
        tester2
    )

    await acceptFriendship(
        tester1,
        tester4
    )

    await showTable(accountTable)
    await showTable(friendshipTable)
})().catch((err: Error | any) => {
    console.error("UNKNOWN ERROR: ", err)
}).then(() => {
    client.close()
})
```

# Layer Implementation
If you want to create a own abstraction layer implementation you need to implement this two interfaces:
 - AbstractSqlConnection
 - AbstractSqlDialect

## AbstractSqlConnection
This is the sqö connection interface: 
```ts
export interface AbstractSqlConnection {
    getDialect(): AbstractSqlDialect // HERE YOU RETURN YOUR SQL DIALECT IMPLEMENTATION

    execute(query: ExecutableSqlQuery): Promise<SqlQueryExecuteResult>

    isConnected(): Promise<boolean>
    connect(): Promise<void>
    close(): Promise<void>
}
```

## AbstractSqlDialect
This is the sql dialect interface:
```ts
export interface AbstractSqlDialect {
    getDialectName(): string

    getTablesQuery(
        client: SqlClient
    ): ExecutableSqlQuery

    createTableQuery(
        table: SqlTable
    ): ExecutableSqlQuery
    dropTableQuery(
        table: SqlTable
    ): ExecutableSqlQuery

    insertQuery(
        table: SqlTable,
        set: SqlSetValueMap,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery
    updateQuery(
        table: SqlTable,
        set: SqlSetValueMap,
        where?: SqlWhereSelector,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery
    selectQuery(
        table: SqlTable,
        select?: SqlResultColumnSelector,
        where?: SqlJoinWhereSelector,
        join?: number | undefined,
        ...joins: SqlJoin[]
    ): ExecutableSqlQuery
    deleteQuery(
        table: SqlTable,
        where?: SqlWhereSelector,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery
}
```

## Postgres connection via 'pg'
The postgres connection implementation looks like this:
```ts
export class PostgresConnection implements AbstractSqlConnection {
    public readonly client: Client
    public readonly dialect: PostgresSqlDialect
    public connected: boolean = false

    constructor(
        public readonly host: string,
        public readonly port: number,
        public readonly username: string,
        public readonly password: string,
        public readonly database: string
    ) {
        this.client = new Client({ // <- "Client" is a export of the "pg"-package (postgres-client)
            host: host,
            port: port,
            user: username,
            password: password,
            database: database
        })
        this.dialect = new PostgresSqlDialect()
    }

    getDialect(): AbstractSqlDialect {
        return this.dialect
    }

    async execute(query: ExecutableSqlQuery): Promise<SqlQueryExecuteResult> {
        try{
            return this.client.query(
                query[0],
                query.slice(1)
            )
        }catch(err: Error | any){
            await this.client.end().catch(() => {})
            this.connected = false
            throw err
        }
    }

    async isConnected(): Promise<boolean> {
        return this.connected
    }

    async connect(): Promise<void> {
        await this.client.connect()
        this.connected = true
    }

    async close(): Promise<void> {
        await this.client.end()
        this.connected = false
    }
}
```

# future features / ideas
 - Query caching: caching for the sql query string
 - Alter Table: edit / adjust tables
 - Mysql/MariaDB example: a example implementation for the mysql dialect
 - More examples: more table structure examples

# contribution
 - 1. fork the project
 - 2. implement your idea
 - 3. create a pull/merge request
```ts
// please create seperated forks for different kind of featues/ideas/structure changes/implementations
```

---
**cya ;3**  
*by HalsMaulMajo*