# al-sql

"al-sql" is a Abstraction_Layer for sql databases to perform simple sql querys.

There is already a working postgres abstraction implementation that you can use for a postgres databases or as base to create a own abstraction implementation.

# Getting started (postgres)
## 1. Install package
```sh
npm i al-sql
```

## 2. Add tables.ts file
```ts
import { SqlClient } from "al-sql"
import { PostgressConnection } from "al-sql/dist/pg"

export const client = new SqlClient(
    new PostgressConnection(
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
        { // WHERE name = $1 ("name" is a prepared statement)
            name: name
        }
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
        { // WHERE email = $1 ("email" is a prepared statement)
            email: email
        }
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
        { // WHERE sender_id = $1 AND receiver_id = $2
            sender_id: senderId,
            receiver_id: receiverId
        }
    )
}

export async function getFriends(
    user: number
): Promise<number[]> {
    const result = await Promise.all([
        friendshipTable.select(
            [ // SELECT "friendship".sender_id from "friendship"
                ["friendship", "sender_id"],
            ],
            { // WHERE receiver_id = $1
                receiver_id: user,
            },
        ),
        friendshipTable.select(
            [ // SELECT "friendship".receiver_id from "friendship"
                ["friendship", "receiver_id"],
            ],
            { // WHERE sender_id = $1
                sender_id: user,
            }
        )
    ])
    // merge results together
    const friends: number[] = []
    result[0].forEach((f) => friends.push(f.sender_id as number))
    result[1].forEach((f) => friends.push(f.receiver_id as number))

    return friends
}

export async function removeFriendship(
    user1: number,
    user2: number
): Promise<void> {
    await Promise.all([
        friendshipTable.delete(
            { // DELETE FROM "friendship" WHERE sender_id = $1 AND receiver_id = $2
                sender_id: user1,
                receiver_id: user2
            }
        ),
        friendshipTable.delete(
            { // DELETE FROM "friendship" WHERE sender_id = $1 AND receiver_id = $2
                sender_id: user2,
                receiver_id: user1
            }
        )
    ])
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
export class PostgressConnection implements AbstractSqlConnection {
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

# contribution
 - 1. fork the project
 - 2. implement your idea
 - 3. create a pull/merge request
```ts
// please create seperated forks for different kind of featues/ideas/structure changes/implementations
```

# cya ;3
##### by HalsMaulMajo