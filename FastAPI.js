/* DISCLAIMER: Copyright Google LLC. Supported by Google LLC and/or its affiliate(s). This solution, including any related sample code or 
data, is made available on an “as is,” “as available,” and “with all faults” basis, solely for illustrative purposes, and without warranty 
or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is 
subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements.  To the extent
that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all 
necessary and appropriate rights, consents and permissions to permit Google to use and process that data.  By using any portion of this 
solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage and any processing of data by Google, 
including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at 
all. With respect to the entrustment of personal information to Google, you will verify that the established system is sufficient by 
checking Google's privacy policy and other public information, and you agree that no further information will be provided by Google. */

// --- Configuration ---
const ui = SpreadsheetApp.getUi(); // Gets the user interface environment.
const sheet = SpreadsheetApp.getActiveSheet(); // Gets the currently active sheet.
const apiService = `LineItemService`; // Defines the Ad Manager API service to be used.
const tagsToExtract = [
  "orderId",
  "id",
  "name",
  "orderName",
  "childContentEligibility",
]; // Lists which tags to extract from the API response, to be printed in the sheet.

// Turns the list of tags into a regular expression for later use when downloading data from the API.
function generateRegex(properties) {
  let regexString = "";
  properties.forEach((property) => {
    regexString += `<${property}>([^<]+)<\/${property}>.*?`;
  });
  return new RegExp(regexString, "g");
}

/**
 * Displays a modal dialog with a message.
 * @param {string} message The message to display.
 */
function showStatusDialog(message) {
  const htmlOutput = HtmlService.createHtmlOutput(
    `<script>google.script.host.close();</script>`
  ).setHeight(5); // Creates an HTML output to close the dialog after a short time.
  ui.showModalDialog(htmlOutput, message); // Shows the modal dialog with the provided message.
}

/**
 * Fetches the latest Ad Manager API version.
 * @return {string|null} The latest API version or null if an error occurs.
 */
function getLatestApiVersion() {
  try {
    const response = UrlFetchApp.fetch(
      "https://developers.google.com/ad-manager/api/rel_notes"
    ).getContentText(); // Fetches the content of the Ad Manager release notes page.
    const match = response.match("Latest version.*?(v[0-9]{6})"); // Regular expression to extract the latest API version.
    return match ? match[1] : null; // Returns the extracted version or null if not found.
  } catch (error) {
    Logger.log(`Error fetching API version: ${error}`); // Logs any error that occurs during the fetching process.
    return null;
  }
}

const apiVersion = getLatestApiVersion(); // Retrieves and stores the latest API version.

/**
 * Calls the Google Ad Manager API with the specified operation and query.
 * @param {string} apiOperation The API operation to call (e.g., "getLineItemsByStatement", "updateLineItems").
 * @param {string} apiQuery The SOAP query or array of queries.
 * @param {boolean} filterStatement Indicates if the apiQuery is a filter statement (for get operations).
 * @param {string} networkCode The Ad Manager network code.
 * @return {string} The API response as a string.
 */
