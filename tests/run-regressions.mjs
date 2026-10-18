import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suites = process.argv.slice(2);
if (!suites.length) suites.push("blog-security", "openai-initialization", "stripe-initialization", "phase2-security", "phase3-billing");
const env = { ...process.env };
for (const key of Object.keys(env)) if (/OPENAI|STRIPE|LEMONSQUEEZY|DATABASE|DIRECT_URL|PGPASSWORD|PGHOST|PGUSER/i.test(key)) delete env[key];
let failed = false;
const results = [];
for (const suite of suites) {
  if (!/^[a-z0-9-]+$/.test(suite)) throw new Error("Invalid suite name");
  console.log(`Running ${suite}: process isolation enabled, one worker, 30s/test, 60s/process`);
  let output = "";
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, ["--test", "--test-timeout=30000", "--test-concurrency=1", `tests/${suite}.test.mjs`], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", chunk => { output += chunk; process.stdout.write(chunk); });
    const deadline = setTimeout(() => { console.error(`${suite}: 60-second process deadline exceeded`); child.kill(); }, 60000);
    child.on("error", error => { console.error(error); clearTimeout(deadline); resolve(1); });
    child.on("close", code => { clearTimeout(deadline); resolve(code ?? 1); });
  });
  console.log(`${suite}: exit ${code}`);
  results.push({ suite, exit: code, passed: Number(output.match(/^# pass (\d+)$/m)?.[1] ?? 0),
    failed: Number(output.match(/^# fail (\d+)$/m)?.[1] ?? 0), cancelled: Number(output.match(/^# cancelled (\d+)$/m)?.[1] ?? 0),
    skipped: Number(output.match(/^# skipped (\d+)$/m)?.[1] ?? 0) });
  if (code !== 0) failed = true;
}
console.log(`EXACT_REGRESSION_RESULTS=${JSON.stringify(results)}`);
process.exitCode = failed ? 1 : 0;
