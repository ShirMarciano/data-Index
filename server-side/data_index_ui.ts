import { Client, Request } from '@pepperi-addons/debug-server'
import { AddonData, CodeJob, PapiClient } from '@pepperi-addons/papi-sdk';
import { CommonMethods } from './CommonMethods';
import { PNSSubscribeHelper } from './PNSSubscribeHelper';

const adalTableName = "data_index";


export async function publish(client: Client, request: Request) {
    var papiClient = CommonMethods.getPapiClient(client);
    var body = request.body;

    var result:any={};
    result.success=true;
    result.resultObject={};

    var uiData = await save_ui_data(client,request);

    if(uiData["RunDateTime"]) // create job to run
    {
        let date: Date = new Date(uiData["RunDateTime"]);  

        var codeJob:CodeJob = {
            Type: "AddonJob",
            CodeJobName: "DataIndex publish job",
            IsScheduled: true,
            CronExpression: `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth()} *`,
            AddonPath: "data_index_ui_helper.js",
            AddonUUID: client.AddonUUID,
            FunctionName: "publish_job"
        };
        codeJob = await papiClient.codeJobs.upsert(codeJob);

    }
    else // run now
    {
        result.resultObject = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index_ui_helper").func("publish_job").post()
    }

}

export async function publish_job(client: Client, request: Request) 
{
    var papiClient = CommonMethods.getPapiClient(client);
    var result:any={};
    result.success=true;
    result.resultObject={};

    try
    {
        var adal_ui_data = getDataIndexUIAdal(papiClient,client);

        var al_needRebuild = await checkIfDataIndexNeedRebuild(papiClient, client, "all_activities",adal_ui_data["all_activities_fields"],result.resultObject);
        var tl_needRebuild = await checkIfDataIndexNeedRebuild(papiClient, client, "transaction_lines",adal_ui_data["transaction_lines_fields"] ,result.resultObject);

        // need to start a rebuild according to the cases

        if(al_needRebuild && tl_needRebuild) // both need rebuild - run full_index_rebuild
        {
            result.resultObject = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index").func("full_index_rebuild").post()
        }
        else if(al_needRebuild) // only all_activities need rebuild
        {
            result.resultObject = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index").func("all_activities_rebuild").post()

        }
        else if(tl_needRebuild) // only transaction_lines need rebuild
        {
            result.resultObject = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index").func("transaction_lines_rebuild").post()
        }

    }        
    catch(e)
    {
        result.success = false;
        result.erroeMessage = e.message;
    }

    if(client["CodeJobUUID"]) // run in a codeJob
    {//delete the codeJob
        await papiClient.codeJobs.delete(client["CodeJobUUID"]);
    }
    
    return result;
}

export async function save_ui_data(client: Client, request: Request) 
{ //save the fields and the run tim of the rebuild
    var papiClient = CommonMethods.getPapiClient(client);

    var uiData =  request.body;

    var ui_adal: AddonData = {
        Key: "meta_data",
        all_activities_fields: uiData["AllActivitieFields"],
        transaction_lines_field: uiData["TransactionLinesFields"],
        RunDateTime:null
    };

    if (uiData["RunTime"]) { // if not set or null -  it is run now

        var parts = uiData["RunTime"].split(':');
        var hour = parseInt(parts[0]);
        var minutes = parseInt(parts[1]);

        let date: Date = new Date();
        if (hour == 0) // if midnight was chosen
        {
            date.setDate(date.getDate() + 1);
        }

        date.setHours(hour);
        date.setMinutes(minutes);
        ui_adal["RunDateTime"] = date.toISOString();
    }

    return await papiClient.addons.data.uuid(client.AddonUUID).table(`${adalTableName}_ui`).upsert(ui_adal);
}

