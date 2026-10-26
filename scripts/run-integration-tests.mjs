import { spawnSync } from "node:child_process";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://ajaia_test:ajaia_test_password@localhost:54330/ajaia_docs_test?schema=public";

if (!databaseUrl.includes("ajaia_docs_test")) {
  console.error(
    "Refusing to run integration tests: TEST_DATABASE_URL must point to ajaia_docs_test.",
  );
  process.exit(1);
}

const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}.`);
};

const managesLocalContainer = !process.env.TEST_DATABASE_URL;
let localContainerStarted = false;

try {
  if (managesLocalContainer) {
    run("docker", ["compose", "--profile", "test", "up", "-d", "postgres-test"]);
    localContainerStarted = true;
    let healthy = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = spawnSync(
        "docker",
        [
          "compose",
          "--profile",
          "test",
          "exec",
          "-T",
          "postgres-test",
          "pg_isready",
          "-U",
          "ajaia_test",
          "-d",
          "ajaia_docs_test",
        ],
        { stdio: "ignore", shell: false },
      );
      if (result.status === 0) {
        healthy = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!healthy) throw new Error("Test PostgreSQL did not become healthy.");
  }

  const testEnvironment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    TEST_DATABASE_URL: databaseUrl,
  };
  run(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    testEnvironment,
  );
  run(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"],
    testEnvironment,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (managesLocalContainer && localContainerStarted) {
    spawnSync("docker", ["compose", "--profile", "test", "stop", "postgres-test"], {
      stdio: "inherit",
      shell: false,
    });
  }
}
