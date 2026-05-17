import * as forge from "node-forge";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { CertConfig, Certificates } from "../config/types";
import { configProps } from "../config/config";

const certConfig: CertConfig = {
  ca: {
    commonName: configProps.certs.commonName,
    organization: configProps.certs.organizationalUnit,
    country: configProps.certs.country,
    validityYears: 1,
  },
  bridge: {
    commonName: configProps.certs.commonName,
    organizationalUnit: configProps.certs.organizationalUnit,
    organization: configProps.certs.organization,
    country: configProps.certs.country,
    validityYears: 1,
  },
  outputDir: 'cdk.out/cache',
}

function generateCertificates(props: CertConfig): Certificates {

  console.log("Generating CA key pair...");
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCert = forge.pki.createCertificate();

  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = "01";
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date();
  caCert.validity.notAfter.setFullYear(
    caCert.validity.notAfter.getFullYear() + props.ca.validityYears
  );

  caCert.setSubject([
    { name: "commonName", value: "Cross-Partition CA" },
    { name: "organizationName", value: props.ca.organization },
    { name: "countryName", value: props.ca.country },
  ]);
  caCert.setIssuer(caCert.subject.attributes);

  caCert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", critical: true, digitalSignature: true, keyCertSign: true, cRLSign: true },
  ]);

  caCert.sign(caKeys.privateKey, forge.md.sha256.create());

  console.log("Generating bridge key pair...");
  const bridgeKeys = forge.pki.rsa.generateKeyPair(2048);
  const bridgeCert = forge.pki.createCertificate();

  bridgeCert.publicKey = bridgeKeys.publicKey;
  bridgeCert.serialNumber = "02";
  bridgeCert.validity.notBefore = new Date();
  bridgeCert.validity.notAfter = new Date();
  bridgeCert.validity.notAfter.setFullYear(
    bridgeCert.validity.notAfter.getFullYear() + props.bridge.validityYears
  );

  bridgeCert.setSubject([
    { name: "commonName", value: props.bridge.commonName },
    { name: "organizationalUnitName", value: props.bridge.organizationalUnit },
    { name: "organizationName", value: props.bridge.organization },
    { name: "countryName", value: props.bridge.country },
  ]);
  bridgeCert.setIssuer(caCert.subject.attributes);

  bridgeCert.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
    },
  ]);
  bridgeCert.sign(caKeys.privateKey, forge.md.sha256.create());

  console.log("Verifying certificates...");
  const caStore = forge.pki.createCaStore([caCert]);

  try {
    forge.pki.verifyCertificateChain(caStore, [bridgeCert]);
    console.log("\nChain verification: OK");
  } catch (e) {
    console.error("\nChain verification: FAILED", e);
    process.exit(1);
  }

  console.log(`\nCA valid until: ${caCert.validity.notAfter.toISOString()}`);
  console.log(`Bridge valid until: ${bridgeCert.validity.notAfter.toISOString()}`);
  console.log(`Bridge subject: ${bridgeCert.subject.getField("CN").value}, OU=${bridgeCert.subject.getField("OU").value}`);

  const files = {
    "ca-cert.pem": forge.pki.certificateToPem(caCert),
    "ca-key.pem": forge.pki.privateKeyToPem(caKeys.privateKey),
    "bridge-cert.pem": forge.pki.certificateToPem(bridgeCert),
    "bridge-key.pem": forge.pki.privateKeyToPem(bridgeKeys.privateKey),
  };

  for (const [filename, content] of Object.entries(files)) {
    const filepath = join(props.outputDir, filename);
    writeFileSync(filepath, content);
    console.log(`  Written: ${filepath}`);
  }

  return {
    // caKeyPem: forge.pki.privateKeyToPem(caKeys.privateKey),
    caCertPem: forge.pki.certificateToPem(caCert),
    bridgeCertPem: forge.pki.certificateToPem(bridgeCert),
    bridgeKeyPem: forge.pki.privateKeyToPem(bridgeKeys.privateKey),
  };
}

try {
  const outputDir = certConfig.outputDir;
  mkdirSync(outputDir, { recursive: true });
  const cachePath = `${outputDir}/certs.json`;

  if (existsSync(`${outputDir}/ca-cert.pem`)) {
    console.log("\nCertificates already exist in", outputDir);
    console.log("Clear the directory to regenerate certificates.");
    process.exit(0);
  }

  const certs: Certificates = generateCertificates(certConfig);
  writeFileSync(cachePath, JSON.stringify(certs, null, 2));
  console.log("\nCertificates JSON file defined in", cachePath);

  console.log("\nDONE.");
} catch (e) {
  console.error("\FAILED:", e);
  process.exit(1);
}
