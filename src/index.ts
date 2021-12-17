import "colors"
import crypto from "crypto"

export type ColumnType = "SERIAL" | "VARCHAR" | "TEXT" | "LONG" | "INT" | "BOOL" | string

export interface Column {
    name: string,
    type: ColumnType,
    nullable: boolean | undefined,
    size?: number | undefined,
    unique?: boolean | undefined,
    primaryKey?: boolean | undefined,
    default?: SqlValue
}

export interface ForeignKey {
    columnName: string,
    foreignTableName: string,
    foreignColumnName: string,
}

export type SqlValue = string | number | boolean | null | undefined

export interface SqlQueryResultRow {
    [key: string]: SqlValue
}

export type SqlQueryResult = SqlQueryResultRow[]

export interface SqlQueryExecuteResult {
    rows: SqlQueryResult
}

export type ExecutableSqlQuery = [string, ...SqlValue[]]

export interface SqlSetValueMap {
    [key: string]: SqlValue
}

export interface Colume {
    name: string,
    type: string,
    primary: boolean,
    nullable: boolean,
}

export interface ForeignKeys {
    [keyName: string]: ForeignKey
}

export interface Table {
    name: string,
    createQuery: string,
    colums: Colume[],
    foreignKeys: ForeignKeys
}

export type Tables = Table[]

export interface TableMap {
    [tableName: string]: Table
}

export type OrOperator = "OR"
export type AndOperator = "AND"
export type AndOrOrOperator = OrOperator | AndOperator

export type IsOperator = "IS"
export type NotOperator = "NOT"
export type IsOrNotOperator = IsOperator | NotOperator

export type SqlFieldCondition = [
    string | [string, string] | [string, IsOrNotOperator] | [string, string, IsOrNotOperator],
    SqlValue,
    ...SqlValue[]
]
export type SqlRawCondition = {
    query: string,
    values: SqlValue[]
}
export type SqlConditionMerge = [
    AndOrOrOperator,
    SqlCondition,
    SqlCondition,
    ...SqlCondition[]
]

export type SqlCondition = SqlConditionMerge | SqlRawCondition | SqlFieldCondition

export type SqlResultColumnSelector = (
    (
        string |
        [string] |
        [string, string] |
        [string, string, string]
    )[]
    |
    string
    |
    null
)

export interface SqlJoin {
    join?: undefined | "LEFT" | "RIGHT" | "FULL",
    as?: string,
    sourceTable?: string,
    sourceKey: string
    targetTable: string,
    targetKey: string,
}

export interface AbstractSqlDialect {
    getDialectName(): string

    getTablesQuery(
        client: SqlClient
    ): ExecutableSqlQuery

    getTableStructure(
        table: SqlTable
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
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery
    selectQuery(
        table: SqlTable,
        select?: SqlResultColumnSelector,
        where?: SqlCondition,
        join?: number | undefined,
        ...joins: SqlJoin[]
    ): ExecutableSqlQuery
    deleteQuery(
        table: SqlTable,
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): ExecutableSqlQuery
}

export interface AbstractSqlConnection {
    getDialect(): AbstractSqlDialect

    execute(query: ExecutableSqlQuery): Promise<SqlQueryExecuteResult>

    isConnected(): Promise<boolean>
    connect(): Promise<void>
    close(): Promise<void>
}

export class SqlClient {
    public readonly dialect: AbstractSqlDialect
    public closeTimeout: NodeJS.Timeout | undefined = undefined

    public connected: boolean = false
    public connectPromise: Promise<void> | undefined
    public closePromise: Promise<void> | undefined

    public readonly querys: ExecutableSqlQuery[] = []

    public clearQueryList(): void {
        while (this.querys.length) {
            this.querys.shift()
        }
    }

    constructor(
        public readonly connection: AbstractSqlConnection,
        public connectionTime: number = 1000 * 45,
        public listQuery: boolean = false,
        public queryCallback?: (query: ExecutableSqlQuery, client: SqlClient) => void
    ) {
        this.dialect = connection.getDialect()
    }

    async execute(query: ExecutableSqlQuery): Promise<SqlQueryExecuteResult> {
        if (this.closePromise) {
            await this.closePromise
        }
        if (this.connectPromise) {
            await this.connectPromise
        }
        if (!await this.connection.isConnected()) {
            await this.connect()
        }
        if (this.queryCallback) {
            this.queryCallback(query, this)
        }
        if (this.listQuery) {
            this.querys.push(query)
        }
        const ret = await this.connection.execute(query).catch((err) => {
            err.message = "Error while execute following query:\n```sql\n" +
                query[0] +
                "\n```\n" +
                err.message
            throw err
        })
        if (this.connectionTime < 1) {
            await this.close()
        }
        return ret
    }

