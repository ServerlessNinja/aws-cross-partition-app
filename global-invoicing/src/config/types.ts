export interface OrganizationInfo {
  organization: string;
  organizationalUnit: string;
  country: string;
  commonName: string;
}

export interface StandardPartitionConfig {
  partition?: string;
  account?: string;
  region: string;
  profile: string;
  location: string;
  prefix: string;
}

export interface EuropeanPartitionConfig {
  partition?: string;
  account?: string;
  region: string;
  profile: string;
  location: string;
  prefix: string;
}

export interface EventBridgeConfig {
  source: string;
  detailType: string;
}

export interface ConfigProps {
  global: StandardPartitionConfig;
  europe: EuropeanPartitionConfig;
  certs: OrganizationInfo;
  events: {
    invoices: EventBridgeConfig;
    customers: EventBridgeConfig;
  }
  cache: string;
  countries: string[];
}

export interface CertConfig {
  ca: {
    commonName: string;
    organization: string;
    country: string;
    validityYears: number;
  };
  bridge: {
    commonName: string;
    organizationalUnit: string;
    organization: string;
    country: string;
    validityYears: number;
  };
  outputDir: string;
}

export interface Certificates {
  caCertPem: string;
  caKeyPem?: string;
  bridgeCertPem: string;
  bridgeKeyPem: string; 
}

export interface Parameters {
  rolesAnywhere: {
    trustAnchorArn: string;
    profileArn: string;
    roleArn: string;
  }
}
