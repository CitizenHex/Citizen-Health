import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, createExportBundle, createSupportSummary, describeInputs, parseCombatEvents, parseDxDiag, parseSessionEvents, parseShopPurchases, redact, selectLatestGameLog, summarizeCombatHistory } from "../src/analysis.js";

function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

test("anonymized fixtures classify supported evidence", () => {
  const cases = [
    ["cryengine-watchdog.log", "cryengine-watchdog"],
    ["memory-exhaustion.log", "oom"],
    ["access-violation.log", "access"],
    ["controlled-exit.log", "controlled-exit"]
  ];
  for (const [name, expectedId] of cases) {
    const report = analyze([{ name: "Game.log", text: fixture(name) }]);
    assert.equal(report.findings[0].id, expectedId, name);
  }
});

test("classifies explicit memory failures with high confidence", () => {
  const report = analyze([{ name: "Game.log", text: "Fatal: Out of memory; failed to allocate 8192 bytes" }]);
  assert.equal(report.findings[0].id, "oom");
  assert.equal(report.findings[0].confidence, "high");
});

test("recognizes Star Citizen's documented engine crash statuses", () => {
  const watchdog = analyze([{ name: "Game.log", text: "STATUS_CRYENGINE_WATCH_DOG (0x2BADFF60)" }]);
  const fatal = analyze([{ name: "Game.log", text: "Launcher exit 732819469 STATUS_CRYENGINE_FATAL_ERROR" }]);
  const memory = analyze([{ name: "Game.log", text: "STATUS_CRYENGINE_OUT_OF_SYSMEM 0x2BADFF61" }]);
  assert.equal(watchdog.findings[0].id, "cryengine-watchdog");
  assert.equal(fatal.findings[0].id, "cryengine-fatal");
  assert.equal(memory.findings[0].id, "oom");
});

test("does not overstate an access violation", () => {
  const report = analyze([{ name: "Game.log", text: "EXCEPTION_ACCESS_VIOLATION 0xc0000005" }]);
  assert.equal(report.findings[0].confidence, "low");
});

test("recognizes the launcher's decimal access-violation code", () => {
  const report = analyze([{ name: "log.log", text: "Star Citizen process exited abnormally (code: 3221225477)" }]);
  assert.equal(report.findings[0].id, "access");
  assert.equal(report.findings[0].confidence, "low");
});

test("recognizes a clean game exit instead of calling it a network failure", () => {
  const report = analyze([{ name: "Game Build(12345678).log", text: "<2026-08-05T00:00:00.000Z> Starting\n<2026-08-05T00:05:25.000Z> <SystemQuit> cause=30016, reason=Quit via console command, exitCode=0\nSystem Fast Shutdown" }]);
  assert.deepEqual(report.findings.map(finding => finding.id), ["controlled-exit"]);
  assert.equal(report.findings[0].confidence, "high");
  assert.equal(report.findings[0].evidenceLines.length, 1);
  assert.deepEqual(report.session, { build: "12345678", startedAt: "2026-08-05T00:00:00.000Z", endedAt: "2026-08-05T00:05:25.000Z", durationMinutes: 5 });
});

test("does not call an in-game Socpak link warning damaged game data", () => {
  const report = analyze([{ name: "Game.log", text: "Socpak(Data/objectcontainers/example.socpak) - Failed to link to exported shop when loading" }]);
  assert.equal(report.findings[0].id, "unknown");
  assert.match(report.findings[0].evidence, /Game\.log/);
  assert.match(report.findings[0].action, /matching launcher log/);
});

test("describes only supplied and optional diagnostic inputs", () => {
  const coverage = describeInputs([{ name: "Game.log", text: "" }, { name: "DxDiag.txt", text: "" }]);
  assert.deepEqual(coverage.present, ["Game.log", "DxDiag"]);
  assert.deepEqual(coverage.missing, ["matching launcher log", "crash-handler text"]);
});

test("uses only the newest dated Game backup", () => {
  const oldLog = { name: "Game Build(1) 01 Aug 26 (10 00 00).log", text: "out of memory" };
  const newLog = { name: "Game Build(2) 04 Aug 26 (12 00 00).log", text: "<SystemQuit> exitCode=0" };
  const selection = selectLatestGameLog([oldLog, newLog]);
  assert.deepEqual(selection.files, [newLog]);
  const report = analyze([oldLog, newLog]);
  assert.deepEqual(report.findings.map(finding => finding.id), ["controlled-exit"]);
  assert.deepEqual(report.skippedFileNames, [oldLog.name]);
});

test("export contains only the minimal redacted report, never full raw log content", () => {
  const secret = "private-unrecognized-raw-log-content";
  const report = analyze([{ name: "Game.log", text: `${secret}\nEXCEPTION_ACCESS_VIOLATION` }]);
  const exported = JSON.stringify(createExportBundle(report));
  assert.equal(exported.includes(secret), false);
  assert.equal(exported.includes("redactedEvidence"), false);
  assert.equal(exported.includes("EXCEPTION_ACCESS_VIOLATION"), true);
  assert.equal(createExportBundle(report).appVersion, "0.1.0");
});

test("support summary is readable and never includes unrecognized raw log content", () => {
  const secret = "private-unrecognized-raw-log-content";
  const report = analyze([{ name: "Game.log", text: `${secret}\nEXCEPTION_ACCESS_VIOLATION` }]);
  const summary = createSupportSummary(report);
  assert.match(summary, /redacted support summary/);
  assert.match(summary, /Citizen Health 0\.1\.0/);
  assert.match(summary, /Access violation detected/);
  assert.equal(summary.includes(secret), false);
  assert.equal(summary.includes("Game.log"), false);
});

