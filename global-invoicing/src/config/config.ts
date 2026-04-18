import { ConfigProps } from "./types";

export const configProps: ConfigProps = {
  cache: "cdk.out/cache",
  standard: {
    partition: "aws",
    region: "eu-west-2",
    profile: "standard",
    location: "london",
    prefix: "invoicing-uk",
  },
  european: {
    partition: "aws-eusc",
    region: "eusc-de-east-1",
    profile: "european",
    location: "berlin",
    prefix: "invoicing-eu",
  },
  certs: {
    organization: "Surf Avenue",
    organizationalUnit: "Accounting",
    country: "PL",
    commonName: "Global Invoicing",
  },
  events: {
    invoices: {
      source: "org.surfave.invoicing",
      detailType: "InvoiceForwarder",
    },
    customers: {
      source: "org.surfave.invoicing",
      detailType: "CustomerForwarder",
    }
  },
  countries: [
      "AT",
      "BE",
      "BG",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "ES",
      "FI",
      "FR",
      "GR",
      "HR",
      "HU",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SE",
      "SI",
      "SK",
    ],
};
