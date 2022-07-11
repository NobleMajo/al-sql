import "colors"
import * as crypto from "crypto"

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
        string
        |
        [string, string]
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

    public connectPromise: Promise<void> | undefined
    public closePromise: Promise<void> | undefined

    private readonly querys: ExecutableSqlQuery[] = []

    shiftQuery(): ExecutableSqlQuery | undefined {
        return this.querys.shift()
    }

    clearQuerys(): ExecutableSqlQuery[] {
        let querys: ExecutableSqlQuery[] = []
        while (this.querys.length > 0) {
            querys.push(this.querys.shift())
        }
        return querys
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
        if (!await this.connection.isConnected()) {
            await this.connect()
        }
        if (this.queryCallback) {
            this.queryCallback(query, this)
        }
        if (this.listQuery) {
            this.querys.push(query)
        }
        return await this.connection.execute(query).catch((err) => {
            err.message = "Error while execute following query:\n```sql\n" + query[0] + "\n```\n" +

                err.message

            throw err
        })
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
        this.closeTimeout = setTimeout(
            async () => {
                await this.close().catch(() => { })
                this.closeTimeout = undefined
            },
            this.connectionTime
        )
        if (await this.connection.isConnected()) {
            return
        }

        return this.connectPromise = this.connection.connect().then(() => {
            this.connectPromise = undefined
        })
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
        }
        if (!(await this.connection.isConnected())) {
            return
        }
        return this.closePromise = this.connection.close().then(() => {
            this.closePromise = undefined
        })
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

export function removeSpaces(query: string): string {
    while (query.startsWith(" ") || query.startsWith("\n")) {
        query = query.substring(1)
    }
    while (query.endsWith(" ") || query.endsWith("\n")) {
        query = query.slice(0, -1)
    }
    return query
}

export function toPrettyQuery(
    query: string,
    queryKeywords: string[] = [
        "SELECT",
        "DELETE",
        "UPDATE",
        "INSERT",
        "FROM",
        "INTO",
        "WHERE",
        "INNER JOIN",
        "LEFT JOIN",
        "RIGHT JOIN",
        "FULL JOIN",
        "ON",
    ]
): string {
    query = query
        .split("\n").map((q) => removeSpaces(q)).join(" ")
        .split(";").map((q) => removeSpaces(q)).join("; ")
    while (query.includes("  ")) {
        query = query
            .split("  ").join(" ")
    }
    query = (" " + query + " ")
    queryKeywords.forEach((keyword) => {
        query = query
            .split(" " + keyword + " ")
            .map((q) => removeSpaces(q))
            .join("\n" + keyword + "\n    ")
    })
    query = removeSpaces(query)
    return query
        .split("=").map((q) => removeSpaces(q)).join("=")
        .split("=").map((q) => removeSpaces(q)).join("=")
        .split(",").map((q) => removeSpaces(q)).join(",\n    ")
        .split("(").map((q) => removeSpaces(q)).join(" (\n    ")
        .split(")").map((q) => removeSpaces(q)).join("\n) ")
}

export function createFillerString(value: string, size: number): string {
    let i = 0
    let filler: string = ""
    while (i < size) {
        filler += value
        i++
    }
    return filler
}

export function isSqlValue(value: any): boolean {
    const type = typeof value
    return value == null || type == "string" || type == "number" || type == "boolean"
}

export interface PrettyStringOptions {
    stringFont?: Font,
    numberFont?: Font,
    booleanFont?: Font,
    objectFont?: Font,
    objectKeyFont?: Font,
    arrayFont?: Font,
    nullFont?: Font,
    undefinedFont?: Font,
    functionFont?: Font,
    tabSpaces?: number,
    level?: number,
    maxLevel?: number,
}

