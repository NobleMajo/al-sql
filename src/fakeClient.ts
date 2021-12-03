import { ExecutableSqlQuery } from "./index";

export class Client {
    constructor(connectInfo: any) { }

    private querys: ExecutableSqlQuery[] = []

    shiftQuery(): ExecutableSqlQuery | undefined {
        return this.querys.shift()
    }

    async query(query: string, parameter: any[]): Promise<any> {
        this.querys.push([query, ...parameter])
        return {
            rows: []
        }
    }

    async connect(): Promise<void> { }

    async end(): Promise<void> { }
}

process.env.PG_FAKE_CLIENT="TRUE"