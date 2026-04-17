import { Certificates, Parameters } from '../config/types';
import { readFileSync, existsSync } from 'fs';

export function loadCertificates(path: string): Certificates {

  let certCache: Certificates;

  try {
    const certsFile = readFileSync(path, 'utf-8');
    certCache = JSON.parse(certsFile);

    const certs: Certificates = {
      caCertPem: certCache.caCertPem,
      bridgeCertPem: certCache.bridgeCertPem,
      bridgeKeyPem: certCache.bridgeKeyPem,
    }
    return certs;

  } catch (error) {
    console.error('Unable to load certificates cache file:', path);
    console.error('To generate certificates run: `npm run certs:generate`');
    process.exit(1);
  }
}

export function loadParameters(path: string): Parameters {

  let paramCache: Parameters;

  try {
    if (existsSync(path)) {
      const paramsFile = readFileSync(path, 'utf-8');
      paramCache = JSON.parse(paramsFile);
    } else {
      console.warn('To generate parameters run: `npm run params:get`');
      paramCache = { 
        rolesAnywhere: { 
          trustAnchorArn: 'value-not-set', 
          profileArn: 'value-not-set', 
          roleArn: 'value-not-set'
        }
      };
    }

    const params: Parameters = {
      rolesAnywhere: paramCache.rolesAnywhere
    }
    return params;

  } catch (error) {
    console.error('Unable to load parameters cache file:', path);
    console.error('To generate parameters run: `npm run params:get`');
    process.exit(1);
  }
}
