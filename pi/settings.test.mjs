// Checks the recommended Pi settings fragment against this repository and Pi's documented values.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const settings = read("pi/settings.json");

test("only settings this fragment is documented to own", () => {
	assert.deepEqual(Object.keys(settings).sort(), ["followUpMode", "packages", "quietStartup", "steeringMode", "theme"]);
});

test("one industrial-os package entry selecting every extension in the root manifest", () => {
	assert.equal(settings.packages.length, 1);
	const [entry] = settings.packages;
	assert.equal(entry.source, "git:github.com/jigenator/industrial-os");
	const manifest = read("package.json").pi.extensions.map((path) => path.replace(/^\.\//, ""));
	assert.deepEqual(entry.extensions, manifest);
	for (const path of entry.extensions) assert.ok(existsSync(new URL(path, root)), path);
});

test("theme names the Industrial OS theme file", () => {
	assert.equal(settings.theme, read("pi/theme/industrial-os.json").name);
});

// Allowed values from Pi 1.4.0 docs/settings.md.
test("queue delivery and startup values are ones Pi accepts", () => {
	for (const key of ["steeringMode", "followUpMode"]) assert.ok(["all", "one-at-a-time"].includes(settings[key]), key);
	assert.ok([true, false, "header"].includes(settings.quietStartup));
});
