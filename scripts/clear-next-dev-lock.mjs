import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, ".next", "dev", "lock");

try {
  fs.unlinkSync(lockPath);
  console.log("Uklonjen .next/dev/lock.");
} catch {
  // nema locka — u redu
}

console.log(
  "Ako Next i dalje javi 'port in use' ili 'Another server running', u Task Manageru ugasi sve 'Node.js JavaScript Runtime', pa ponovo pokreni npm run dev."
);
