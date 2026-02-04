---
description: Automated workflow to collect opportunity data and create engagement projects.
---
# Automation Workflow

## Phase 1: Data Collection

Before creating projects, you need to gather the opportunity data.

1.  **Navigate to Sales Connect**: Go to [https://sales.connect.corp.google.com/opportunities/all](https://sales.connect.corp.google.com/opportunities/all).
2.  **Filter by Quarters**:
    *   Locate the "Quarters" filter at the top.
    *   Set the range to **Q4 2025** through **Q4 2026**.
    *   Apply the filter.
3.  **Extract Data**:
    *   Scrape the "All Opportunities" table to extract the following columns for each row, **satisfying ALL valid conditions**:
        *   **Revenue** > $200k
        *   **Opportunity Stage** is NOT `Lost`, `Abandoned`, or `Implemented`
    *   **Columns**:
        *   `Opportunity ID` (from the Opportunity link)
        *   `Opportunity Name`
        *   `Opportunity Stage`
        *   `Company ID` (from the Partner/Portfolio link)
        *   `Company Name`
        *   `Owner` (Sales POC)
        *   `Revenue` (Deal Value)
    *   Format this data into a TSV (Tab Separated Values) or Table format.

**Example Data Format:**
```tsv
Opportunity ID	Opportunity Name	Opportunity Stage	Company ID	Company Name	Owner	Revenue
79710110	[26Q2] RCS renewal	Negotiation	1222877	CairoRCS Media	Livia Bettini	$32,000.00k
90047413	[26Q2] AdKaora Renewal	Qualifying	42409394	AdKaora - adkaora.com	Emanuele Gallozzi	$25,000.00k
...
```

---

## Phase 2: Project Creation

Once you have the table above, process each row to create a new project:

1.  **Open the Form**: Go to `https://engagements.connect.corp.google.com/new?entity=PUBLISHER&work=STANDALONE_PROJECT&cbo=Revenue&flc=Technical%20Consultation&lt=NA%20-%20Standard%20support&country=IT&team=Pubs&ia=N%2FA&product=Google%20Ad%20Manager%20360%20-%20Display&opp=`
2.  **Fill Opportunity Details**:
    *   **Opportunity ID**: Enter the value from the `Opportunity ID` column.
    *   **Sales POC**: Enter the name from the `Owner` column and select the matching user from the dropdown.
    *   **Title**: Enter the value from the `Opportunity Name` column, followed by the Revenue formatted in Millions (e.g., " 32.0M").
        *   **Format**: Convert the value to Millions (M) rounded to one decimal place (nearest 100k).
        *   **Examples**:
            *   $32,000k -> 32.0M
            *   $210k -> 0.2M
    *   **Description**: Enter the value from the `Opportunity Name` column (without the revenue value).
3.  **Configure Company**:
    *   **Company level**: Change the dropdown to "Division".
    *   **Customer**: Enter the `Company ID` into the "Customer name (Division)" field and select the matching company from the suggestions (e.g., "[Company Name] ([Company ID])").
4.  **Set Status & Dates**:
    *   **Status**: Change to "In Development".
    *   **Start date**: Set to "1/1/2026".
    *   **End date**: Set to "12/31/2026".
5.  **Submit**: Click "Submit", then click the confirmation "Submit" button.
6.  **Repeat**: Proceed to the next row in the table.
