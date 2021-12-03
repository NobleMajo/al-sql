
export declare interface Client {
    new(connectInfo: any): Client

    query(query: string, parameter: any[]): Promise<any>
    connect(): Promise<void>
    end(): Promise<void>
}

let Client: Client
try {
    let pg: any
    if (Boolean(process.env.PG_FAKE_CLIENT) === true) {
        pg = require("./fakeClient")
    } else {
        pg = require("pg")
    }
    Client = pg.Client
} catch (error) {
    throw new Error("You need to install the 'pg' module to use this progres implementation!")
}

import {
    AbstractSqlConnection, AbstractSqlDialect,
    Column, ExecutableSqlQuery, SqlJoin,
    SqlJoinWhereSelector, SqlQueryExecuteResult, SqlResultColumnSelector,
    SqlSetValueMap, SqlTable,
    SqlValue, SqlWhereSelector
} from "./index"

export class PostgresSqlDialect implements AbstractSqlDialect {
    getDialectName(): string {
        return "postgres"
    }

    getDatabasesQuery(): ExecutableSqlQuery {
        return [
            `SELECT * FROM pg_database`
        ]
    }

    getTablesQuery(
    ): ExecutableSqlQuery {
        return [
            `SELECT *` +
            ` FROM pg_catalog.pg_tables` +
            ` WHERE` +
            ` schemaname != 'pg_catalog' AND schemaname != 'information_schema'`
        ]
    }

    createWhereQuery(
        where: SqlWhereSelector,
        i: number,
    ): ExecutableSqlQuery {
        let parts: string[] = []
        const values: SqlValue[] = []

        Object.keys(where).forEach((key: string) => {
            const value = where[key]
            if (key == "_" && typeof value == "string") {
                values.push(value)
            } else if (value == null) {
                parts.push(key + ' IS NULL')
            } else {
                parts.push(key + '=$' + i++)
                values.push(value)
            }
        })

        return [
            parts.join(" AND "),
            ...values
        ]
    }

    createJoinWhereQuery(
        where: SqlJoinWhereSelector,
        i: number,
        currentTableName: string,
    ): ExecutableSqlQuery {
        const parts: string[] = []
        const values: SqlValue[] = []

        Object.keys(where).forEach((key: string) => {
            const value = where[key]
            if (typeof value == "object" && value != null) {
                Object.keys(value).forEach((key2: string) => {
                    const value2 = value[key2]
                    if (value2 == null) {
                        parts.push(key + '.' + key2 + ' IS NULL')
                    } else {
                        parts.push(key + '.' + key2 + '=$' + i++)
                        values.push(value[key2])
                    }
                })
            } else {
                if (key == "_" && typeof value == "string") {
                    parts.push(value)
                } else if (value == null) {
                    parts.push('"' + currentTableName + '".' + key + ' IS NULL')
                } else {
                    parts.push('"' + currentTableName + '".' + key + '=$' + i++)
                    values.push(value)
                }

            }
        })
        return [
            parts.join(" AND "),
            ...values
        ]
    }

    createSelectQuery(
        select: SqlResultColumnSelector,
    ): string {
        if (select == null) {
            return "*"
        } else if (typeof select == "string") {
            select = [select]
        }
        if (Array.isArray(select)) {
            return select.map(
                (s) => {
                    if (typeof s == "string") {
                        return '"' + s + '"'
                    }
                    return `"${s[0]}"."${s[1]}"`
                }
            ).join(", ")
        } else {
            return "*"
        }
    }

    createColumnQuery(
        column: Column
    ): string {
        let line: string = column.name + " " + column.type.toUpperCase()
        if (column.size) {
            line += "(" + column.size + ")"
        }
        if (column.unique) {
            line += " UNIQUE"
        } else if (column.primaryKey) {
            line += " PRIMARY KEY"
        }
        if (column.nullable) {
            line += " NULL"
        } else {
            line += " NOT NULL"
        }
        const type = typeof column.default
        if (type != "undefined") {
            line += " DEFAULT "
            if (type == null) {
                line += "NULL"
            } else if (type == "boolean") {
                line += column.default == true ? "TRUE" : "FALSE"
            } else if (type == "number") {
                line += Number(column.default)
            } else if (type == "string") {
                line += "'" + (column.default as string).split("'").join("\\'") + "'"
            } else {
                throw new Error("Type of default value is not string, number, boolean or null!")
            }
        }
        return line
    }

