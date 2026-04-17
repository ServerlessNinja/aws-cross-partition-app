import { SecretsManagerClient, PutSecretValueCommand, CreateSecretCommand } from "@aws-sdk/client-secrets-manager";
import { configProps } from "../config/config";
import { Certificates } from "../config/types";
import { loadCertificates } from "./load-cache";

const prefix: string = configProps.global.prefix;
const region: string = configProps.global.region;
const cacheFile = `${configProps.cache}/certs.json`;
const secretName = `${prefix}/bridge-certificate`;

async function uploadCerts() {
  const certs: Certificates = loadCertificates(cacheFile);

  const secretValue = JSON.stringify({
    certificate: certs.bridgeCertPem,
    privateKey: certs.bridgeKeyPem,
  });

  const client = new SecretsManagerClient({ region: region });

  try {
    await client.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: secretValue,
    }));
    console.log(`Updated value of existing secret: ${secretName}`);
  } catch (err: any) {
    console.error(`Failed to update secret: ${err.name} — ${err.message}`);
  }
}

uploadCerts().catch(console.error);
