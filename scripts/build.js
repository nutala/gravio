const { execSync } = require("child_process");
const path = require("path");

const SEP = "=".repeat(60);

function run(cmd) {
  console.log(`\n${SEP}\n[build] Running: ${cmd}\n${SEP}`);
  try {
    execSync(cmd, { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });
    console.log(`[build] OK: ${cmd}`);
    return true;
  } catch (err) {
    console.log(`\n[build] FAILED: ${cmd}`);
    console.log(`[build] exit code: ${err.status}`);
    console.log(`[build] signal: ${err.signal}`);
    if (err.status === null && err.signal === "SIGKILL") {
      console.log("[build] CAUSE: Process was killed by OOM killer (out of memory)");
    } else if (err.status === null && err.signal) {
      console.log(`[build] CAUSE: Process was killed by signal ${err.signal}`);
    } else if (err.status !== null) {
      console.log(`[build] CAUSE: Process exited with code ${err.status}`);
    }
    return false;
  }
}

// Step 1: Generate Prisma client
if (!run("npx prisma generate")) {
  process.exit(1);
}

// Step 2: Build Next.js (explicitly with webpack, debug output)
if (!run("npx next build --webpack --debug")) {
  process.exit(1);
}

console.log("\n[build] Build completed successfully!");