    createTableQuery(
        table: SqlTable
    ): ExecutableSqlQuery {
        let line: string = table.columns.map(
            (c) => this.createColumnQuery(c)
        ).join(", ")

        if (table.foreignKey && table.foreignKey.length > 0) {
            line += "," + table.foreignKey.map(
                (fKey) =>
                    ` FOREIGN KEY(${fKey.columnName}) REFERENCES "${fKey.foreignTableName}" (${fKey.foreignColumnName}) ON DELETE CASCADE`
            ).join(",")
        }

        line = `CREATE TABLE IF NOT EXISTS "${table.name}"(${line})`

        return [
            line
        ]
    }

    dropTableQuery(
        table: SqlTable
    ): ExecutableSqlQuery {
        return [
            `DROP TABLE IF EXISTS "${table.name}" CASCADE`
        ]
    }

    insertQuery(
        table: SqlTable,
        set: SqlSetValueMap,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery {
        let i: number = 1
        let line = `INSERT INTO "${table.name}"`
        line += ` (${Object.keys(set).join(", ")})`
        line += ` VALUES (${Object.keys(set).map(() => "$" + i++).join(", ")})`
        if (typeof returning != "undefined") {
            line += ` RETURNING ${this.createSelectQuery(returning)}`
        }
        return [
            line,
            ...Object.values(set)
        ]
    }

    updateQuery(
        table: SqlTable,
        set: SqlSetValueMap,
        where?: SqlWhereSelector,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery {
        let i: number = 1
        let line = `UPDATE "${table.name}"`
        line += ` SET ${Object.keys(set).map((k) => k + "=$" + i++).join(", ")}`
        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            const whereData = this.createWhereQuery(where, i)
            i += whereData.length - 1
            line += ` WHERE ${whereData[0]}`
            values = whereData.slice(1)
        }
        if (typeof returning != "undefined") {
            line += ` RETURNING ${this.createSelectQuery(returning)}`
        }
        return [
            line,
            ...Object.values(set),
            ...values
        ]
    }

    selectQuery(
        table: SqlTable,
        select: SqlResultColumnSelector = null,
        where?: SqlJoinWhereSelector,
        limit?: number | undefined,
        ...joins: SqlJoin[]
    ): ExecutableSqlQuery {
        let line = `SELECT ${this.createSelectQuery(select)}`
        line += ` FROM "${table.name}"`
        if (joins && joins.length > 0) {
            joins.forEach((join) => {
                line += ` ${join.join ?? "INNER"} JOIN "${join.targetTable}"`
                line += ` ON "${join.targetTable}".${join.targetKey} = "${join.sourceTable ?? table.name}".${join.sourceKey}`
            })
        }
        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            const whereData = this.createJoinWhereQuery(where, 1, table.name)
            line += ` WHERE ${whereData[0]}`
            values = whereData.slice(1)
        }
        if (limit && limit > 0) {
            line += " LIMIT " + limit
        }
        return [
            line,
            ...values
        ]
    }

    deleteQuery(
        table: SqlTable,
        where?: SqlWhereSelector,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery {
        let line = `DELETE FROM "${table.name}"`

        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            const whereData = this.createWhereQuery(where, 1)
            line += ` WHERE ${whereData[0]}`
            values = whereData.slice(1)
        }

        if (typeof returning != "undefined") {
            line += ` RETURNING ${this.createSelectQuery(returning)}`
        }
        return [
            line,
            ...values
        ]
    }
}

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
        this.client = new Client({
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

    execute(query: ExecutableSqlQuery): Promise<SqlQueryExecuteResult> {
        return this.client.query(
            query[0],
            query.slice(1)
        )
    }

    async isConnected(): Promise<boolean> {
        return this.connected
    }

    connect(): Promise<void> {
        return this.client.connect().then(() => {
            this.connected = true
        })
    }

    close(): Promise<void> {
        return this.client.end().then(() => {
            this.connected = false
        })
    }
}