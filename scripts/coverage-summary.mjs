// Prints Jest's coverage/coverage-summary.json as a Markdown table (CI appends it to the job summary).
import { readFileSync } from "node:fs";

const { total } = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
const metrics = ["statements", "branches", "functions", "lines"];

console.log(
  [
    "### Coverage",
    "| Metric | % | Covered |",
    "| --- | --- | --- |",
    ...metrics.map((m) => `| ${m} | ${total[m].pct}% | ${total[m].covered}/${total[m].total} |`),
  ].join("\n"),
);