    async connect(): Promise<void> {
        if (this.closePromise) {
            await this.closePromise
        }
        if (this.connectPromise) {
            await this.connectPromise
        }
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout)
        }
        if (this.connectionTime < 1) {
            this.closeTimeout = setTimeout(
                () => this.close(),
                this.connectionTime
            )
        }
        this.connectPromise = this.connection.connect()
        await this.connectPromise
        this.connectPromise = undefined
    }

    async close(): Promise<void> {
        if (this.connectPromise) {
            await this.connectPromise
        }
        if (this.closePromise) {
            await this.closePromise
        }
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout)
            this.closeTimeout = undefined
        }
        this.closePromise = this.connection.close()
        await this.closePromise
        this.closePromise = undefined
    }

    private tables: SqlTable[] = []

    async createAllTables(): Promise<void> {
        for (let index = 0; index < this.tables.length; index++) {
            const table = this.tables[index]
            await table.createTable()
        }
    }

    async dropAllTables(): Promise<void> {
        for (let index = this.tables.length - 1; index >= 0; index--) {
            const table = this.tables[index]
            await table.dropTable()
        }
    }

    getSqlTables(): SqlTable[] {
        return this.tables
    }

    resetSqlTables(): void {
        this.tables = []
    }

    removeTableByName(table: SqlTable): void {
        this.tables = this.tables.filter((t) => t.name == table.name)
    }

    getTable(
        name: string,
        columns?: Column[],
        foreignKey?: ForeignKey[],
    ): SqlTable {
        const table = new SqlTable(
            this,
            name,
            columns ?? [],
            foreignKey ?? []
        )
        this.tables.push(table)
        return table
    }

    async getTables(): Promise<SqlQueryExecuteResult> {
        return await this.execute(
            this.dialect.getTablesQuery(this)
        )
    }
}

export class SqlTable {
    constructor(
        public readonly database: SqlClient,
        public readonly name: string,
        public readonly columns: Column[],
        public readonly foreignKey: ForeignKey[],
    ) {
    }

    async exist(): Promise<boolean> {
        return (await this.getStructure()) == undefined
    }

    async getStructure(): Promise<SqlQueryResultRow | undefined> {
        return (
            await this.database.execute(
                this.database.dialect.getTableStructure(
                    this
                )
            )
        ).rows.shift()
    }

    async getStructureHash(): Promise<string | undefined> {
        const struct = await this.getStructure()
        if (!struct) {
            return undefined
        }
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(struct))
            .digest('hex')
    }

    async createTable(): Promise<void> {
        await this.database.execute(
            this.database.dialect.createTableQuery(
                this
            )
        )
    }

    async dropTable(): Promise<void> {
        await this.database.execute(
            this.database.dialect.dropTableQuery(
                this
            )
        )
    }

    async insert(
        set: SqlSetValueMap,
        returning?: SqlResultColumnSelector | undefined,
    ): Promise<SqlQueryResultRow> {
        return (
            await this.database.execute(
                this.database.dialect.insertQuery(
                    this,
                    set,
                    returning
                )
            )
        ).rows[0]
    }

    async update(
        set: SqlSetValueMap,
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): Promise<SqlQueryResult> {
        return (
            await this.database.execute(
                this.database.dialect.updateQuery(
                    this,
                    set,
                    where,
                    returning
                )
            )
        ).rows
    }

    async select(
        select?: SqlResultColumnSelector,
        where?: SqlCondition,
        limit?: number | undefined,
        ...joins: SqlJoin[]
    ): Promise<SqlQueryResult> {
        return (
            await this.database.execute(
                this.database.dialect.selectQuery(
                    this,
                    select,
                    where,
                    limit,
                    ...joins
                )
            )
        ).rows
    }


    async selectOne(
        select?: SqlResultColumnSelector | undefined,
        where?: SqlCondition,
        ...joins: SqlJoin[]
    ): Promise<SqlQueryResultRow | undefined> {
        const rows = await this.select(select, where, 1, ...joins)
        if (rows.length < 1) {
            return undefined
        }
        return rows[0]
    }

    async delete(
        where?: SqlCondition,
        returning?: SqlResultColumnSelector | undefined,
    ): Promise<SqlQueryResult> {
        return (
            await this.database.execute(
                this.database.dialect.deleteQuery(
                    this,
                    where,
                    returning
                )
            )
        ).rows
    }
}