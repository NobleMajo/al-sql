import { SqlClient } from "../src/index"
import { PostgresConnection } from "../src/pg"

export const client = new SqlClient(
    new PostgresConnection(
        process.env.POSTGRES_HOST,
        Number(process.env.POSTGRES_PORT),
        process.env.POSTGRES_USER,
        process.env.POSTGRES_PASSWORD,
        process.env.POSTGRES_DB
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
            
        }
        [
            "AND",
          
        ]
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