function callGamApi(apiOperation, apiQuery, filterStatement, networkCode) {
  if (!apiVersion) {
    ui.alert(
      "Error",
      "Could not fetch the latest Ad Manager API version.",
      ui.ButtonSet.OK
    );
    return "";
  }

  // Loads the SOAP request from a templated HTML file.
  const soapTemplate = HtmlService.createTemplateFromFile(`soapTemplate`);
  // Compiles the API operation, API query, filter statement flag and network code in the template.
  soapTemplate.apiOperation = apiOperation;
  soapTemplate.apiQuery = apiQuery;
  soapTemplate.filterStatement = filterStatement;
  soapTemplate.networkCode = networkCode;
  const soapRequest = soapTemplate.evaluate().getContent();

  // Attempts to call the Google Ad Manager API with the above SOAP payload.
  try {
    const apiResponse = UrlFetchApp.fetch(
      `https://ads.google.com/apis/ads/publisher/${apiVersion}/${apiService}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
        contentType: "text/xml; charset=utf-8",
        payload: soapRequest, // Sets the SOAP request XML as the payload.
        muteHttpExceptions: true, // Prevents HTTP exceptions from being thrown for non-200 responses.
      }
    ).getContentText(); // Sends the API request and gets the response content as text.

    // Adds logic to capture successfull API calls that return GAM errors.
    const isError = apiResponse.match("<faultstring>(.*)</faultstring>", "g");
    if (isError) {
      ui.alert(
        "Error",
        `An error occurred while calling the GAM API: (${isError[1]}).`,
        ui.ButtonSet.OK
      );
    } else {
      return apiResponse;
    }
  } catch (error) {
    Logger.log(`Error calling GAM API (${apiOperation}): ${error}`); // Logs any error during the API call.
    ui.alert(
      "Error",
      `An error occurred while calling the GAM API (${apiOperation}). See logs for details.`,
      ui.ButtonSet.OK
    );
    return "";
  }
}

/**
 * Downloads data from the Google Ad Manager API based on the form data and writes it to the active sheet.
 * @param {object} formData An object containing the API query and network code.
 */
function downloadData(formData) {
  showStatusDialog("Downloading data..."); // Shows a status dialog.
  const downloadResponse = callGamApi(
    "getLineItemsByStatement", // Dowloads a list of line items matching the apiQuery statement.
    [formData.apiQuery], // Passes the API query from the form data.
    true, // Indicates that the apiQuery contains a filter statement.
    [formData.networkCode] // Passes the network code from the form data.
  );

  // Extracts the relevant attribute tags from the API response.
  const regex = generateRegex(tagsToExtract);
  const attributes = Array.from(
    downloadResponse.matchAll(regex),
    (match) => match.slice(1) // Extracts the captured groups from each match.
  );

  // Clears any existing data below the header row.
  sheet
    .getDataRange()
    .offset(1, 0, sheet.getLastRow(), sheet.getLastColumn())
    .clearContent();

  // Prints the extracted data in the sheet, if any.
  if (attributes.length > 0) {
    sheet
      .getRange(2, 1, attributes.length, attributes[0].length)
      .setValues(attributes);
  } else {
    ui.alert(
      "Info",
      "No line items found matching your query.",
      ui.ButtonSet.OK
    );
  }

  showStatusDialog("Script finished"); // Shows a status dialog indicating completion.
}

/**
 * Uploads data to the Google Ad Manager API based on the form data.
 * @param {object} formData An object containing the API query, network code, and child content eligibility.
 */
function uploadData(formData) {
  showStatusDialog("Updating data..."); // Shows a status dialog.

  const downloadResponse = callGamApi(
    "getLineItemsByStatement",
    [formData.apiQuery],
    true,
    [formData.networkCode]
  ).replaceAll("results", "lineItems"); // Replaces "results" with "lineItems" for consistency with update operation.

  // Updates the value of the Child Content Eligibility flag for each Line Item.
  const updatedLineItems = downloadResponse
    .match("<lineItems>.*</lineItems>", "g") // Matches all <lineItems> blocks.
    .toString() // Converts the match result to a string.
    .replaceAll(
      RegExp("(?<=<childContentEligibility>)(.*?)(?=<)", "g"), // Regular expression to find content within <childContentEligibility> tags.
      formData.childContentEligibility // Replaces the existing value with the value from the form.
    );

  // Prepares the apiQuery payload for the following call to the Google Ad Manager API.
  const apiQuery = Array.from(
    updatedLineItems.matchAll("(<lineItems>.*?</lineItems>)", "g"), // Matches all updated <lineItems> blocks.
    (x) => x.splice(1) // Extracts the content of each <lineItems> block.
  );

  // Throws an error if there are no Line Items to update.
  if (apiQuery.length === 0) {
    ui.alert("Info", "No line items found to update.", ui.ButtonSet.OK);
    showStatusDialog("Script finished");
    return;
  }

  const updateResponse = callGamApi(
    "updateLineItems", // Updates a list of line items matching the apiQuery statement.
    apiQuery,
    false,
    [formData.networkCode]
  );

  // Checks if the update response contains an error.
  const isError = updateResponse.match("<faultstring>.*</faultstring>", "g");

  // If some line items contain errors, removes them and retries updating the remaining line items.
  if (isError) {
    const faultString = updateResponse
      .match("<faultstring>.*</faultstring>", "g") // Extracts the error message.
      .toString();

    const errorElements = Array.from(
      faultString.matchAll("[0-9]+", "g"), // Extracts failed item indices from the error message.
      (x) => parseInt(x[0]) // Parses the extracted strings to integers.
    );

    // Ensures items are processed from higher indices downwards, to avoid shifting issues when removing elements from an array by index.
    const sortedErrorElements = errorElements.sort((a, b) => b - a); // Sorts the error indices in descending order.

    // Removes the line item at the identified error index.
    for (const sortedErrorElement of sortedErrorElements) {
      apiQuery.splice(sortedErrorElement, 1);
    }

    if (apiQuery.length > 0) {
      // At least one line item without errors.
      callGamApi(
        "updateLineItems", // Calls GAM API again without error line items.
        apiQuery,
        false,
        [formData.networkCode]
      );
      ui.alert(
        "Success",
        `Successfully updated ${apiQuery.length} line items after ${errorElements.length} initial failures.`,
        ui.ButtonSet.OK
      );
    } else {
      // No line items without errors.
      ui.alert(
        "Error",
        `All updates failed. Check logs for details: ${faultString}`,
        ui.ButtonSet.OK
      );
    }
  } else {
    // All line items without errors.
    ui.alert(
      "Success",
      `Successfully updated all ${apiQuery.length} line items.`,
      ui.ButtonSet.OK
    );
  }

  downloadData(formData); // Downloads the updated data to the sheet.
}