export interface PrettyStringSettings {
    stringFont?: Font,
    numberFont?: Font,
    booleanFont?: Font,
    objectFont?: Font,
    objectKeyFont?: Font,
    arrayFont?: Font,
    nullFont?: Font,
    undefinedFont?: Font,
    functionFont?: Font,
    tabSpaces: number,
    level: number,
    maxLevel: number,
}

export function toPrettyString(
    obj: any,
    options?: PrettyStringOptions,
): string {
    const settings: PrettyStringSettings = {
        stringFont: ["green", null],
        numberFont: ["yellow", null],
        booleanFont: ["blue", null],
        objectFont: ["gray", null],
        objectKeyFont: ["white", null],
        arrayFont: ["gray", null],
        nullFont: ["magenta", null],
        undefinedFont: ["magenta", null],
        functionFont: ["blue", null],
        tabSpaces: 4,
        level: 0,
        maxLevel: -1,
        ...options
    }
    const type = typeof obj
    if (type == "string") {
        return styleText('"' + obj + '"', settings.stringFont)
    } else if (type == "number") {
        return styleText("" + obj, settings.numberFont)
    } else if (type == "boolean") {
        return styleText(obj == true ? "TRUE" : "FALSE", settings.booleanFont)
    } else if (type == "undefined") {
        return styleText("UNDEFINED", settings.undefinedFont)
    } else if (type == "object") {
        if (obj == null) {
            return styleText("NULL", settings.nullFont)
        } else if (Array.isArray(obj)) {
            let line: string = ""
            if (obj.length == 0) {
                line += styleText("[]", settings.arrayFont)
            } else if (settings.maxLevel == settings.level) {
                line += styleText("[...]", settings.arrayFont)
            } else {
                line += styleText("[\n" + createFillerString(" ", settings.level * settings.tabSpaces + settings.tabSpaces) + "1. ", settings.arrayFont) +
                    obj
                        .map(
                            (value: any, index: number) => {
                                let line = toPrettyString(value, {
                                    ...settings,
                                    level: settings.level + 1
                                })
                                if (index < obj.length - 1) {
                                    line += styleText(",\n" + createFillerString(" ", settings.level * settings.tabSpaces + settings.tabSpaces) + (index + 2) + ". ", settings.arrayFont)
                                }
                                return line
                            }
                        ).join("") +
                    styleText("\n" + createFillerString(" ", settings.level * settings.tabSpaces) + "]", settings.arrayFont)
            }
            return line
        } else {
            let line: string = ""
            if (
                obj instanceof Object &&
                obj.constructor &&
                typeof obj.constructor.name == "string" &&
                obj.constructor.name != "Object"
            ) {
                line +=
                    styleText("[", settings.objectFont) +
                    styleText(obj.constructor.name, settings.objectKeyFont) +
                    styleText("] ", settings.objectFont)
            }
            if (Object.keys(obj).length == 0) {
                line += styleText("{}", settings.arrayFont)
            } else {
                line += styleText("{\n" + createFillerString(" ", settings.level * settings.tabSpaces + settings.tabSpaces), settings.objectFont) +
                    Object.keys(obj).map(
                        (key: string) =>
                            styleText(key, settings.objectKeyFont) +
                            styleText(": ", settings.objectFont) +
                            toPrettyString(obj[key], {
                                ...settings,
                                level: settings.level + 1
                            })
                    )
                        .join(
                            styleText(",\n" + createFillerString(" ", settings.level * settings.tabSpaces + settings.tabSpaces), settings.objectFont)
                        ) +
                    styleText("\n" + createFillerString(" ", settings.level * settings.tabSpaces) + "}", settings.objectFont)
            }
            return line
        }
    } else if (type == "function") {
        return styleText("FUNCTION", settings.booleanFont)
    }
    return "" + obj
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

export async function asyncMap<I, T>(
    arr: I[],
    cb: (value: I) => undefined | Promise<undefined | T>
): Promise<T[]> {
    const promises: Promise<undefined | T>[] = []
    for (let index = 0; index < arr.length; index++) {
        const input = arr[index]
        const promise = cb(input)
        if (promise) {
            promises.push(promise)
        }
    }
    const ret: T[] = []
    for (let index = 0; index < promises.length; index++) {
        const promise = promises[index];
        const out = await promise
        if (out) {
            ret.push(out)
        }
    }
    return ret
}

export function jsTypeToPostgresType(type: string, length: number = -1): [string, number] {
    type = type.toLowerCase()
    switch (type) {
        case "string":
            if (length > 128) {
                return ["text", length]
            }
            return ["varchar", length]
        case "number":
            return ["int", length]
        case "boolean":
            return ["bool", length]
        default:
            return [type, length]
    }
}

export function postgresTypeToJsType(type: string, length: number = -1): [string, number] {
    type = type.toLowerCase()
    switch (type) {
        case "text":
        case "varchar":
            return ["string", length]
        case "long":
        case "int":
            return ["number", length]
        case "bool":
            return ["boolean", length]
        default:
            return [type, length]
    }
}

export function getPostgresType(type: string): [string, number] {
    type = type.toLowerCase()

    while (type.startsWith(" ") || type.startsWith("\n")) {
        type = type.substring(1)
    }
    while (type.endsWith(" ") || type.endsWith("\n")) {
        type = type.slice(0, -1)
    }
    if (type.endsWith(")") && type.includes("(")) {
        const index = type.indexOf("(")
        const type2 = type.substring(0, index)
        type = type.slice(0, -1)
        type = type.substring(index + 1)
        let length = Number(type)
        if (length == NaN) {
            length = -1
        }
        return [type2, length]
    }
    return [type, -1]
}

export function mapToObject<T>(
    arr: T[],
    cb: (value: T, index: number) => string | undefined
): {
    [key: string]: T
} {
    const obj: {
        [key: string]: T
    } = {}
    for (let index = 0; index < arr.length; index++) {
        const value = arr[index];
        const key = cb(value, index)
        if (key) {
            obj[key] = value
        }
    }
    return obj
}

export function dropTable(tableName: string): string {
    return 'DROP TABLE IF EXISTS "' + tableName + '";'
}

export type FontColorStyle = "rainbow" | "zebra" | "america" | "trap" | "random" | "zalgo"
export type FontNativeColor = "red" | "black" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "grey"
export type FontColor = FontColorStyle | FontNativeColor
export type FontBgColor = "bgBlack" | "bgRed" | "bgGreen" | "bgYellow" | "bgBlue" | "bgMagenta" | "bgCyan" | "bgWhite"
export type FontStyle = "reset" | "bold" | "dim" | "italic" | "underline" | "inverse" | "hidden" | "strikethrough"

export const fontColorStyles: FontColorStyle[] = ["rainbow", "zebra", "america", "trap", "random", "zalgo"]
export const fontNativeColor: FontNativeColor[] = ["black", "green", "yellow", "blue", "magenta", "cyan", "white", "gray", "grey"]
export const fontColor: FontColor[] = [...fontNativeColor, ...fontColorStyles]
export const fontBgColor: FontBgColor[] = ["bgBlack", "bgRed", "bgGreen", "bgYellow", "bgBlue", "bgMagenta", "bgCyan", "bgWhite"]
export const fontStyle: FontStyle[] = ["reset", "bold", "dim", "italic", "underline", "inverse", "hidden", "strikethrough"]

export type Font = [FontColor | null, FontBgColor | null, ...FontStyle[]]

export function styleText(text: string, font: Font | undefined): string {
    if (font) {
        font.forEach((fontStyle: any) => {
            if (!fontStyle) {
                return
            }
            const tmp = text[fontStyle]
            if (!tmp) {
                return
            }
            if (typeof tmp == "function") {
                text = (text as any)[fontStyle]()
            } else {
                text = tmp
            }
        })
    }
    return text
}

export function mixFonts(main: Font, seconds: Font, mixStyles: boolean = true): Font {
    if (mixStyles) {
        return [
            main[0] ?? seconds[0] ?? null,
            main[1] ?? seconds[1] ?? null,
            ...[
                ...main.slice(2) as FontStyle[],
                ...seconds.slice(2) as FontStyle[]
            ]
        ]
    } else {
        return [
            main[0] ?? seconds[0] ?? null,
            main[1] ?? seconds[1] ?? null,
            ...(
                main.length > 2 ?
                    main.slice(2) as FontStyle[] :
                    seconds.slice(2) as FontStyle[]
            )
        ]
    }
}

export async function showTable(
    table: SqlTable,
    maxValueSize: number = 16,
    defaultFont: Font = ["white", "bgBlack"],
    titleFont: Font = ["yellow", null, "bold"],
    columeFont: Font = [null, null, "underline"],
    fontOrder: Font[] = [
        ["yellow", null],
        ["red", null],
        ["magenta", null],
        ["blue", null],
        ["green", null]
    ]
): Promise<void> {
    const rows = await table.select()
    console.info(generateResultString(
        table.name,
        rows,
        maxValueSize,
        defaultFont,
        titleFont,
        columeFont,
        fontOrder
    ))
}

export interface RowResult {
    [key: string]: string | number | boolean | null
}

export type SelectResult = RowResult[]

export function generateResultString(
    title: string,
    result: SqlQueryResultRow[],
    maxValueSize: number = 16,
    defaultFont: Font = ["white", "bgBlack"],
    titleFont: Font = ["yellow", null, "bold"],
    columeFont: Font = [null, null, "underline"],
    fontOrder: Font[] = [
        ["yellow", null],
        ["red", null],
        ["magenta", null],
        ["blue", null],
        ["green", null]
    ]
): string {
    const paint = (text: string, font?: Font): string => {
        if (font) {
            font = mixFonts(font, defaultFont)
        } else {
            font = defaultFont
        }
        return styleText(text, font)
    }

    if (fontOrder.length == 0) {
        fontOrder.push(["green", null])
    }

    let preSpaceSize = title.length + 2
    let msg = ""
    msg += paint("| ")
    msg += paint(
        title,
        titleFont
    )
    try {
        if (result.length == 0) {
            msg += paint("\n| EMPTY!")
            return
        }
        let targetFontIndex = 0
        msg += paint("\n| ")
        let columeLineSize: number = 4
        const tableColums = Object.keys(result[0])
        const coloredColums = tableColums.map((value: string) => {
            const currentFont = fontOrder[targetFontIndex]
            targetFontIndex++
            if (targetFontIndex >= fontOrder.length) {
                targetFontIndex = 0
            }
            const text = "" + value
            columeLineSize += text.length
            return paint(text, mixFonts(currentFont, columeFont))
        })
        columeLineSize += (coloredColums.length - 1) * 3
        if (columeLineSize > preSpaceSize) {
            preSpaceSize = columeLineSize
        }
        msg += coloredColums.join(paint(" | "))
        msg += paint(" |")

        result.forEach((row: SqlQueryResultRow) => {
            targetFontIndex = 0
            msg += paint("\n| ")
            const coloredColums = Object.values(row).map((value: any) => {
                const currentFont = fontOrder[targetFontIndex]
                targetFontIndex++
                if (targetFontIndex >= fontOrder.length) {
                    targetFontIndex = 0
                }
                let text = "" + value
                if (text.length > maxValueSize) {
                    text = text.substring(0, maxValueSize) + "..."
                }
                return paint(text, currentFont)
            })
            msg += coloredColums.join(paint(" | "))
            msg += paint(" |")
        })
    } finally {
        let preSpace: string = ""
        let i = 0
        while (i < preSpaceSize) {
            preSpace += " "
            i++
        }
        return paint(preSpace + "\n", [null, null, "underline"]) + msg
    }
}