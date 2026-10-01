import { prepareTestDatabase } from "../scripts/test-database";

export default async function setup() {
  await prepareTestDatabase();
}
