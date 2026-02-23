# Architecture Guide - Timeline Custom Record Source

## Deep Technical Dive into the Shipment Connector Implementation

This document explains the architectural decisions, code structure, and implementation patterns used in the Timeline Custom Record Source.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Class Design](#class-design)
3. [Data Processing Pipeline](#data-processing-pipeline)
4. [Key Patterns & Techniques](#key-patterns--techniques)
5. [Performance Optimization](#performance-optimization)
6. [Error Handling](#error-handling)

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Power Apps Form                          │
│   ┌──────────────────────────────────────────────────────┐  │
│   │          Timeline Control (OOTB Component)           │  │
│   │                                                       │  │
│   │  - Displays records from multiple sources            │  │
│   │  - Provides search bar & filter dropdowns            │  │
│   │  - Handles pagination                                │  │
│   └──────────────┬──────────────────────────────────────┘  │
│                  │                                           │
│                  │ Calls: getRecordsData(req, filter)       │
│                  ↓                                           │
│   ┌──────────────────────────────────────────────────────┐  │
│   │   ShipmentRecordSource (Custom Record Source)        │  │
│   │                                                       │  │
│   │  ✓ getRecordsData()                                  │  │
│   │  ✓ getFilterDetails()                                │  │
│   │  ✓ getRecordUX()                                     │  │
│   │  ✓ init()                                            │  │
│   └──────────────┬──────────────────────────────────────┘  │
│                  │                                           │
│                  ↓                                           │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
    ┌───────────────────────────────┐
    │   Dataverse Web API           │
    │                               │
    │ retrieveMultipleRecords()      │
    │ (Query: crbff_shipments)       │
    └───────────────┬───────────────┘
                    │
                    ↓
    ┌───────────────────────────────┐
    │   Virtual Entity              │
    │   (crbff_shipments)            │
    │                               │
    │   Logical → SharePoint Bridge  │
    └───────────────┬───────────────┘
                    │
                    ↓
    ┌───────────────────────────────┐
    │   SharePoint List             │
    │   (Shipments Data Source)      │
    │                               │
    │   Columns → Virtual Fields     │
    └───────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **Timeline Control** | UI rendering, pagination, search bar, filter dropdowns |
| **ShipmentRecordSource** | Fetch data, cache, search, filter, sort, format display |
| **Virtual Entity** | Translate Dataverse queries to SharePoint OData |
| **SharePoint List** | Actual data source |

---

## Class Design

### ShipmentRecordSource Class Structure

```javascript
SampleNamespace.ShipmentRecordSource = class {
  
  // ============ INITIALIZATION ============
  constructor() {
    this._moduleName = "ShipmentConnector";    // For logging
    this._recordsCache = null;                  // Memoization store
  }
  
  init(ctx) {
    this._context = ctx;                        // Dataverse context
    return Promise.resolve();
  }
  
  // ============ PUBLIC API (Timeline Interface) ============
  async getRecordsData(req, filter)             // Main entry point
  getFilterDetails()                             // Dropdown configuration
  getRecordUX(data)                              // UI formatting
  
  // ============ PRIVATE METHODS (Internal Processing) ============
  async _fetchAllRecords()                       // Web API call
  _applySearch(records, keyword)                 // Search filter
  _applyFilters(records, filterData)             // Dropdown filter
  _sortRecords(records, isAscending)             // Sort logic
  _getPaginatedRecords(records, req)             // Pagination logic
}
```

### Public vs Private Methods

**Public (Implemented for Timeline):**
- `init(ctx)` - Required by Timeline interface
- `getRecordsData(req, filter)` - Main orchestrator
- `getFilterDetails()` - Define filters
- `getRecordUX(data)` - Format UI

**Private (Internal):**
- `_fetchAllRecords()` - Web API wrapper
- `_applySearch()` - Search implementation
- `_applyFilters()` - Filter implementation
- `_sortRecords()` - Sort implementation
- `_getPaginatedRecords()` - Pagination implementation

---

## Data Processing Pipeline

### Request → Response Journey

#### Stage 1: Timeline Invocation

Timeline control calls:
```javascript
await recordSource.getRecordsData(req, filter);
```

**Request object (`req`):**
```javascript
{
  pageSize: 10,
  requestId: "req-abc123",
  isAscending: true,
  lastItem: { id: "shipment-42" }  // null on first page
}
```

**Filter object (`filter`):**
```javascript
{
  searchKey: "HVAC",               // From search bar
  filterData: [
    {
      name: "ShipmentStatus",
      options: [
        { value: "Shipped", isSelected: true },
        { value: "Delivered", isSelected: false }
      ]
    }
  ]
}
```

#### Stage 2: Caching

```javascript
if (!this._recordsCache) {
  console.log("[ShipmentRecordSource] Cache miss");
  
  // Fetch all shipments once
  let response = await this._context.webAPI.retrieveMultipleRecords(
    "crbff_shipments",
    "?$select=crbff_title,crbff_field1,crbff_field2,crbff_field3,crbff_field4,crbff_externalprimarykey"
  );
  
  // Transform to internal format
  this._recordsCache = response.entities.map(entity => ({
    id: entity.crbff_shipmentsid,
    sortDateValue: entity.createdon || new Date().toISOString(),
    data: JSON.stringify(entity)
  }));
  
  console.log(`[ShipmentRecordSource] Cached ${this._recordsCache.length} records`);
} else {
  console.log("[ShipmentRecordSource] Cache hit");
}
```

**Internal Record Format:**
```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // crbff_shipmentsid
  sortDateValue: "2026-02-15T10:30:00Z",         // createdon
  data: "{...full entity JSON...}"               // Serialized for later parsing
}
```

#### Stage 3: Search Filter

```javascript
let recordsData = [...this._recordsCache];

if (filter && filter.searchKey) {
  console.log(`[ShipmentRecordSource] Applying search: ${filter.searchKey}`);
  
  recordsData = this._applySearch(recordsData, filter.searchKey);
  
  console.log(`[ShipmentRecordSource] Results: ${recordsData.length} records`);
}
```

**Search Implementation:**
```javascript
_applySearch(records, keyword) {
  let searchTerm = keyword.toLowerCase();
  
  return records.filter(rec => {
    let entity = JSON.parse(rec.data);
    
    // Searchable text includes: title, status, recipient, tracking
    let searchable = `${entity.crbff_title} ${entity.crbff_field1} ${entity.crbff_field3} ${entity.crbff_field4}`.toLowerCase();
    
    return searchable.includes(searchTerm);
  });
}
```

#### Stage 4: Dropdown Filter

```javascript
if (filter && filter.filterData && filter.filterData.length > 0) {
  console.log("[ShipmentRecordSource] Applying dropdown filter");
  
  recordsData = this._applyFilters(recordsData, filter.filterData);
  
  console.log(`[ShipmentRecordSource] Results: ${recordsData.length} records`);
}
```

**Filter Implementation:**
```javascript
_applyFilters(records, filterData) {
  // Extract selected values from dropdown
  let selectedValues = [];
  filterData.forEach(group => {
    group.options.forEach(option => {
      if (option.isSelected) {
        selectedValues.push(option.value);  // ["Shipped", "Delivered", ...]
      }
    });
  });
  
  if (selectedValues.length === 0) return records;  // No filter selected
  
  // Keep only records matching selected values
  return records.filter(rec => {
    let entity = JSON.parse(rec.data);
    return selectedValues.includes(entity.crbff_field1);  // Status field
  });
}
```

#### Stage 5: Sort

```javascript
this._sortRecords(recordsData, req.isAscending);
console.log("[ShipmentRecordSource] Sorted by date");
```

**Sort Implementation:**
```javascript
_sortRecords(records, isAscending) {
  records.sort((a, b) => {
    let dateA = new Date(a.sortDateValue).getTime();
    let dateB = new Date(b.sortDateValue).getTime();
    return isAscending ? dateA - dateB : dateB - dateA;
  });
  // Note: sorts IN PLACE, doesn't return
}
```

#### Stage 6: Pagination

```javascript
let paginated = this._getPaginatedRecords(recordsData, req);
```

**Pagination Implementation - Cursor-Based:**
```javascript
_getPaginatedRecords(records, req) {
  let start = 0;
  
  if (req.lastItem) {
    // Find position of last item from previous page
    let lastIndex = records.findIndex(r => r.id === req.lastItem.id);
    if (lastIndex !== -1) {
      start = lastIndex + 1;  // Start after last item
    }
  }
  
  // Return slice: start to (start + pageSize)
  return records.slice(start, start + (req.pageSize || 10));
}
```

**Why Cursor-Based Pagination?**
- Handles filtering well (offset changes when filter changes)
- Handles deletions during navigation (offset-based fails)
- Matches Timeline's internal pagination model

#### Stage 7: UI Formatting

```javascript
let formattedRecords = paginated.map(rec => this.getRecordUX(rec));
```

**UI Formatting Implementation:**
```javascript
getRecordUX(rec) {
  let entity = JSON.parse(rec.data);
  let factory = this._context.factory;  // Power Apps UI factory
  
  return {
    id: rec.id,
    moduleName: this._moduleName,
    sortDateValue: rec.sortDateValue,
    searchText: `${entity.crbff_title} ${entity.crbff_field1} ${entity.crbff_field3} ${entity.crbff_field4}`,
    
    // Header: Display shipment title (bold)
    header: {
      components: [
        factory.createElement("Label", 
          { key: "h", style: { fontWeight: "bold" } },
          entity.crbff_title || "No Title"
        )
      ]
    },
    
    // Body: Display status and recipient
    body: {
      components: [
        factory.createElement("Label",
          { key: "b" },
          `Status: ${entity.crbff_field1} | To: ${entity.crbff_field3}`
        )
      ]
    },
    
    // Footer: Display tracking number
    footer: {
      components: [
        factory.createElement("Label",
          { key: "f" },
          `Tracking: ${entity.crbff_field4}`
        )
      ]
    }
  };
}
```

#### Stage 8: Response

```javascript
return {
  requestId: req.requestId,           // Echo back request ID
  records: formattedRecords,           // Formatted records array
  hasMoreRecords: paginated.length < recordsData.length  // Pagination flag
};
```

Timeline then renders these formatted records in the UI.

---

## Key Patterns & Techniques

### 1. Memoization Pattern (Caching)

**Problem:** Timeline calls `getRecordsData()` multiple times:
- Once on load
- Again after search
- Again after filter
- Again after sort
- Multiple times for pagination

**Solution:** Cache all records in constructor property on first call

```javascript
// Bad approach - refetch every time
async getRecordsData(req, filter) {
  let records = await this._context.webAPI.retrieveMultipleRecords(...);
  // Problem: 5+ API calls per session
}

// Good approach - cache once, reuse
constructor() {
  this._recordsCache = null;  // Initialize in constructor
}

async getRecordsData(req, filter) {
  if (!this._recordsCache) {
    this._recordsCache = await this._context.webAPI.retrieveMultipleRecords(...);
  }
  let recordsData = [...this._recordsCache];  // Copy array
  // Apply filters locally...
}
```

**Benefits:**
- ✅ 1 API call instead of 5+
- ✅ Instant search/filter (<50ms instead of 500ms)
- ✅ Better user experience

### 2. Client-Side Processing

**Problem:** OData queries are complex and slow with multiple conditions

**Solution:** Fetch all records, filter locally

```javascript
// Bad approach - complex OData
let query = "?$filter=" +
  "contains(title, 'HVAC') and " +
  "(status eq 'Shipped' or status eq 'Delivered') and " +
  "$orderby=createdon asc";
let results = await this._context.webAPI.retrieveMultipleRecords(..., query);

// Good approach - simpler OData, local filtering
let query = "?$select=field1,field2,field3";
let all = await this._context.webAPI.retrieveMultipleRecords(..., query);

// Now filter locally (instant):
let matching = all.filter(r => r.title.includes('HVAC'));
let filtered = matching.filter(r => ['Shipped', 'Delivered'].includes(r.status));
let sorted = filtered.sort(...);
```

### 3. Array Copy Pattern (Immutability)

```javascript
// Always work on a copy, don't mutate cache
let recordsData = [...this._recordsCache];  // Shallow copy

// Apply transformations to copy
recordsData = this._applySearch(recordsData, keyword);
recordsData = this._applyFilters(recordsData, filter);
this._sortRecords(recordsData, isAscending);  // Sorts in place

// Cache remains unchanged for next request
```

### 4. Cursor-Based Pagination

Instead of offset-based (problematic with filtering):

```javascript
// Cursor pattern: remember the ID of last item
if (req.lastItem) {
  let lastIndex = records.findIndex(r => r.id === req.lastItem.id);
  if (lastIndex !== -1) {
    start = lastIndex + 1;
  }
}
return records.slice(start, start + pageSize);
```

**Why better than offset?**
- Works correctly when filters change
- Handles record deletions gracefully
- Follows REST pagination standards

---

## Performance Optimization

### Bottleneck Analysis

| Stage | Time | Optimization |
|-------|------|--------------|
| Web API call | ~500ms | Cache (1x per session) |
| JSON parse | ~10ms | Only needed when reading field values |
| Array filter | <1ms per 100 records | Very fast |
| Array sort | ~2ms for 1000 records | Fast algorithm (V8 engine) |
| UI render | Browser native | Out of our control |

### Optimization Techniques Used

1. **One-Time API Call**
   - Cache at constructor level
   - Reused across multiple requests
   - Result: 500ms → 0ms on subsequent calls

2. **Lazy JSON Parsing**
   - Store serialized JSON in cache
   - Parse only when reading specific fields
   - Result: ~10ms for full pipeline vs ~100ms

3. **Efficient Array Operations**
   - Use `filter()` instead of manual loops
   - Use `find()` for single item lookup
   - Result: V8 optimized code paths

4. **Shallow Copy of Array**
   - `[...array]` is faster than `.slice()` for small arrays
   - Result: ~1ms instead of ~2ms

### Memory Usage

With 42 shipment records:
- Each record: ~2-3KB (serialized JSON)
- Total cache: ~100KB
- Acceptable for web browser

With 1000 records:
- Each record: ~2-3KB
- Total cache: ~2-3MB
- Still acceptable, but approaching limits

---

## Error Handling

### Web API Errors

```javascript
async _fetchAllRecords() {
  try {
    let res = await this._context.webAPI.retrieveMultipleRecords(
      "crbff_shipments",
      "?$select=..."
    );
    return (res.entities || []).map(i => ({...}));
  } catch (e) {
    console.error("[ShipmentRecordSource] Error:", e);
    return [];  // Return empty on error
  }
}
```

**Caught:** Network failures, invalid queries, permission issues

### Graceful Degradation

```javascript
async getRecordsData(req, filter) {
  try {
    // Main logic
  } catch (e) {
    console.error("[ShipmentRecordSource] Error:", e);
    return {
      requestId: req.requestId,
      records: [],  // Empty on error
      hasMoreRecords: false
    };
  }
}
```

**Result:** Timeline shows empty results instead of broken UI

---

## Summary: Why This Design?

| Decision | Reason |
|----------|--------|
| **Client-side filtering** | Fast search/filter without repeated API calls |
| **Memoization caching** | Single fetch, reused across multiple searches |
| **Cursor pagination** | Handles filter changes correctly |
| **Constructor-level cache** | Persists across function calls within session |
| **Comprehensive logging** | Production debugging and troubleshooting |
| **Try/catch wrapping** | Graceful error handling |

This design prioritizes **user experience (speed)** and **maintainability (clarity)** over code brevity.

---

**See README.md for quick start and API reference.**
