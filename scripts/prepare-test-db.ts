import { prepareTestDatabase } from "./test-database";

prepareTestDatabase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
