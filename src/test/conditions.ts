import { SqlCondition } from "../index";

const some: SqlCondition = [
    "OR",
    ["id", "==", 123],
    [
        "AND",
        ["name", "==", "tester"],
        ["age", "<", 32],
        [
            "OR",
            ["active", true],
            {
                query: "'user'.'name' != $1 AND ('user'.age >= $3) = $2",
                values: ["test", true, 123]
            }
        ]
    ]
]

const test: SqlCondition = [
    "OR",
    [
        "AND",
        ["name", "tester"],
    ["age", ">", 34],
    ],
    ["", ">", 34],
]