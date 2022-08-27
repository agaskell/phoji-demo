import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

import { readFile } from "fs/promises";
import { lookup } from "mime-types";

const env = (process.env.PHOJI_ENV || "prod").toLowerCase();
const apiUrl =
  env === "prod"
    ? "https://api.phoji.app/graphql"
    : "https://dev.api.phoji.app/graphql";

function getClient(token: string = "") {
  return new ApolloClient({
    uri: apiUrl,
    cache: new InMemoryCache(),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function authenticate(email: string, password: string) {
  const result = await getClient().mutate({
    mutation: gql`
      mutation { 
        authenticate(email: "${email}", password: "${password}") {
          token
        }
      }
    `,
  });
  return result.data.authenticate.token;
}

async function getCampaigns(token: string) {
  const result = await getClient(token).query({
    query: gql`
      query {
        campaigns {
          campaignId
          name
        }
      }
    `,
  });

  return result.data.campaigns;
}

async function phojiPresignUpload(
  campaignId: string,
  fileName: string,
  token: string,
  fileType: string = "image/png"
) {
  const result = await getClient(token).mutate({
    mutation: gql`
      mutation { 
        presignPhojiUpload (
          fileName: "${fileName}",
          fileType: "${fileType}", 
          campaignId: "${campaignId}"
        ) {
          url
        }
      }
    `,
  });

  return result.data.presignPhojiUpload.url;
}

async function uploadImage(url: string, fileName: string, fileType: string) {
  const file = await readFile(fileName);
  const response = await fetch(url, {
    headers: {
      // This header is important. Make sure it matches the file type.
      "Content-Type": fileType,
    },
    method: "PUT",
    body: file,
  });

  if (response.ok) {
    return await response.text();
  } else {
    console.log("Upload failed", response);
  }
}

(async function main() {
  const username = process.env.PHOJI_USERNAME;
  const password = process.env.PHOJI_PASSWORD;

  if (!username) {
    console.log("PHOJI_USERNAME environment variable must be set.");
  }

  if (!password) {
    console.log("PHOJI_PASSWORD environment variable must be set.");
  }

  if (!username || !password) {
    return;
  }

  const token = await authenticate(username, password);

  const campaigns = await getCampaigns(token);
  const [firstCampaign] = campaigns;

  const fileName = "TinyRick.png";
  const fileType = lookup(fileName) || "unknown";

  const uploadUrl = await phojiPresignUpload(
    firstCampaign.campaignId,
    fileName,
    token,
    fileType
  );

  await uploadImage(uploadUrl, fileName, fileType);

  console.log("=========================================================");
  console.log("Sample image uploaded!");
  console.log();
  console.log("Example URLs:");

  const staticBase =
    env === "prod"
      ? "https://static.phoji.app/"
      : "https://dev.static.phoji.app/";

  const fullUrl = `${staticBase}${firstCampaign.campaignId}/${fileName}`;

  console.log(`\t${fullUrl}                       <- Original image`);
  console.log(
    `\t${fullUrl}?s=60                  <- Phoji of size 60 pixels. s is for size`
  );
  console.log(
    `\t${fullUrl}?s=200&c=300x299       <- Phoji of 200 pixels, off center. The c value is an x and y coordinate pair used for centering the Phoji.`
  );
  console.log(
    `\t${fullUrl}?s=200&c=200x200&r=50  <- Phoji of 200 pixels, zoomed in. r is for radius. Can be used without specifying a center.`
  );
})();
