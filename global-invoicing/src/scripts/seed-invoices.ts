import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from "@aws-sdk/client-eventbridge";
import { configProps } from "../config/config";
import { readFileSync } from "fs";

const region: string = configProps.standard.region;
const profile: string = configProps.standard.profile;
const prefix: string = configProps.standard.prefix;
const events = configProps.events.invoices;
const mockData = "src/data/invoices.mock.json";
const eventBus = `${prefix}-bus`;

async function seedInvoices() {
  const entries: PutEventsRequestEntry[] = [];

  const content = JSON.parse(readFileSync(mockData, "utf-8"));
  const invoices = Array.isArray(content) ? content : [content];

  for (const invoice of invoices) {
    entries.push({
      EventBusName: eventBus,
      Source: events.source,
      DetailType: events.detailType,
      Detail: JSON.stringify(invoice),
    });
  }

  console.log(`Sending ${entries.length} events to ${eventBus}...`);

  const client = new EventBridgeClient({ profile: profile, region: region });
  const result = await client.send(new PutEventsCommand({ Entries: entries }));

  if (result.FailedEntryCount && result.FailedEntryCount > 0) {
    console.error("Failed:", result.Entries);
  } else {
    console.log(`Event sent to ${eventBus}`);
  }
  
}

seedInvoices().catch(console.error);
