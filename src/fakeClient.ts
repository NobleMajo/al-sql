import { ExecutableSqlQuery } from "./index";

export class Client {
    constructor(connectInfo: any) { 
        console.log("FakeClient created!")
    }

    async query(query: string, parameter: any[]): Promise<any> {
        return {
            rows: []
        }
    }

    async connect(): Promise<void> { }

    async end(): Promise<void> { }
}

process.env.PG_FAKE_CLIENT="TRUE"