import { SqlClient, SqlQueryResult, SqlTable } from '../index';

export interface FriendshipTables {
    accountTable: SqlTable,
    friendshipTable: SqlTable,
}

export function createFriendshipTables(
    client: SqlClient
): FriendshipTables {
    // user table example:
    const accountTable = client.getTable(
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
    const friendshipTable = client.getTable(
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

    return {
        accountTable,
        friendshipTable,
    }
}

export async function getAccountByName(
    accountTable: SqlTable,
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
    accountTable: SqlTable,
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
    accountTable: SqlTable,
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
    friendshipTable: SqlTable,
    senderId: number,
    receiverId: number
): Promise<void> {
    await removeFriendship(friendshipTable, senderId, receiverId)

    await friendshipTable.insert({ // INSERT INTO "friendship" (sender_id, receiver_id) VALUES ($1, $2)
        sender_id: senderId,
        receiver_id: receiverId
    })
}

export async function acceptFriendship(
    friendshipTable: SqlTable,
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
    friendshipTable: SqlTable,
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
    friendshipTable: SqlTable,
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