export async function get_ui_data(client: Client, request: Request) 
{//get the saved fields and the progress indicator 

    
    var papiClient = CommonMethods.getPapiClient(client);

    var adal_ui_data = getDataIndexUIAdal(papiClient,client);


    var ui_data = {
        AllActivitieFields : adal_ui_data["all_activities_fields"]?  adal_ui_data["all_activities_fields"] :[],
        TransactionLinesFields: adal_ui_data["transaction_lines_field"] ? adal_ui_data["transaction_lines_field"] :[],
        ProgressData: {}
    }

    if(adal_ui_data["AllActivitieFields"]) // if not exist - it is the first time the get was called  
    {
        if(adal_ui_data["RunDateTime"])
        {// if we have run time - we need to check if it is in the future  and if so - the progress indicator should be the time of the run
            var date = new Date(adal_ui_data["RunDateTime"]);
            var nowDate = new Date();
            if(date > nowDate) // will run in the futur
            {
                var hour = date.getHours() == 0 ? 24 :date.getHours();
                ui_data.ProgressData["RunTime"] = `${hour}:${date.getMinutes()}`;
            }
        }

        if(!ui_data.ProgressData["RunTime"])
        { // it is running now or already run - need to get the rebuild progress

            var allActivitiesPolling = await papiClient.addons.api.uuid(client.AddonUUID).file("data_index").func("all_activities_polling").post()
            var allActivitieProgress = 
            {
                Status : allActivitiesPolling["Status"],
                Precentag: parseInt(allActivitiesPolling["Current"])/parseInt(allActivitiesPolling["Count"])
            }

            var transactionLinesProgress = 
            {
                Status : "InProgress",
                Precentag: 0
            }

            if(allActivitiesPolling["Status"] == "Success")
            {
                var transactionLinesPolling = await papiClient.addons.api.uuid(client.AddonUUID).file("data_index").func("transaction_lines_polling").post()
                transactionLinesProgress = 
                {
                    Status : transactionLinesPolling["Status"],
                    Precentag: parseInt(transactionLinesPolling["Current"])/parseInt(transactionLinesPolling["Count"])
                }

            }
            else if (allActivitiesPolling["Status"] == "Faild")
            {
                ///what to do?
            }



            ui_data.ProgressData["AllActivitieProgress"] = allActivitieProgress;
            ui_data.ProgressData["TransactionLinesProgress"] = transactionLinesProgress;

        }

    }

    return ui_data;

}

export async function handle_remove_fields(client: Client, request: Request) 
{
    var body = request.body;
    var dataIndexType = body["DataIndexType"] 
    return checkAndHandleRemoveOfFieldsCase(client, dataIndexType);
}


async function getDataIndexUIAdal(papiClient: PapiClient,client: Client) 
{
    return await papiClient.addons.data.uuid(client.AddonUUID).table(`${adalTableName}_ui`).key("meta_data");
}

async function checkIfDataIndexNeedRebuild(papiClient: PapiClient, client: Client, dataIndexType: string,uiFields:string[], result: any) 
{
    var di_AdalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).key(dataIndexType).get();
    var exportedFields: string[] = di_AdalRecord["RebuildData"] ? di_AdalRecord["RebuildData"]["FieldsToExport"] : [];

    for (var i = 0; i < uiFields.length; i++) 
    {// if at lease one field from the fields that was saved in the UI is new - this data index type need a rebuild
        if (!exportedFields.includes(uiFields[i])) {
            return true;
        }
    }

    // no new fields - no need a rebuild - check if fields was removed - and if so update the subscriprion and the fields in all places;
    var res = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index_ui_helper").func("handle_remove_fields").post({DataIndexType:dataIndexType})

    result[dataIndexType] = res;

    return false;
}

async function checkAndHandleRemoveOfFieldsCase(client: Client, dataIndexType: string): Promise<void> 
{
    var papiClient = CommonMethods.getPapiClient(client);
    var di_UIAdalRecordecord = await papiClient.addons.data.uuid(client.AddonUUID).table(`$data_index_ui`).key(dataIndexType).get();
    var uiFields = di_UIAdalRecordecord["Fields"] ? di_UIAdalRecordecord["Fields"] : [];
    
    var di_AdalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table("data_index").key(dataIndexType).get();
    var exportedFields :string[] = di_AdalRecord["RebuildData"] ? di_AdalRecord["RebuildData"]["FieldsToExport"] : [];
    
    var newExportedFields = Object.assign([], exportedFields); // clone the exported fields
    for (var j = 0; j < exportedFields.length; j++) 
    {
        var field = exportedFields[j];
        if (!uiFields.includes(field)) 
        {
            var index = newExportedFields.indexOf(field, 0);
            if (index > -1 && checkIfFieldCanBeRemoved(field)) 
            {
                newExportedFields.splice(index, 1); // remove from the clone exported fields the fields that was removed
            }
        }
    }

    if (newExportedFields.length < exportedFields.length) // fields was removed - need to update the exported fields and the subscription
    {
        di_AdalRecord["RebuildData"]["FieldsToExport"] = newExportedFields;
        await papiClient.addons.data.uuid(client.AddonUUID).table(adalTableName).upsert(di_AdalRecord);

        const pnsHelper = new PNSSubscribeHelper(client, dataIndexType);
        await pnsHelper.handleUnsubscribeAndSubscribeToPNS(di_AdalRecord, uiFields);
    }
}

function checkIfFieldCanBeRemoved(field: string){

    // fields that ends with '.InternalID' are probably fields that the exporter added to suport reference fields, we cant remove it because we dont jave a way to know in that point if it was field chosen by the user or added by the exporter
    return !field.endsWith(".InternalID") && field != 'InternalID' && field != "UUID";
}






export async function delete_index(client: Client, request: Request) {

};


