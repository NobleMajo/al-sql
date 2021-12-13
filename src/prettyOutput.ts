import { SqlQueryResultRow, SqlTable } from "./index"
import { createFillerString } from "./queryFormatter"

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
                line += styleText("[\n" + createFillerString(settings.level * settings.tabSpaces + settings.tabSpaces) + "1. ", settings.arrayFont) +
                    obj
                        .map(
                            (value: any, index: number) => {
                                let line = toPrettyString(value, {
                                    ...settings,
                                    level: settings.level + 1
                                })
                                if (index < obj.length - 1) {
                                    line += styleText(",\n" + createFillerString(settings.level * settings.tabSpaces + settings.tabSpaces) + (index + 2) + ". ", settings.arrayFont)
                                }
                                return line
                            }
                        ).join("") +
                    styleText("\n" + createFillerString(settings.level * settings.tabSpaces) + "]", settings.arrayFont)
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
                line += styleText("{\n" + createFillerString(settings.level * settings.tabSpaces + settings.tabSpaces), settings.objectFont) +
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
                            styleText(",\n" + createFillerString(settings.level * settings.tabSpaces + settings.tabSpaces), settings.objectFont)
                        ) +
                    styleText("\n" + createFillerString(settings.level * settings.tabSpaces) + "}", settings.objectFont)
            }
            return line
        }
    } else if (type == "function") {
        return styleText("FUNCTION", settings.booleanFont)
    }
    return "" + obj
}

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
    showResult(
        table.name,
        rows,
        maxValueSize,
        defaultFont,
        titleFont,
        columeFont,
        fontOrder
    )
}

export interface RowResult {
    [key: string]: string | number | boolean | null
}

export type SelectResult = RowResult[]

export function showResult(
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
): void {
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
        preSpace = paint(preSpace + "\n", [null, null, "underline"])
        console.log(preSpace + msg)
    }
}