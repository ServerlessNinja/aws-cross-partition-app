import json
import os
import subprocess
import tempfile
import boto3

SIGNING_HELPER = "/opt/bin/aws_signing_helper"
CERT_PATH = "/tmp/certificate.pem"
KEY_PATH = "/tmp/private-key.pem"
EU_COUNTRIES = os.environ.get("EU_COUNTRIES", "").split(",")

cached_credentials = None


def load_certificate():
  client = boto3.client("secretsmanager")
  response = client.get_secret_value(SecretId=os.environ["CERT_SECRET_ARN"])
  secret = json.loads(response["SecretString"])

  with open(CERT_PATH, "w") as f:
    f.write(secret["certificate"])

  with open(KEY_PATH, "w") as f:
    f.write(secret["privateKey"])


def get_credentials():
  global cached_credentials

  if cached_credentials:
    from datetime import datetime, timezone
    expires = datetime.fromisoformat(
      cached_credentials["expiration"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc).timestamp() < expires.timestamp() - 300:
      print("  Using cached credentials")
      return cached_credentials

  cmd = [
    SIGNING_HELPER, "credential-process",
    "--certificate", CERT_PATH,
    "--private-key", KEY_PATH,
    "--trust-anchor-arn", os.environ["RA_TRUST_ANCHOR_ARN"],
    "--profile-arn", os.environ["RA_PROFILE_ARN"],
    "--role-arn", os.environ["RA_ROLE_ARN"],
    "--region", os.environ["RA_REGION"],
    "--endpoint", f"https://rolesanywhere.{os.environ['RA_REGION']}.amazonaws.eu",
  ]

  print(
    f"  Signing helper command: {' '.join(cmd).replace(KEY_PATH, '[REDACTED]')}")

  result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

  if result.returncode != 0:
    print(f"  stderr: {result.stderr}")
    raise Exception(f"Signing helper failed: {result.stderr}")

  parsed = json.loads(result.stdout)
  cached_credentials = {
    "accessKeyId": parsed["AccessKeyId"],
    "secretAccessKey": parsed["SecretAccessKey"],
    "sessionToken": parsed["SessionToken"],
    "expiration": parsed["Expiration"],
  }
  return cached_credentials


def lambda_handler(event, context):
  # Step 1: Load certificate and private key from Secrets Manager
  try:
    print(f"Step 1: Loading certificate from secret: {os.environ['CERT_SECRET_ARN']}")
    load_certificate()
  except Exception as e:
    print(f"Step 1: FAILED — {e}")
    raise

  # Step 2: Get credentials from Roles Anywhere using the signing helper
  try:
    print("Step 2: Getting Roles Anywhere credentials")
    print(f"  Trust Anchor: {os.environ['RA_TRUST_ANCHOR_ARN']}")
    print(f"  Profile: {os.environ['RA_PROFILE_ARN']}")
    print(f"  Role: {os.environ['RA_ROLE_ARN']}")
    print(f"  Region: {os.environ['RA_REGION']}")
    creds = get_credentials()
    print(f"Step 2: OK — AccessKeyId: {creds['accessKeyId'][:8]}...")
    print(f"  Expiration: {creds['expiration']}")
  except Exception as e:
    print(f"Step 2: FAILED — {e}")
    raise

  # Step 3: Replicate stream changes directly to the EUSC DynamoDB table
  try:
    table_name = os.environ["EUSC_CUSTOMERS_TABLE"]
    print(f"Step 3: Replicating to EUSC table: {table_name}")

    eusc_ddb = boto3.client(
      "dynamodb",
      region_name=os.environ["RA_REGION"],
      aws_access_key_id=creds["accessKeyId"],
      aws_secret_access_key=creds["secretAccessKey"],
      aws_session_token=creds["sessionToken"],
      endpoint_url=f"https://dynamodb.{os.environ['RA_REGION']}.amazonaws.eu",
    )

    replicated = 0
    skipped = 0

    for record in event["Records"]:
      event_name = record["eventName"]
      keys = record["dynamodb"]["Keys"]

      if event_name in ("INSERT", "MODIFY"):
        new_image = record["dynamodb"]["NewImage"]
        country = new_image.get("country", {}).get("S", "")
        if country not in EU_COUNTRIES:
          print(f"Skipping non-EU customer: {country}")
          skipped += 1
          continue

        # NewImage is already in DynamoDB JSON (attribute-value) format
        eusc_ddb.put_item(TableName=table_name, Item=new_image)
        replicated += 1

      elif event_name == "REMOVE":
        # Keys are in DynamoDB JSON format; delete to keep EUSC in sync
        eusc_ddb.delete_item(TableName=table_name, Key=keys)
        replicated += 1

      else:
        print(f"Ignoring unexpected eventName: {event_name}")
        skipped += 1

    print(f"Done: {replicated} replicated, {skipped} skipped")
    return {"replicated": replicated, "skipped": skipped}

  except Exception as e:
    print(f"Step 3: FAILED — {e}")
    raise
