

export function isSqlValue(value: any): boolean {
    const type = typeof value
    return value == null || type == "string" || type == "number" || type == "boolean"
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


export function repeatFiller(times: number, filler: string = " "): string {
    let filler2 = ""
    let i = 0
    if (i < times) {
        filler2 += filler
        i++
    }
    if (times > 8) {
        let half = times / 2
        while (i < half) {
            filler2 += filler2 + filler2
            i += i
        }
    }
    while (i < times) {
        filler2 += filler
        i++
    }
    return filler2
}

export function removeSpaces(str: string, toRemove: string[] = [" ", "\n"]): string {
    for (let index = 0; index < toRemove.length; index++) {
        const toRemoveValue = toRemove[index];
        if (str.startsWith(toRemoveValue)) {
            str = str.substring(toRemoveValue.length)
            index = 0
        }
    }
    for (let index = 0; index < toRemove.length; index++) {
        const toRemoveValue = toRemove[index];
        if (str.endsWith(toRemoveValue)) {
            str = str.slice(0, -toRemoveValue.length)
            index = 0
        }
    }
    return str
}


export function createFillerString(size: number, str: string = " "): string {
    let filler = str
    if (filler.length < size) {
        filler += str
    }
    if (size > 16) {
        let half = size / 2
        while (filler.length < half) {
            filler += filler + str
        }
    }
    while (filler.length < size) {
        filler += str
    }
    return filler
}

export const defaultMainKeywords: string[] = [
    "RIGHT JOIN",
    "LEFT JOIN",
    "OUTER JOIN",
    "FULL OUTER JOIN",
    "RIGHT OUTER JOIN",
    "LEFT OUTER JOIN",
    "INNER JOIN",
    "RIGHT INNER JOIN",
    "LEFT INNER JOIN",
    "FULL INNER JOIN",
    "FULL JOIN",
    "INSERT INTO",
    "DELETE FROM",
    "RETURNING",
    "DATABASE",
    "CREATE TABLE",
    "DROP TABLE",
    "IF EXISTS",
    "IF NOT EXISTS",
    "IF EXIST",
    "IF NOT EXIST",
    "FROM",
    "SELECT",
    "WHERE",
    "ON",
]

export const defaultBreakAfterKeywords: string[] = [
    "AND",
    "OR"
]

export interface QueryFormatterOptions {
    spaceCount?: number,
    mainKeywords?: string[],
    breakAfterKeywords?: string[],
}

export interface QueryFormatterSettings extends QueryFormatterOptions {
    spaceCount: number,
    mainKeywords: string[],
    breakAfterKeywords: string[],
}

export const defaultQueryFormatterSettings: QueryFormatterSettings = {
    spaceCount: 2,
    mainKeywords: defaultMainKeywords,
    breakAfterKeywords: defaultBreakAfterKeywords
}

export function formatSqlQuery(
    query: string,
    options?: QueryFormatterOptions
): string {
    const settings: QueryFormatterSettings = {
        ...defaultQueryFormatterSettings,
        ...options
    }
    let level = 0
    let filler = createFillerString(settings.spaceCount, " ")

    query = query
        .split("\n")
        .join(" ")
    query = removeSpaces(query, [" ", "\n", ";", ",", "-", ".", "#", "/", "#", "*"])
    query = query
        .split("=")
        .map((q) => removeSpaces(q))
        .join("=")
        .split(".")
        .map((q) => removeSpaces(q))
        .join(".")
    query = query
        .split("(")
        .map((q) => removeSpaces(q))
        .join("(\n")
        .split(")")
        .map((q) => removeSpaces(q))
        .join("\n)")
    query = query
        .split("{")
        .map((q) => removeSpaces(q))
        .join("{\n")
        .split("}")
        .map((q) => removeSpaces(q))
        .join("\n}")
    query = query
        .split("[")
        .map((q) => removeSpaces(q))
        .join("[\n")
        .split("]")
        .map((q) => removeSpaces(q))
        .join("\n]")
    query = query
        .split(";")
        .map((q) => removeSpaces(q))
        .join(";\n\n")
        .split(",")
        .map((q) => removeSpaces(q))
        .join(",\n")

    settings.breakAfterKeywords.forEach((keyword) => {
        query = query
            .split(" " + keyword + " ")
            .join(" " + keyword + "\n")
    })

    let biggestKeyword: number = 4
    settings.mainKeywords.forEach((keyword: string) => {
        if (keyword.length > biggestKeyword) {
            biggestKeyword = keyword.length
        }
    })
    biggestKeyword++
    let wLevel: boolean = false
    let create: boolean = query.toUpperCase().startsWith("CREATE TABLE")
    let keywordLevel: boolean = false
    let keyword: string
    let rest: string
    let ret: string = ""
    let i: number
    for (let index = 0; index < query.length; index++) {
        let char = query.charAt(index)
        if (char == " ") {
            if (keywordLevel) {
                rest = query.substring(index + 1, index + 1 + biggestKeyword)
                for (let index = 0; index < settings.mainKeywords.length; index++) {
                    keyword = settings.mainKeywords[index];
                    if (rest.startsWith(keyword)) {
                        keywordLevel = false
                        level--
                        char = "\n"
                        break;
                    }
                }
            }
            if (!keywordLevel) {
                rest = ret.slice(-biggestKeyword)
                for (let index = 0; index < settings.mainKeywords.length; index++) {
                    keyword = settings.mainKeywords[index];
                    if (rest.endsWith(keyword)) {
                        keywordLevel = true
                        level++
                        char = "\n"
                        break;
                    }
                }
            }
        }

        if (char == " " && !create) {

            i = index + 1
            while (
                i < query.length &&

                query.charAt(i) != " " &&
                query.charAt(i) != "\n"

            ) {
                i++
            }
            if (
                (
                    query.charAt(i) == " " ||
                    query.charAt(i) == "\n"
                ),
                query.charAt(i - 1) == ","
            ) {
                level++
                char = "\n"
            } else {
                i = index - 1
                while (
                    i > 0 &&
                    query.charAt(i) != " " &&
                    query.charAt(i) != "\n"
                ) {
                    i--
                }
                if (
                    (
                        query.charAt(i) == " " ||
                        query.charAt(i) == "\n"
                    ),
                    query.charAt(i - 1) == ","
                ) {
                    level--
                    char = "\n"
                }
            }
        }
        if (char == "\n") {
            ret += char
            wLevel = true
        } else if ((!create || level == 0) && !create && char == "(" || char == "{" || char == "[") {
            ret += char
            level++
            wLevel = false
        } else if ((!create) && char == ")" || char == "}" || char == "]") {
            level--
            ret += repeatFiller(level, filler) + char
            wLevel = false
        } else {
            if (wLevel) {
                wLevel = false
                ret += repeatFiller(level, filler)
            }
            ret += char
        }
    }
    ret = ret
        .split("(")
        .join(" (")
        .split(")")
        .join(") ")
    ret = ret
        .split("{")
        .join(" {")
        .split("}")
        .join("} ")
    ret = ret
        .split("[")
        .join(" [")
        .split("]")
        .join("] ")

    return ret + ";"
}