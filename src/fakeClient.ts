export interface QueryData {
    query: string,
    params: any[],
}

export function useFakeClient(): boolean {
    return (process.env.PG_FAKE_CLIENT ?? "").toLowerCase() == "true"
}

export class Client {
    constructor() {
        console.info("FakeClient created!")
    }

    querys: QueryData[] = []

    shiftQuery(): QueryData {
        let data = this.querys.shift()
        if (!data) {
            data = {
                query: "No query found!",
                params: []
            }
        }
        return data
    }

    async query(query: string, parameter: any[]): Promise<any> {
        this.querys.push({
            query: query,
            params: parameter,
        })
        return {
            rows: []
        }
    }

    async connect(): Promise<void> { }

    async end(): Promise<void> { }
}
