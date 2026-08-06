import test from "node:test";
import assert from "node:assert/strict";
import { analyze, parseDxDiag, redact, selectLatestGameLog } from "../src/analysis.js";

test("classifies explicit memory failures with high confidence", () => {
  const report = analyze([{ name: "Game.log", text: "Fatal: Out of memory; failed to allocate 8192 bytes" }]);
  assert.equal(report.findings[0].id, "oom");
  assert.equal(report.findings[0].confidence, "high");
});

test("does not overstate an access violation", () => {
  const report = analyze([{ name: "Game.log", text: "EXCEPTION_ACCESS_VIOLATION 0xc0000005" }]);
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

test("redacts common personal data", () => {
  const text = redact("C:\\Users\\Alex\\Games email alex@example.com ip 192.168.1.10 token=secret");
  assert.equal(text.includes("Alex"), false);
  assert.equal(text.includes("alex@example.com"), false);
  assert.equal(text.includes("192.168.1.10"), false);
  assert.equal(text.includes("secret"), false);
});

test("extracts a minimal DxDiag snapshot without treating it as a diagnosis", () => {
  const snapshot = parseDxDiag(`Operating System: Windows 11 Pro\nMemory: 262144MB RAM\nProcessor: AMD Ryzen Threadripper\n------------------\nCard name: NVIDIA GeForce RTX 3070 Ti\nDisplay Memory: 8010 MB\nDriver Version: 32.0.15.9999`);
  assert.equal(snapshot.gpu, "NVIDIA GeForce RTX 3070 Ti");
  assert.equal(snapshot.systemMemory, "262144MB RAM");
  assert.equal(snapshot.driver, "32.0.15.9999");
});
