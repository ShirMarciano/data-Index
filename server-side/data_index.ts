import { Client, Request } from '@pepperi-addons/debug-server'
import { AddonData, PapiClient } from '@pepperi-addons/papi-sdk'
import { PNSSubscribeHelper } from "./PNSSubscribeHelper"
import { CommonMethods } from "./CommonMethods"

const adalTableName = "data_index";

export async function rebuild(client: Client, request: Request): Promise<any> {

    var papiClient = CommonMethods.getPapiClient(client);

    var resultObject: {[k: string]: any} = {};
    resultObject.success=true;
    resultObject.resultObject={};

    var body = request.body;
    var dataIndexType = body.Type;
    var fieldsToExport : string[];
    var pnsHelper = new PNSSubscribeHelper(client,dataIndexType);
    fieldsToExport = body.FieldsToExport;

    try
    {
        console.log(`Start ${dataIndexType} rebuild function`);

        //Add defaultFields to fieldToExport
        AddDefaultFieldsByType(dataIndexType, fieldsToExport);

        fieldsToExport = fieldsToExport.filter(CommonMethods.distinct)

        var adalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).key(dataIndexType).get();

        //Unsubscribe old subscription and subscribe to new fields changes
        await pnsHelper.handleUnsubscribeAndSubscribeToPNS(adalRecord, fieldsToExport);

        //Run papi_rebuild
        var rebuildObject = await papiClient.post(`/bulk/data_index/rebuild/${dataIndexType}`,{FieldsToExport:fieldsToExport});

        //Save the rebuild object that is returns from the above run in data_index DADL
        adalRecord["RebuildData"] = rebuildObject;

        //Create a code Job that calles the polling function that run every 5 minutes
        var codeJob = await CreateRebuildPollingCodeJob(adalRecord, papiClient, dataIndexType, client);

        adalRecord["PollingCodeJobUUID"] = codeJob["UUID"];

        //save the ADAL record with the RebuildData and PollingCodeJobUUID
        await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).upsert(adalRecord);

        resultObject.resultObject = rebuildObject;
    }
    catch(e){
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    
    return resultObject
}

export async function polling(client: Client, request: Request): Promise<any> {
    var papiClient = CommonMethods.getPapiClient(client);

    var resultObject: {[k: string]: any} = {};
    resultObject.success=true;
    resultObject.resultObject={};
    var type = request.body.Type;
    try
    {

        //Run papi_rebuild_Poling
        var rebuildObject = await papiClient.post(`/bulk/data_index/rebuild/polling/${type}`);

        //update the rebuildDataObject in the data_index ADAL record
        var adalRecord = await SaveTheRebuildDataObjectInADAL(papiClient, client, type, rebuildObject);

        //Check the status
        if(rebuildObject["Status"] != "InProgress"){
            //if not in progress 
            var codeJobUUID = client["CodeJobUUID"] ? client["CodeJobUUID"] : adalRecord["PollingCodeJobUUID"];

            if(codeJobUUID)
            {//unscheduld the codeJob
                await papiClient.codeJobs.upsert({UUID:codeJobUUID ,IsScheduled:false, CodeJobName:`${type} rebuild polling code job`});
            }

        }
        resultObject.resultObject = rebuildObject;
        
    }
    catch(e){
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    

    return resultObject
}

export async function retry(client: Client, request: Request): Promise<any> {
    var papiClient = CommonMethods.getPapiClient(client);

    var resultObject: {[k: string]: any} = {};
    resultObject.success=true;
    resultObject.resultObject={};
    var dataIndexType = request.body.Type;
    try
    {

        var adalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).key(dataIndexType).get();

        //Run papi_rebuild_retry
        var rebuildObject = await papiClient.post(`/bulk/data_index/rebuild/retry/${dataIndexType}`);

        var codeJobUUID = adalRecord["PollingCodeJobUUID"];

        if(codeJobUUID)
        {//scheduld the codeJob
            await papiClient.codeJobs.upsert({UUID:codeJobUUID ,IsScheduled:true, CodeJobName:`${dataIndexType} rebuild polling code job`});
        }
        resultObject.resultObject = rebuildObject;
        
    }
    catch(e){
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    

    return resultObject
}

async function SaveTheRebuildDataObjectInADAL(papiClient: PapiClient, client: Client, type: any, rebuildObject: Promise<any>, adalRecord? :AddonData) {
    if(!adalRecord){
        adalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).key(type).get();
    }
    adalRecord["RebuildData"] = rebuildObject;
    return await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).upsert(adalRecord);
}

function AddDefaultFieldsByType(type: any, fieldsToExport: string[]) {
    switch (type) {
        case "all_activities":
            fieldsToExport.push("InternalID","UUID", "ActivityTypeID","Type", "Status", "ActionDateTime", "Account.ExternalID");
            break;
        case "transaction_lines":
            fieldsToExport.push("InternalID","UUID","Item.ExternalID", "Transaction.Type", "Transaction.Status", "Transaction.ActionDateTime", "Transaction.Account.ExternalID");
            break;
    }
}

async function CreateRebuildPollingCodeJob(adalRecord, papiClient: PapiClient, dataIndexType: any, client: Client) {
    var codeJobUUID = adalRecord["PollingCodeJobUUID"];
    var codeJob;

    if (codeJobUUID) { // get existing codeJob
        codeJob = await papiClient.codeJobs.uuid(codeJobUUID).find();
    }

    if (codeJob) {
        codeJob = {UUID:codeJobUUID ,IsScheduled:true, CodeJobName:`${dataIndexType} rebuild polling code job`};
    }
    else { //create new polling code job
        codeJob = {
            Type: "AddonJob",
            CodeJobName: `${dataIndexType} rebuild polling code job`,
            IsScheduled: true,
            CronExpression: "*/5 * * * *",
            AddonPath: "data_index.js",
            AddonUUID: client.AddonUUID,
            FunctionName: "polling"
        };
    }
 
    codeJob = await papiClient.codeJobs.upsert(codeJob);
    return codeJob;
}


