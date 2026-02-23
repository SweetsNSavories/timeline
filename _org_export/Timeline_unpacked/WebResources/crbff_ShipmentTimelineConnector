var SampleNamespace = SampleNamespace || {};
SampleNamespace.ShipmentRecordSource = class {
  constructor() { this._moduleName = "ShipmentConnector"; }
  init(ctx) { this._context = ctx; return Promise.resolve(); }
  
  async getRecordsData(req, filter) {
    let q = `?$select=crbff_title,crbff_field1,crbff_field2,crbff_field3,crbff_field4,crbff_externalprimarykey&$top=${req.pageSize || 10}`;
    let p = [];
    
    // Handle search keyword from search bar
    if (req.searchKeyword) {
      let s = String(req.searchKeyword || "").replace(/'/g, "''");
      p.push(`or(contains(crbff_title, '${s}'), or(contains(crbff_field3, '${s}'), contains(crbff_field4, '${s}')))`);
    }
    
    // Handle filter selections from dropdowns
    if (filter?.filterData) filter.filterData.forEach(g => g.options.forEach(o => o.isSelected && p.push(`crbff_field1 eq '${o.value}'`)));
    
    if (p.length > 0) q += `&$filter=${p.join(' and ')}`;
    try {
      let res = await this._context.webAPI.retrieveMultipleRecords("crbff_shipments", q);
      let records = (res.entities || []).map(i => ({ id: i.crbff_shipmentsid, sortDateValue: new Date().toISOString(), data: JSON.stringify(i) }));
      return { requestId: req.requestId, records: records, hasMoreRecords: false };
    } catch (e) { return { records: [] }; }
  }
  
  getFilterDetails() { return Promise.resolve([{ name: "ShipmentStatus", label: "Status", type: "MultiSelect", isExpanded: true, options: [{ value: "Shipped", label: "Shipped" }, { value: "Delivered", label: "Delivered" }] }]); }
  
  getRecordUX(data) {
    let i = JSON.parse(data.data), f = this._context.factory;
    return { 
      id: data.id, moduleName: this._moduleName, sortDateValue: data.sortDateValue,
      searchText: `${i.crbff_title} ${i.crbff_field1} ${i.crbff_field3} ${i.crbff_field4}`, // FIXED: Enables Timeline Client-Side Search
      header: { components: [f.createElement("Label", { key: "h", style: { fontWeight: "bold" } }, i.crbff_title || "No Title")] },
      body: { components: [f.createElement("Label", { key: "b" }, `Status: ${i.crbff_field1} | To: ${i.crbff_field3}`)] },
      footer: { components: [f.createElement("Label", { key: "f" }, `Tracking: ${i.crbff_field4}`)] } 
    };
  }
};