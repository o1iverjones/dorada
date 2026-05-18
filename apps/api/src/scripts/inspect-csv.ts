import { createReadStream } from "fs";
import { parse } from "csv-parse";

const CSV_PATH = "/Users/macbook/Downloads/Event Overview May 7, 2026 - Jul 31, 2026.csv";
const records: Record<string, string>[] = [];

await new Promise<void>((res, rej) => {
  createReadStream(CSV_PATH)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
    .on("data", (r) => records.push(r))
    .on("end", res)
    .on("error", rej);
});

console.log("Columns:", Object.keys(records[0]));
console.log("---");
for (const r of records.slice(0, 15)) {
  const shift = r["Shift 1"] ?? "";
  if (shift) console.log(JSON.stringify(shift));
}
