/* DISCLAIMER: Copyright Google LLC. Supported by Google LLC and/or its affiliate(s). This solution, including any related sample code or data, is made available on an “as is,” “as available,” and “with all faults” basis, solely for illustrative purposes, and without warranty or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements.  To the extent that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all necessary and appropriate rights, consents and permissions to permit Google to use and process that data.  By using any portion of this solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage and any processing of data by Google, including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at all. With respect to the entrustment of personal information to Google, you will verify that the established system is sufficient by checking Google's privacy policy and other public information, and you agree that no further information will be provided by Google. */

var ui = SpreadsheetApp.getUi();
var output = HtmlService.createHtmlOutput(
  "<script>google.script.host.close();</script>"
).setHeight(5);
ui.showModalDialog(output, "Script running");

const sheet = SpreadsheetApp.getActiveSheet();
const apiVersion = UrlFetchApp.fetch(
  "https://developers.google.com/ad-manager/api/rel_notes"
)
  .toString()
  .match("Latest version.*?(v[0-9]{6})")[1];
const apiService = `LineItemService`;

function callGamApi(apiOperation, apiQuery, filterStatement, networkCode) {
  let soapRequest = HtmlService.createTemplateFromFile(`soapTemplate`);
  soapRequest.apiOperation = apiOperation;
  soapRequest.apiQuery = apiQuery;
  soapRequest.filterStatement = filterStatement;
  soapRequest.networkCode = networkCode;
  soapRequest = soapRequest.evaluate().getContent();
  let apiResponse = UrlFetchApp.fetch(
    `https://ads.google.com/apis/ads/publisher/${apiVersion}/${apiService}`,
    {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: soapRequest,
      muteHttpExceptions: true,
    }
  ).toString();
  return apiResponse;
}

function downloadData(formData) {
  let response = callGamApi(
    "getLineItemsByStatement",
    [formData.apiQuery],
    true,
    [formData.networkCode]
  );
  let regex =
    "<orderId>([^<]+)</orderId>.*?<id>([0-9]+)</id>.*?<name>([^<]+)</name>.*?<orderName>([^<]+)</orderName>.*?<childContentEligibility>([a-zA-Z]*)</childContentEligibility>";
  let attributes = Array.from(response.matchAll(regex, "g"), (x) =>
    x.splice(1)
  );
  sheet
    .getDataRange()
    .offset(1, 0, sheet.getLastRow(), sheet.getLastColumn())
    .clear();
  sheet
    .getDataRange()
    .offset(1, 0, attributes.length, attributes[0].length)
    .setValues(attributes);
  var output = HtmlService.createHtmlOutput(
    "<script>google.script.host.close();</script>"
  ).setHeight(5);
  ui.showModalDialog(output, "Script finished");
}

let uploadData = function (formData) {
  let response = callGamApi(
    "getLineItemsByStatement",
    [formData.apiQuery],
    true,
    [formData.networkCode]
  ).replaceAll("results", "lineItems");
  apiQuery = response
    .match("<lineItems>.*</lineItems>", "g")
    .toString()
    .replaceAll(
      RegExp("(?<=<childContentEligibility>)(.*?)(?=<)", "g"),
      formData.childContentEligibility
    );
  apiQuery = Array.from(
    apiQuery.matchAll("(<lineItems>.*?</lineItems>)", "g"),
    (x) => x.splice(1)
  );
  response = callGamApi("updateLineItems", apiQuery, false, [
    formData.networkCode,
  ]);
  if (response.match("<faultstring>.*</faultstring>", "g")) {
    const faultString = response
      .match("<faultstring>.*</faultstring>", "g")
      .toString();
    let errorElements = Array.from(
      faultString.matchAll("[0-9]+", "g"),
      (x) => x[0]
    );
    errorElements = errorElements.sort().reverse();
    for (const errorElement of errorElements) {
      apiQuery.splice(errorElement, 1);
    }
    response = callGamApi("updateLineItems", apiQuery, false, [
      formData.networkCode,
    ]);
  }
  downloadData(formData);
};