test("redacts common personal data", () => {
  const text = redact("C:\\Users\\Alex\\Games email alex@example.com ip 192.168.1.10 token=secret nickname=\"Zero-Divided\" playerGEID=203604417221 session=935f277a3b36a4bb22ea0260bcfaeb50 node_id=9946df2f-a529-68ba-02a5-908068bf128d");
  assert.equal(text.includes("Alex"), false);
  assert.equal(text.includes("alex@example.com"), false);
  assert.equal(text.includes("192.168.1.10"), false);
  assert.equal(text.includes("secret"), false);
  assert.equal(text.includes("Zero-Divided"), false);
  assert.equal(text.includes("203604417221"), false);
  assert.equal(text.includes("935f277a3b36a4bb22ea0260bcfaeb50"), false);
  assert.equal(text.includes("$1"), false);
  assert.match(text, /nickname=\[REDACTED\]/);
});

test("extracts a minimal DxDiag snapshot without treating it as a diagnosis", () => {
  const snapshot = parseDxDiag(`Operating System: Windows 11 Pro\nMemory: 262144MB RAM\nProcessor: AMD Ryzen Threadripper\n------------------\nCard name: NVIDIA GeForce RTX 3070 Ti\nDisplay Memory: 8010 MB\nDriver Version: 32.0.15.9999`);
  assert.equal(snapshot.gpu, "NVIDIA GeForce RTX 3070 Ti");
  assert.equal(snapshot.systemMemory, "262144MB RAM");
  assert.equal(snapshot.driver, "32.0.15.9999");
});

test("builds a deduplicated session timeline only from confirmed game-session markers", () => {
  const events = parseSessionEvents(`<2026-08-05T22:34:51.233Z> taskname="InGame" state=eCVS_InGame gamerules="SC_Default"\n<2026-08-05T23:00:00.000Z> <Channel Disconnected> cause=30016 reason="User requested disconnect" viewState=eCVS_InGame\n<2026-08-05T23:00:00.000Z> <Channel Disconnected> cause=30016 reason="User requested disconnect" viewState=eCVS_InGame\n<2026-08-05T23:00:02.000Z> <SystemQuit> exitCode=0`);
  assert.deepEqual(events, [
    { at: "2026-08-05T22:34:51.233Z", type: "entered-game", label: "Entered game session" },
    { at: "2026-08-05T23:00:00.000Z", type: "disconnected", label: "Disconnected (cause 30016): User requested disconnect" },
    { at: "2026-08-05T23:00:02.000Z", type: "application-exit", label: "Application exited (code 0)" }
  ]);
});

test("shows combat events only when Actor Death directly matches the logged-in handle", () => {
  const events = parseCombatEvents(`<2026-08-13T19:00:00.000Z> <Expect Incoming Connection> nickname="PilotOne"\n<2026-08-13T19:10:00.000Z> [Notice] <Actor Death> CActor::Kill: 'PilotOne' [100] in zone 'Test' killed by 'PirateTwo' [200] using 'behr laser repeater 123456789' [Class test] with damage type 'Bullet'\n<2026-08-13T19:11:00.000Z> [Notice] <Actor Death> CActor::Kill: 'NPC_Unit' [300] in zone 'Test' killed by 'PilotOne' [100] using 'test weapon 123456789' [Class test] with damage type 'Bullet'\n<2026-08-13T19:12:00.000Z> [Notice] <Actor Death> CActor::Kill: 'OtherNPC' [400] in zone 'Test' killed by 'OtherPlayer' [500] using 'test' [Class test] with damage type 'Bullet'`);
  assert.deepEqual(events.map(event => event.label), ["You were killed by PirateTwo", "You killed NPC_Unit"]);
  assert.equal(events[0].damageType, "Bullet");
});

test("summarizes saved combat history without source logs", () => {
  const records = [{ combatEvents: [
    { at: "2026-08-13T19:10:00.000Z", type: "player-death", label: "You were killed by PirateTwo", otherParty: "PirateTwo", weapon: "weapon", damageType: "Bullet" },
    { at: "2026-08-13T19:11:00.000Z", type: "player-kill", label: "You killed NPC", otherParty: "NPC" },
    { at: "2026-08-14T19:12:00.000Z", type: "player-death", label: "You were killed by PirateTwo", otherParty: "PirateTwo" }
  ] }];
  const summary = summarizeCombatHistory(records);
  assert.equal(summary.totalDeaths, 2);
  assert.equal(summary.totalKills, 1);
  assert.deepEqual(summary.recentAttackers, [["PirateTwo", 2]]);
  assert.equal(summarizeCombatHistory(records, "player-death").events.length, 2);
});

test("records shop purchases only after a nearby transaction completion", () => {
  const text = `<2026-08-13T19:10:00.000Z> <CEntityComponentShoppingProvider::SendStandardItemBuyRequest> Sending SShopBuyRequest - playerId[1] shopName[SCShop_Test] kioskId[0] client_price[7.000000] itemName[Drink_bottle_smoothie_01_a] quantity[2] currencyType[UEC]\n<2026-08-13T19:10:00.700Z> <SHUDEvent_OnNotification> Added notification "Transaction Complete: "\n<2026-08-13T19:11:00.000Z> <CEntityComponentShoppingProvider::SendStandardItemBuyRequest> Sending SShopBuyRequest - playerId[1] shopName[SCShop_Test] kioskId[0] client_price[10.000000] itemName[Unconfirmed_Item] quantity[1] currencyType[UEC]`;
  assert.deepEqual(parseShopPurchases(text), [{ at: "2026-08-13T19:10:00.000Z", shop: "SCShop_Test", item: "Drink bottle smoothie 01 a", quantity: 2, unitPrice: 7, currency: "UEC" }]);
});
