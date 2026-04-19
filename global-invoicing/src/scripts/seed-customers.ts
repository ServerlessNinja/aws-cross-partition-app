import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { configProps } from "../config/config";
import { readFileSync } from "fs";

const prefix: string = configProps.standard.prefix;
const region: string = configProps.standard.region;
const profile: string = configProps.standard.profile;
const dataFile = "src/data/customers.json";
const tableName = `${prefix}-customers`;

async function seedCustomers() {
  const customers = JSON.parse(readFileSync(dataFile, "utf-8"));

  if (!Array.isArray(customers)) {
    console.error("JSON file must contain an array of customers");
    process.exit(1);
  }

  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ profile: profile, region: region })
  );

  const result = await client.send(new BatchWriteCommand({
    RequestItems: {
      [tableName]: customers.map((customer: any) => ({
        PutRequest: {
          Item: customer,
        },
      })),
    },
  }));

  const unprocessed = result.UnprocessedItems?.[tableName]?.length ?? 0;
  console.log(`Done: ${customers.length - unprocessed} written, ${unprocessed} unprocessed`);

  console.log(`Done: ${customers.length} customers seeded to ${tableName}`);
}

seedCustomers().catch(console.error);
