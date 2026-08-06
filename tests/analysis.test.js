import test from "node:test";
import assert from "node:assert/strict";
import { analyze, parseDxDiag, redact } from "../src/analysis.js";

test("classifies explicit memory failures with high confidence", () => {
  const report = analyze([{ name: "Game.log", text: "Fatal: Out of memory; failed to allocate 8192 bytes" }]);
  assert.equal(report.findings[0].id, "oom");
  assert.equal(report.findings[0].confidence, "high");
});

test("does not overstate an access violation", () => {
  const report = analyze([{ name: "Game.log", text: "EXCEPTION_ACCESS_VIOLATION 0xc0000005" }]);
  assert.equal(report.findings[0].confidence, "low");
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
