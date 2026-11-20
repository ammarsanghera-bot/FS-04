import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { bootJobs, } from "./jobs/register.js";
import { billingService } from "./modules/billing/billing.service.js";

const app = createApp();

await billingService.ensurePlans();
await bootJobs();

app.listen(env.API_PORT, () => {
  console.info(`Flowboard API listening on http://localhost:${env.API_PORT}`);
  console.info(`Billing mode: ${billingService.mode}`);
});
