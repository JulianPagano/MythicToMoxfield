import fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";

const INPUT_CSV = "list_export.csv";
const OUTPUT_CSV = "moxfield_collection.csv";
const SCRYFALL_URL = "https://api.scryfall.com/cards/named";

// Mythic Tools → Moxfield condition mapping
const CONDITION_MAP = {
  NM: "Near Mint",
  EX: "Lightly Played",
  LP: "Lightly Played",
  G: "Heavily Played",
  PL: "Moderately Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getEnglishName(localName) {
  const params = new URLSearchParams({
    exact: localName,
    version: "printed",
  });

  const res = await fetch(`${SCRYFALL_URL}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data.name || null;
}

async function run() {
  const rows = [];
  const unresolved = [];

  await new Promise((resolve) => {
    fs.createReadStream(INPUT_CSV)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve);
  });

  const output = [];

  for (const row of rows) {
    const englishName = await getEnglishName(row["Card Name"]);

    if (!englishName) {
      unresolved.push(row["Card Name"]);
      continue;
    }

    output.push({
      Count: row["Quantity"],
      Name: englishName,
      Set: String(row["Set Code"]).toLowerCase(),
      "Collector Number": row["Collector Number"],
      Language: row["Language"],
      Foil: row["Finish"] !== "nonfoil" ? "foil" : "",
      Condition: CONDITION_MAP[row["Condition"]] ?? row["Condition"],
    });

    await sleep(100); // Scryfall rate limit
  }

  const writer = createObjectCsvWriter({
    path: OUTPUT_CSV,
    header: [
      { id: "Count", title: "Count" },
      { id: "Name", title: "Name" },
      { id: "Set", title: "Set" },
      { id: "Collector Number", title: "Collector Number" },
      { id: "Language", title: "Language" },
      { id: "Foil", title: "Foil" },
      { id: "Condition", title: "Condition" },
    ],
  });

  await writer.writeRecords(output);

  console.log("✅ Archivo generado:", OUTPUT_CSV);

  if (unresolved.length) {
    console.log("\n⚠️ Cartas no resueltas:");
    unresolved.forEach((c) => console.log(" -", c));
  }
}

run();