import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const heroesPath = path.join(root, "src/data/team-heroes.json");
const outDir = path.join(root, "public/images/players");

const heroes = JSON.parse(fs.readFileSync(heroesPath, "utf8"));

const WIKI_OVERRIDES = {
  Pedri: "Pedri_(footballer)",
  "Mohanad Ali": "Mohanad_Ali",
  "Almoez Ali": "Almoez_Ali",
  "Salem Al-Dawsari": "Salem_Al-Dawsari",
  "Musa Al-Taamari": "Musa_Al-Taamari",
  "Ryan Mendes": "Ryan_Mendes",
  "Aníbal Godoy": "Aníbal_Godoy",
  "Eldor Shomurodov": "Eldor_Shomurodov",
  "Yoane Wissa": "Yoane_Wissa",
  "Melchie Dumornay": "Melchie_Dumornay",
  "Wahbi Khazri": "Wahbi_Khazri",
  "Leandro Bacuna": "Leandro_Bacuna",
  "Percy Tau": "Percy_Tau",
  "Enner Valencia": "Enner_Valencia",
  "Mehdi Taremi": "Mehdi_Taremi",
  "Kaoru Mitoma": "Kaoru_Mitoma",
  "Victor Gyökeres": "Viktor_Gyökeres",
  "Chris Wood": "Chris_Wood_(footballer)",
  "Mathew Ryan": "Mathew_Ryan",
  "Christian Pulisic": "Christian_Pulisic",
  "Miguel Almirón": "Miguel_Almirón",
  "Luis Díaz": "Luis_Díaz_(footballer,_born_1997)",
  "Mohammed Kudus": "Mohammed_Kudus",
  "Sébastien Haller": "Sébastien_Haller",
  "Edin Džeko": "Edin_Džeko",
  "Granit Xhaka": "Granit_Xhaka",
  "Hakan Çalhanoğlu": "Hakan_Çalhanoğlu",
  "Jamal Musiala": "Jamal_Musiala",
  "Virgil van Dijk": "Virgil_van_Dijk",
  "Kevin De Bruyne": "Kevin_De_Bruyne",
  "Mohamed Salah": "Mohamed_Salah",
  "Kylian Mbappé": "Kylian_Mbappé",
  "Sadio Mané": "Sadio_Mané",
  "Erling Haaland": "Erling_Haaland",
  "Lionel Messi": "Lionel_Messi",
  "Riyad Mahrez": "Riyad_Mahrez",
  "Marcel Sabitzer": "Marcel_Sabitzer",
  "Cristiano Ronaldo": "Cristiano_Ronaldo",
  "Harry Kane": "Harry_Kane",
  "Luka Modrić": "Luka_Modrić",
  "Luis Suárez": "Luis_Suárez",
  "Achraf Hakimi": "Achraf_Hakimi",
  "Vinícius Júnior": "Vinícius_Júnior",
  "Son Heung-min": "Son_Heung-min",
  "Guillermo Ochoa": "Guillermo_Ochoa",
  "Patrik Schick": "Patrik_Schick",
  "Alphonso Davies": "Alphonso_Davies",
  "Andy Robertson": "Andy_Robertson",
};

const UA = "pronostics-hero-fetch/1.0 (local dev; contact: dev@pronostics.local)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toWikiTitle(player) {
  return WIKI_OVERRIDES[player] ?? player.replace(/ /g, "_");
}

async function fetchJson(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

async function getWikiSummaryImage(player) {
  const title = toWikiTitle(player);
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!data?.thumbnail?.source) return null;
  return data.thumbnail.source.replace(/\/\d+px-/, "/500px-");
}

async function getWikidataImage(player) {
  const search = await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(player)}&language=en&format=json&origin=*`
  );
  const id = search?.search?.[0]?.id;
  if (!id) return null;

  const entity = await fetchJson(
    `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`
  );
  const claims = entity?.entities?.[id]?.claims?.P18;
  const filename = claims?.[0]?.mainsnak?.datavalue?.value;
  if (!filename) return null;

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=500`;
}

async function getPlayerImage(player) {
  return (await getWikiSummaryImage(player)) ?? (await getWikidataImage(player));
}

async function downloadImage(imageUrl, destPath) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(imageUrl, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return buf.length;
  }
  throw new Error("HTTP 429");
}

const onlyMissing = process.argv.includes("--missing");
const results = { ok: [], failed: [], skipped: [] };

for (const [code, { player, image }] of Object.entries(heroes)) {
  const filename = `${code.toLowerCase()}.jpg`;
  const dest = path.join(outDir, filename);

  if (onlyMissing && image && fs.existsSync(dest)) {
    results.skipped.push(code);
    continue;
  }

  process.stdout.write(`${code} (${player})... `);
  try {
    const imageUrl = await getPlayerImage(player);
    if (!imageUrl) {
      results.failed.push({ code, player, reason: "no image found" });
      console.log("FAILED (no image)");
      await sleep(1500);
      continue;
    }
    const size = await downloadImage(imageUrl, dest);
    results.ok.push({ code, player, filename, size });
    console.log(`OK (${Math.round(size / 1024)}KB)`);
  } catch (err) {
    results.failed.push({ code, player, reason: err.message });
    console.log(`FAILED (${err.message})`);
  }
  await sleep(1500);
}

console.log(`\nDone: ${results.ok.length} ok, ${results.failed.length} failed, ${results.skipped.length} skipped`);
if (results.failed.length) {
  console.log("Failed:", JSON.stringify(results.failed, null, 2));
}

const updated = JSON.parse(fs.readFileSync(heroesPath, "utf8"));
for (const { code, filename } of results.ok) {
  updated[code] = {
    ...updated[code],
    image: `/images/players/${filename}`,
  };
}
fs.writeFileSync(heroesPath, JSON.stringify(updated, null, 2) + "\n");
console.log("Updated team-heroes.json");
