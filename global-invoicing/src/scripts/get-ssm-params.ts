import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { configProps } from "../config/config";
import { Parameters } from "../config/types";
import { writeFileSync } from "fs";

const prefix: string = configProps.europe.prefix;
const region: string = configProps.europe.region;
const cacheFile = "cdk.out/params.json"

async function getSsmParameters() {
  const client = new SSMClient({ region: region });

  console.log("Fetching parameters from SSM Parameter Store...");

  const getParameter = async (name: string) => {
    const command = new GetParameterCommand({ Name: name });
    const response = await client.send(command);
    return response.Parameter?.Value;
  };

  const trustAnchorArn = await getParameter(`/${prefix}/ra-trust-anchor-arn`) || '';
  const profileArn = await getParameter(`/${prefix}/ra-profile-arn`) || '';
  const roleArn = await getParameter(`/${prefix}/ra-role-arn`) || '';

  console.log("Saving parameters to a cache file...");

  const output: Parameters = {
    rolesAnywhere: {
      trustAnchorArn: trustAnchorArn,
      profileArn: profileArn,
      roleArn: roleArn,
    }
  };

  console.log(output);

  writeFileSync(`${cacheFile}`, JSON.stringify(output, null, 2));
}

getSsmParameters().catch(console.error);
