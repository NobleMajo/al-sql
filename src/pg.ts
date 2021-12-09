
export declare interface Client {
    new(connectInfo: any): Client

    query(query: string, parameter: any[]): Promise<any>
    connect(): Promise<void>
    end(): Promise<void>
}

let pg: any
try {
    pg = require("pg")
} catch (error) {
    if (Boolean(process.env.PG_FAKE_CLIENT) === true) {
        pg = require("./fakeClient")
    } else {
        throw new Error("You need to install the 'pg' module to use this postgres implementation!")
    }
}
let Client: Client = pg.Client

import {
    AbstractSqlConnection, AbstractSqlDialect,
    Column, ExecutableSqlQuery, SqlFieldCondition, SqlJoin,
    SqlQueryExecuteResult, SqlRawCondition, SqlResultColumnSelector,
    SqlSetValueMap, SqlTable,
    SqlValue,
    SqlCondition,
    toPrettyString,
    SqlConditionMerge
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

    getTableStructure(
        table: SqlTable
    ): ExecutableSqlQuery {
        return [
            `select column_name, data_type, character_maximum_length ` +
            `from INFORMATION_SCHEMA.COLUMNS where table_name = $1`,
            table.name
        ]
    }

    createSqlFieldCondition(
        currentTable: string,
        condition: SqlFieldCondition,
        valueCounter: [number]
    ): ExecutableSqlQuery {
        if (condition.length < 2) {
            throw new Error("A sql field condition needs minimum 2 value!")
        }

        let selectedTable: string = currentTable
        let selectedField: string
        let is: boolean = true
        let values: SqlValue[] = condition.slice(1) as SqlValue[]

        if (values.length == 0) {
            throw new Error("A sql condition needs minimum 1 value!")
        }

        if (typeof condition[0] == "string") {
            selectedField = condition[0]
        } else if (Array.isArray(condition[0])) {
            switch (condition[0].length as number) {
                case 2:
                    if (condition[0][1].toUpperCase() == "NOT") {
                        is = false
                        selectedField = condition[0][0]
                    } else {
                        selectedTable = condition[0][0]
                        selectedField = condition[0][1]
                    }
                    break;
                case 0:
                case 1:
                    throw new Error("The first value of a condition needs to be a array with 2-3 values!")
                default:
                    selectedTable = condition[0][0]
                    selectedField = condition[0][1]
                    if (("" + condition[0][2]).toUpperCase() == "NOT") {
                        is = false
                    }
                    break;
            }
        } else {
            throw new Error("The first value of a condition needs to be a array with 2-3 values or a string!")
        }

        const query: ExecutableSqlQuery = [
            `${selectedTable}.${selectedField}`
        ]
        if (values.length > 1) {
            values.forEach((value) => query.push(value))
            let i = valueCounter
            if (is) {
                query[0] += " IN ("
            } else {
                query[0] += " NOT IN ("
            }
            query[0] += values
                .map(() => "$" + (valueCounter[0]++))
                .join(", ") + ")"
        } else {
            if (values[0] == null) {
                if (is) {
                    query[0] += " IS NULL"
                } else {
                    query[0] += " IS NOT NULL"
                }
            } else {
                query.push(values[0])
                if (is) {
                    query[0] += " = $" + (valueCounter[0]++)
                } else {
                    query[0] += " != $" + (valueCounter[0]++)
                }
            }
        }
        return query
    }

    createSqlRawCondition(
        currentTable: string,
        condition: SqlRawCondition,
        valueCounter: [number]
    ): ExecutableSqlQuery {
        if (typeof condition.query != "string") {
            throw new Error("The 'query' value of a raw condition is not a string!")
        } else if (!Array.isArray(condition.values)) {
            throw new Error("The 'values' vakue of a raw condition is not an array!")
        }
        let i: number = 1
        while (condition.query.includes("$" + i)) {
            condition.query = condition.query
                .split("$" + (i++))
                .join("$" + (valueCounter[0]++))
        }
        return [condition.query, ...condition.values]
    }

    createSqlConditionMerge(
        currentTable: string,
        condition: SqlConditionMerge,
        valueCounter: [number]
    ): ExecutableSqlQuery {
        if (condition.length < 3) {
            throw new Error("A sql condition merge needs minimum 3 value!")
        }

        const querys: ExecutableSqlQuery[] = []
        const and: boolean = condition[0].toUpperCase() != "OR"
        const condition2: SqlCondition[] = condition.slice(1) as SqlCondition[]
        if (condition.length <= 0) {
            throw new Error("A sql join where selector needs minimum 1 condition!")
        }
        condition2.forEach((condition3) => querys.push(this.createSqlCondition(
            currentTable,
            condition3,
            valueCounter
        )))

        const conditions: string[] = []
        const values: SqlValue[] = []
        querys.forEach((query) => {
            query.slice(1).forEach((value: SqlValue) => values.push(value))
            conditions.push(query[0])
        })

        return [
            "(" + conditions.join(and ? " AND " : " OR ") + ")",
            ...values
        ]
    }

    createSqlCondition(
        currentTable: string,
        condition: SqlCondition,
        valueCounter: [number]
    ): ExecutableSqlQuery {
        if (Array.isArray(condition)) {
            if (condition.length < 1) {
                throw new Error("A sql condition array needs minimum 1 value!")
            }
            const first = condition[0]
            if (
                typeof first == "string" &&
                (
                    first == "AND" ||
                    first == "OR"
                )
            ) {
                return this.createSqlConditionMerge(
                    currentTable,
                    condition as SqlConditionMerge,
                    valueCounter
                )
            } else {
                return this.createSqlFieldCondition(
                    currentTable,
                    condition as SqlFieldCondition,
                    valueCounter
                )
            }
        } else if (typeof condition == "object" || condition != null) {
            return this.createSqlRawCondition(
                currentTable,
                condition as SqlRawCondition,
                valueCounter
            )
        }
        throw new Error("Unknown where type!")
    }

    createSqlWhereCondition(
        currentTable: string,
        condition: SqlCondition,
        valueCounter: [number]
    ): ExecutableSqlQuery {
        try {
            return this.createSqlCondition(
                currentTable,
                condition,
                valueCounter
            )
        } catch (err: Error | any) {
            const msgSuffix: string = "\nType of condition is: " +
                typeof condition +
                "\nvalue:\n" +
                toPrettyString(condition, { maxLevel: 2 })
            if (typeof err == "string") {
                err += msgSuffix
            } else if (typeof err.msg == "string") {
                err.msg += msgSuffix
            } else if (typeof err.message == "string") {
                err.message += msgSuffix
            }
            throw err
        }

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
        let i: [number] = [1]
        let line = `INSERT INTO "${table.name}"`
        line += ` (${Object.keys(set).join(", ")})`
        line += ` VALUES (${Object.keys(set).map(() => "$" + (i[0]++)).join(", ")})`
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
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery {
        let i: [number] = [1]
        let line = `UPDATE "${table.name}"`
        line += ` SET ${Object.keys(set).map((k) => k + "=$" + (i[0]++)).join(", ")}`
        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            const whereData = this.createSqlWhereCondition(table.name, where, i)
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
        where?: SqlCondition,
        limit?: number | undefined,
        ...joins: SqlJoin[]
    ): ExecutableSqlQuery {
        let line = `SELECT ${this.createSelectQuery(select)}`
        line += ` FROM "${table.name}"`
        if (joins && joins.length > 0) {
            joins.forEach((join) => {
                const tableName: string = join.as ? join.as : join.targetTable
                line += ` ${join.join ?? "INNER"} JOIN "${join.targetTable}"${join.as ? " " + join.as : ""}`
                line += ` ON "${tableName}".${join.targetKey} = "${join.sourceTable ?? table.name}".${join.sourceKey}`
            })
        }
        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            let i: [number] = [1]
            const whereData = this.createSqlWhereCondition(table.name, where, i)
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
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery {
        let line = `DELETE FROM "${table.name}"`

        let values: any[] = []
        if (where && Object.keys(where).length > 0) {
            let i: [number] = [1]
            const whereData = this.createSqlWhereCondition(table.name, where, i)
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