import assert from "node:assert/strict";
import { test } from "node:test";
import { netstatListenPids, parseLaunchArgs, resolvePort } from "./launch-rapidtool.mjs";

test("parseLaunchArgs defaults to start and accepts the three actions", () => {
  assert.deepEqual(parseLaunchArgs([]), { action: "start" });
  assert.deepEqual(parseLaunchArgs([""]), { action: "start" });
  for (const action of ["start", "stop", "restart"]) {
    assert.deepEqual(parseLaunchArgs([action]), { action });
  }
});

test("parseLaunchArgs rejects unknown and extra arguments", () => {
  const unknown = parseLaunchArgs(["reload"]);
  assert.ok(unknown.error);
  assert.match(unknown.error, /unknown action: reload/);
  const extra = parseLaunchArgs(["stop", "--force"]);
  assert.ok(extra.error);
  assert.match(extra.error, /unexpected argument: --force/);
});

test("resolvePort honours a usable override and falls back for junk", () => {
  assert.equal(resolvePort("9000"), 9000);
  assert.equal(resolvePort(9000), 9000);
  assert.equal(resolvePort(undefined), 8081);
  assert.equal(resolvePort(""), 8081);
  assert.equal(resolvePort("abc"), 8081);
  assert.equal(resolvePort("0"), 8081);
  assert.equal(resolvePort("70000"), 8081);
});

// Windows `netstat -ano -p TCP` rows: Proto Local Foreign State PID.
const NETSTAT = [
  "  Proto  Local Address          Foreign Address        State           PID",
  "  TCP    127.0.0.1:8081         0.0.0.0:0              LISTENING       4242",
  "  TCP    127.0.0.1:8080         0.0.0.0:0              LISTENING       1111",
  "  TCP    127.0.0.1:8081         127.0.0.1:52344        ESTABLISHED     4242",
  "  TCP    [::1]:8081             [::]:0                 LISTENING       4243",
  "  TCP    0.0.0.0:80810          0.0.0.0:0              LISTENING       9999",
  "  UDP    127.0.0.1:8081         *:*                                    5555",
  "",
].join("\r\n");

test("netstatListenPids picks TCP LISTEN owners of the exact port", () => {
  assert.deepEqual(netstatListenPids(NETSTAT, 8081), [4242, 4243]);
  assert.deepEqual(netstatListenPids(NETSTAT, 8080), [1111]);
  assert.deepEqual(netstatListenPids(NETSTAT, 9999), []);
  assert.deepEqual(netstatListenPids("", 8081), []);
  assert.deepEqual(netstatListenPids(undefined, 8081), []);
});
