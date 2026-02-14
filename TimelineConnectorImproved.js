// Timeline Custom Connector - Improved Example
// This file should be registered as a Timeline record source, not called from form load.
// See https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/custom-connectors-timeline-control

var SampleNamespace = SampleNamespace || {};
(function (SampleNamespace) {
    class VirtualEntitySecondaryRecordSource {
        /**
         * Called by the Timeline control when the record source is initialized.
         * DO NOT call this from form load or ribbon scripts. Register this class as a Timeline record source in the control's configuration.
         * The context parameter contains the current record's id (e.g., AccountId) in context.parameters.tableContext.id
         */
        init(context) {
            console.log("[TimelineConnector] init called", context);
            this.context = context;
            this.svgIconSrcPath = Xrm.Utility.getGlobalContext().getWebResourceUrl("msdyn_cec_Available.svg");
            this.accountId = context?.parameters?.tableContext?.id || null;
            if (!this.accountId) {
                // Fallback: try to get from Xrm.Page if available (legacy)
                try {
                    this.accountId = Xrm.Page && Xrm.Page.data && Xrm.Page.data.entity.getId ? Xrm.Page.data.entity.getId() : null;
                } catch (e) {
                    this.accountId = null;
                }
            }
            console.log("[TimelineConnector] AccountId set to:", this.accountId);
            return Promise.resolve();
        }
        getRecordSourceInfo() {
            console.log("[TimelineConnector] getRecordSourceInfo called");
            return { name: "VirtualEntitySecondaryRecordSource" };
        }
        /**
         * Called by the Timeline control to fetch records for display.
         * This method is NOT called on form load. The Timeline control will call this automatically.
         */
        async getRecordsData(request, filter) {
            console.log("[TimelineConnector] getRecordsData called", { request, filter });
            try {
                if (!this.accountId) {
                    console.error("[TimelineConnector] AccountId not found in context. Timeline connector cannot filter emails.");
                    return { requestId: request.requestId, records: [] };
                }
                let recordsData = await this.fetchAllRecords();
                console.log("[TimelineConnector] Records fetched:", recordsData);
                if (filter && filter.filterData && filter.filterData.length > 0) {
                    recordsData = SampleNamespace.FilterHelper.getRecordsFromSecondaryFilterApplied(recordsData, filter.filterData);
                    console.log("[TimelineConnector] Records after Timeline filter:", recordsData);
                }
                this.orderRecordsData(recordsData, request.isAscending);
                let recordsAfterLastItem = request.lastItem
                    ? this.getRecordsAfterLastItem(recordsData, request.lastItem)
                    : recordsData;
                let recordsDataCounted = request.pageSize > recordsAfterLastItem.length
                    ? recordsAfterLastItem
                    : recordsAfterLastItem.slice(0, request.pageSize);
                const recordResponse = {
                    requestId: request.requestId,
                    records: recordsDataCounted,
                };
                console.log("[TimelineConnector] Returning recordResponse:", recordResponse);
                return recordResponse;
            } catch (err) {
                console.error("[TimelineConnector] Error in getRecordsData:", err);
                return { requestId: request.requestId, records: [] };
            }
        }
        /**
         * Fetches all email records filtered by AccountId and custom optionset value.
         * Called internally by getRecordsData. Uses OData filter for efficiency.
         */
        async fetchAllRecords() {
            console.log("[TimelineConnector] fetchAllRecords called for AccountId:", this.accountId);
            let recordsData = [];
            try {
                if (!this.accountId) return recordsData;
                if (!this.context.webAPI) {
                    console.error("[TimelineConnector] webAPI is undefined!");
                    return recordsData;
                }
                // Use OData filter to get only emails regarding this account and with the correct optionset value
                const filter = `$filter=mrc_methodofcommunication ne 4 and _regardingobjectid_value eq ${this.accountId}`;
                let sampleRawRecords = await this.context.webAPI.retrieveMultipleRecords("email", `?${filter}`);
                console.log("[TimelineConnector] Raw records from webAPI:", sampleRawRecords);
                if (sampleRawRecords && sampleRawRecords.entities && sampleRawRecords.entities.length) {
                    recordsData = this.processRecordsData(sampleRawRecords.entities);
                }
            } catch (err) {
                console.error("[TimelineConnector] Error in fetchAllRecords:", err);
            }
            return recordsData;
        }
        /**
         * Processes raw email records into Timeline record format.
         */
        processRecordsData(rawRecordsData) {
            console.log("[TimelineConnector] processRecordsData called", rawRecordsData);
            let recordsData = [];
            rawRecordsData === null || rawRecordsData === void 0 ? void 0 : rawRecordsData.forEach(element => {
                let recordData = {
                    id: element.activityid,
                    sortDateValue: element.createdon,
                    data: JSON.stringify({
                        id: element.activityid,
                        name: element.sender,
                        airDate: element.subject,
                    })
                };
                recordsData.push(recordData);
            });
            console.log("[TimelineConnector] processRecordsData returning", recordsData);
            return recordsData;
        }

        /**
         * Sorts records by sortDateValue, ascending or descending.
         */
        orderRecordsData(recordsData, isAscending) {
            if (!Array.isArray(recordsData)) return;
            recordsData.sort((a, b) => {
                if (!a.sortDateValue || !b.sortDateValue) return 0;
                const dateA = new Date(a.sortDateValue).getTime();
                const dateB = new Date(b.sortDateValue).getTime();
                return isAscending ? dateA - dateB : dateB - dateA;
            });
        }

        // ...existing code for getFilterDetails, getRecordUX, etc...
        // ...existing code for getFilterDetails, getRecordUX, etc...
    }
    SampleNamespace.VirtualEntitySecondaryRecordSource = VirtualEntitySecondaryRecordSource;
})(SampleNamespace || (SampleNamespace = {}));
