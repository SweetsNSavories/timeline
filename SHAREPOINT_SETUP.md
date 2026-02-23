# SharePoint Setup Guide for Timeline Virtual Entity

This guide explains how to create a SharePoint list to serve as the data source for the Shipment Virtual Entity, which feeds into the Timeline connector.

## Overview

```
SharePoint List → Virtual Entity (Dataverse) → Timeline Record Source → Timeline Control
```

The virtual entity acts as a bridge between SharePoint data and Power Apps/Dataverse, making SharePoint list data available in model-driven apps and Timeline controls.

---

## Step 1: Create SharePoint Site

### Option A: Using Microsoft 365
1. Go to **microsoft365.com** → **SharePoint**
2. Click **Create site** → **Team site** or **Communication site**
3. Enter site name: `Timeline Shipments` (or your preferred name)
4. Add site description and privacy settings
5. Click **Create**

### Option B: From Power Apps
1. In Power Platform admin center, navigate to **Data sources**
2. Select **New connection** → search for **SharePoint**
3. Authenticate and select your site

---

## Step 2: Create SharePoint List with Required Columns

Once in your SharePoint site, create a list with these columns to match the Shipment virtual entity:

| Column Name | Type | Required | Notes |
|-------------|------|----------|-------|
| **Title** | Single line of text | Yes | Default; used as header in Timeline |
| **Status** | Choice or Text | Yes | Values: "Shipped", "Delivered", "In Transit", etc. |
| **Recipient** | Single line of text | No | Recipient name or address |
| **Tracking Number** | Single line of text | No | Shipment tracking ID |
| **Ship Date** | Date | No | When shipment was created |
| **External Primary Key** | Single line of text | No | Link to external order system |

### Creating the List

1. In your SharePoint site, click **+ New** → **List**
2. Choose **Blank list**
3. Name it: `Shipments`
4. Add columns using **+ Add column**:

   **Title** (already exists by default)
   
   **Status**
   - Type: `Choice`
   - OR `Single line of text` if you prefer flexibility
   - Choices: "Shipped", "Delivered", "In Transit", "Pending"
   
   **Recipient**
   - Type: `Single line of text`
   
   **Tracking Number**
   - Type: `Single line of text`
   
   **Ship Date**
   - Type: `Date and time`
   - Default: Today's date (optional)
   
   **External Primary Key**
   - Type: `Single line of text`

### Sample Data

Add test records like:

| Title | Status | Recipient | Tracking Number | Ship Date |
|-------|--------|-----------|-----------------|-----------|
| Order #1001 | Shipped | John Smith | TRK123456 | 2/20/2026 |
| Order #1002 | Delivered | Jane Doe | TRK123457 | 2/19/2026 |
| Order #1003 | In Transit | Bob Wilson | TRK123458 | 2/21/2026 |

---

## Step 3: Get SharePoint List Information

You'll need these details to configure the virtual entity:

1. **Site URL**: Copy from browser
   - Example: `https://yourtenant.sharepoint.com/sites/TimelineShipments`

2. **List Name**: `Shipments` (or whatever you named it)

3. **Column Internal Names**: In Power Platform, these may be mapped automatically, or you may need to reference them

---

## Step 4: Create Virtual Entity in Dataverse

### Prerequisites
- Power Platform admin access
- Virtual entity provider installed (must be configured by admin)

### Steps

1. Go to **Power Apps Maker Portal** (make.powerapps.com)
2. Navigate to **Solutions** → your solution
3. Select **+ New** → **Table** → **Virtual table**
4. Enter table name: `Shipments`
5. Enter plural name: `Shipments`
6. Select data source: **SharePoint**
7. Select site and list:
   - **Site**: `TimelineShipments`
   - **List**: `Shipments`
8. Map columns:
   - SharePoint "Title" → Dataverse "crbff_title"
   - SharePoint "Status" → Dataverse "crbff_field1"
   - SharePoint "Recipient" → Dataverse "crbff_field3"
   - SharePoint "Tracking Number" → Dataverse "crbff_field4"
   - SharePoint "External Primary Key" → Dataverse "crbff_externalprimarykey"

9. Save and sync the virtual entity

---

## Step 5: Verify Virtual Entity Records in Dataverse

