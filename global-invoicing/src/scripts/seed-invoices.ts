import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from "@aws-sdk/client-eventbridge";
import { configProps } from "../config/config";
import { readFileSync } from "fs";

const prefix: string = configProps.standard.prefix;
const region: string = configProps.standard.region;
const profile: string = configProps.standard.profile;

const eventFiles = [
  "shared-tools/events/invoice-de.event.json",
  "shared-tools/events/invoice-dk.event.json",
  "shared-tools/events/invoice-gb.event.json",
  "shared-tools/events/invoice-pl.event.json",
];

async function seedInvoices() {
  const entries: PutEventsRequestEntry[] = [];

  for (const file of eventFiles) {
    const content = JSON.parse(readFileSync(file, "utf-8"));
    const events = Array.isArray(content) ? content : [content];

    for (const event of events) {
      entries.push({
        EventBusName: `${prefix}-bus`,
        Source: event.source,
        DetailType: event.detailType,
        Detail: JSON.stringify(event.detail),
      });
    }
  }

  console.log(`Sending ${entries.length} events to ${prefix}-bus...`);

  const client = new EventBridgeClient({ profile: profile, region: region });
  const result = await client.send(new PutEventsCommand({ Entries: entries }));

  if (result.FailedEntryCount && result.FailedEntryCount > 0) {
    console.error("Failed:", result.Entries);
  } else {
    console.log(`Event sent to ${prefix}-bus`);
  }
  
}

seedInvoices().catch(console.error);
