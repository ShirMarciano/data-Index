import { Client } from "@pepperi-addons/debug-server/dist";
import { AddonData, PapiClient } from "@pepperi-addons/papi-sdk";
import { CommonMethods } from "./CommonMethods";
import { PNSSubscribeHelper } from "./PNSSubscribeHelper"


export  class DataIndexActions{

    client: Client;
    papiClient: PapiClient;
    dataIndexType: string;
    tsaRefToApiResource: any;
    private adalTableName = "data_index";

    constructor(inClient: Client,inDataIndexType: string) {
        this.client = inClient;
        this.papiClient = CommonMethods.getPapiClient(this.client);
        this.dataIndexType = inDataIndexType;
    }


    public async rebuild(): Promise<any> {
    
        var resultObject: {[k: string]: any} = {};
        resultObject.success=true;
        resultObject.resultObject={};
    
        var fieldsToExport : string[];
        var pnsHelper = new PNSSubscribeHelper(this.client,this.dataIndexType);
    
        try
        {
            var UIAdalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(`${this.adalTableName}_ui`).key("meta_data").get();
    
            fieldsToExport = UIAdalRecord[`${this.dataIndexType}_fields`];
            console.log(`Start ${this.dataIndexType} rebuild function`);
    
            //Add defaultFields to fieldToExport
            this.addDefaultFieldsByType(fieldsToExport);
    
            fieldsToExport = fieldsToExport.filter(CommonMethods.distinct)
    
            var adalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(this.adalTableName).key(this.dataIndexType).get();
    
            //Unsubscribe old subscription and subscribe to new fields changes
            await pnsHelper.handleUnsubscribeAndSubscribeToPNS(adalRecord, fieldsToExport);
    
            //Run papi_rebuild
            var rebuildObject = await this.papiClient.post(`/bulk/data_index/rebuild/${this.dataIndexType}`,{FieldsToExport:fieldsToExport});
    
            //Save the rebuild object that is returns from the above run in data_index DADL
            adalRecord["RebuildData"] = rebuildObject;
    
            //Create a code Job that calles the polling function that run every 5 minutes
            var codeJob = await this.createRebuildPollingCodeJob(adalRecord);
    
            adalRecord["PollingCodeJobUUID"] = codeJob["UUID"];
    
            //save the ADAL record with the RebuildData and PollingCodeJobUUID
            await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(this.adalTableName).upsert(adalRecord);
    
            resultObject.resultObject = rebuildObject;
        }
        catch(e)
        {
            resultObject.success = false;
            resultObject.erroeMessage = e.message;
        }
        
        return resultObject
    }

    async handleRebuildEndStatus(rebuildData:any)
    {
        console.log(`Data Index ${this.dataIndexType} rebuild ended with status ${rebuildData["Status"]}`)
    }

    async getPollingResults(rebuildData:any) : Promise<any>
    {
        return rebuildData;
    }

    public async polling(): Promise<any> {
    
        var resultObject: {[k: string]: any} = {};
        resultObject.success=true;
        resultObject.resultObject={};
        try
        {
            //Run papi_rebuild_Poling
            var rebuildData = await this.papiClient.post(`/bulk/data_index/rebuild/polling/${this.dataIndexType}`);
    
            //update the rebuildDataObject in the data_index ADAL record
            var adalRecord = await this.saveTheRebuildDataObjectInADAL(rebuildData);
    
            //Check the status
            if(rebuildData["Status"] != "InProgress")
            {
                var codeJobUUID = this.client["CodeJobUUID"] ? this.client["CodeJobUUID"] : adalRecord["PollingCodeJobUUID"];
    
                if(codeJobUUID)
                {//unscheduld the codeJob
                    await this.papiClient.codeJobs.upsert({UUID:codeJobUUID ,IsScheduled:false, CodeJobName:`${this.dataIndexType} rebuild polling code job`});
                }

                await this.handleRebuildEndStatus(rebuildData);
                
            }

            resultObject.resultObject = await this.getPollingResults(rebuildData);
            
        }
        catch(e){
            resultObject.success = false;
            resultObject.erroeMessage = e.message;
        }

        return resultObject
    }

    public async retry(): Promise<any> 
    {
    
        var resultObject: {[k: string]: any} = {};
        resultObject.success=true;
        resultObject.resultObject={};
        try
        {
            var adalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(this.adalTableName).key(this.dataIndexType).get();
    
            //Run papi_rebuild_retry
            var rebuildObject = await this.papiClient.post(`/bulk/data_index/rebuild/retry/${this.dataIndexType}`);
    
            var codeJobUUID = adalRecord["PollingCodeJobUUID"];
    
            if(codeJobUUID)
            {//scheduld the codeJob
                await this.papiClient.codeJobs.upsert({UUID:codeJobUUID ,IsScheduled:true, CodeJobName:`${this.dataIndexType} rebuild polling code job`});
            }
            resultObject.resultObject = rebuildObject;
            
        }
        catch(e)
        {
            resultObject.success = false;
            resultObject.erroeMessage = e.message;
        }
    
        return resultObject
    }
    
    
    async saveTheRebuildDataObjectInADAL(rebuildObject: Promise<any>, adalRecord? :AddonData) {
        if(!adalRecord){
            adalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(this.adalTableName).key(this.dataIndexType).get();
        }

        if(adalRecord["RebuildData"])
        {
            if(!adalRecord["RebuildData"] || // if no rebuild data or the rebuild data is not up to date - update it
            (new Date(adalRecord["RebuildData"]["ModificationDateTime"]) < new Date(rebuildObject["ModificationDateTime"]))){
                adalRecord["RebuildData"] = rebuildObject;
                adalRecord =  await this.papiClient.addons.data.uuid(this.client.AddonUUID).table(this.adalTableName).upsert(adalRecord);
            }
        }
        return adalRecord;
    }
    
     private addDefaultFieldsByType(fieldsToExport: string[]) {
        switch (this.dataIndexType) {
            case "all_activities":
                fieldsToExport.push("InternalID","UUID", "ActivityTypeID", "Status", "ActionDateTime", "Account.ExternalID");
                break;
            case "transaction_lines":
                fieldsToExport.push("InternalID","UUID","Item.ExternalID", "Transaction.Status", "Transaction.ActionDateTime", "Transaction.Account.ExternalID","Transaction.ActivityTypeID");
                break;
        }
    }
    
    private async createRebuildPollingCodeJob(adalRecord:any) {
        var codeJobUUID = adalRecord["PollingCodeJobUUID"];
        var codeJob;
    
        if (codeJobUUID) { 
            // get existing codeJob
            codeJob = await this.papiClient.codeJobs.uuid(codeJobUUID).find();
        }
        var functionName = this.getPollingFunctionName();
        var codeJobName = `${this.dataIndexType} rebuild polling code job`;
        if (codeJob["UUID"]) 
        {//unschedule existing code job
            codeJob = await this.papiClient.codeJobs.upsert({UUID:codeJobUUID,FunctionName:functionName ,IsScheduled:true, CodeJobName:codeJobName});
        }
        else 
        { //create new polling code job
            codeJob = {
                Type: "AddonJob",
                CodeJobName: codeJobName,
                IsScheduled: true,
                CronExpression: "*/5 * * * *",
                AddonPath: "data_index.js",
                AddonUUID: this.client.AddonUUID,
                FunctionName: functionName
            };
            codeJob = await this.papiClient.codeJobs.upsert(codeJob);
        }
        return codeJob;
    }

    getPollingFunctionName()
    {
        return `${this.dataIndexType}_polling`;
    }


}