1. In Power Apps Maker, open your model-driven app
2. Add a view of the virtual entity
3. Verify records appear (should see your SharePoint list data)
4. If no records appear, check:
   - SharePoint connection is authenticated
   - Virtual entity mapping is correct
   - Virtual entity has been synced

---

## Step 6: Configure Timeline Control with Custom Connector

This step registers the Shipment custom record source with the Timeline control on your form.

### Prerequisites
- Solution is imported (contains `crbff_ShipmentTimelineConnector` web resource)
- Virtual entity is working and has records

### Steps

1. **Open Form for Editing:**
   - Go to Power Apps Maker → Apps → Select your model-driven app
   - Edit the **Lead** form (or your desired form with Timeline)
   - Click **Edit** to open form designer

2. **Find Timeline Control:**
   - In form designer, locate the **Timeline** control
   - If not present, add it: **+ Component** → Search "Timeline"

3. **Open Timeline Properties:**
   - Select the Timeline control
   - In the right panel, click **Edit record sources** (or **Properties**)

4. **Add Custom Connector:**
   - Click **+ New** or **Add record source**
   - A dialog appears: **"Edit custom connector"**

5. **Fill in Custom Connector Details:**

   **Constructor:**
   ```
   SampleNamespace.ShipmentRecordSource
   ```
   - This is the class name defined in the web resource
   - It must match exactly (case-sensitive)

   **Resource path:**
   ```
   crbff_ShipmentTimelineConnector
   ```
   - This is the name of the web resource
   - It must match the web resource name in your solution

   **Configuration path:**
   ```
   (Leave empty)
   ```
   - Optional field for configuration objects
   - Not needed for this implementation

6. **Save:**
   - Click **OK** to confirm
   - Save the form changes
   - Publish the form

7. **Test:**
   - Open a Lead record
   - Timeline should now display shipment records
   - Open F12 Developer Console and look for `[ShipmentRecordSource]` logs
   - Test search bar and status filter dropdown

### What You Should See

| Component | Expected Behavior |
|-----------|-------------------|
| **Timeline Records** | Shipments appear with Title, Status, Recipient, Tracking |
| **Search Bar** | Type keyword → filters records on Title/Status/Recipient/Tracking |
| **Status Dropdown** | Select "Shipped" or "Delivered" → filters by status |
| **Pagination** | Shows 10 records per page, scroll to see more |
| **Console Logs** | `[ShipmentRecordSource] Cache hit - reusing 42 records` |

---

## Step 7: Verify Timeline Shows Shipments

1. Open a Lead record
2. Scroll to Timeline section
3. You should see:
   - All shipments in your list (first time = fetches from SharePoint)
   - Search bar working (filters against Title, Status, Recipient, Tracking)
   - Status filter dropdown (Shipped, Delivered, etc.)
   - Each record shows: Header (Title), Body (Status | Recipient), Footer (Tracking)

---

## Troubleshooting

### "No records appear in Timeline"
- ✓ Verify virtual entity has records (check Dataverse directly)
- ✓ Check browser console (F12) for errors in `[ShipmentRecordSource]` logs
- ✓ Ensure `crbff_ShipmentTimelineConnector` web resource is deployed
- ✓ Verify `SampleNamespace.ShipmentRecordSource` is registered in Timeline control

### "Virtual entity shows '0 records'"
- ✓ Verify SharePoint list exists and has data
- ✓ Check column mapping is correct
- ✓ Verify authenticated user has access to SharePoint site
- ✓ Force sync: Open virtual entity → click **Sync**

### "Search/Filter not working"
- ✓ Open browser console (F12)
- ✓ Search for `[ShipmentRecordSource]` logs
- ✓ Verify `filter.searchKey` is populated in console logs
- ✓ Check that `filter.filterData` shows selected filter values

---

## Performance Notes

- **First Load**: Fetches all records from SharePoint (may take 2-3 seconds depending on list size)
- **Caching**: Records are cached in memory during the session
- **Subsequent Searches**: Instant (client-side filtering on cached data)
- **Large Lists**: If >1000 records, consider filtering in SharePoint query (uncomment lead relationship filter in web resource)

---

## Next Steps

- Add more virtual entities to Timeline (e.g., Orders, Invoices)
- Customize body/footer display format in `crbff_ShipmentTimelineConnector`
- Implement lead-specific filtering (modify `_fetchAllRecords()` to filter by related lead)
- Test with real SharePoint data
