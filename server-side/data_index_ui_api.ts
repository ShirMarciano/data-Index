import { Client, Request } from '@pepperi-addons/debug-server'
import { AddonData, ApiFieldObject, CodeJob, PapiClient } from '@pepperi-addons/papi-sdk';
import { CommonMethods } from './CommonMethods';
import { PNSSubscribeHelper } from './PNSSubscribeHelper';

const adalTableName = "data_index";


/***************              Get UI DATA           *****************/

export async function get_ui_data(client: Client, request: Request) {//get the saved fields and the progress indicator 

    var papiClient = CommonMethods.getPapiClient(client);

    var UI_adalRecord = await CommonMethods.getDataIndexUIAdalRecord(papiClient,client);

    var ui_data = {
        Fields: await getFields(papiClient), //the fields for the dropdowns and the defaultFields
        all_activities_saved_fields : UI_adalRecord["all_activities_fields"]?  UI_adalRecord["all_activities_fields"] :[],
        transaction_lines_saved_fields: UI_adalRecord["transaction_lines_fields"] ? UI_adalRecord["transaction_lines_fields"] :[],
        ProgressData: {}
    }

    if(UI_adalRecord["all_activities_fields"]) // if not exist - it is the first time the get was called  
    {
        if(UI_adalRecord["RunDateTime"])
        {// if we have run time - we need to check if it is in the future  and if so - the progress indicator should be the time of the run
            var date = new Date(UI_adalRecord["RunDateTime"]);
            var nowDate = new Date();
            if(date > nowDate) // will run in the futur
            {
                var hour = date.getHours() == 0 ? 24 :date.getHours();
                var minutes = date.getMinutes() == 0 ? '00' :date.getHours()+'';

                ui_data.ProgressData["RunTime"] = `${hour}:${minutes}`;
            }
        }
        if(!ui_data.ProgressData["RunTime"])
        { // it is running now or already run - need to get the rebuild progress
            await getRebuildProgressData(papiClient, client, ui_data);

        }

    }

    return ui_data;

}

async function getFields(papiClient: PapiClient) { // get the needed fields for the drop downs
    
    var types = ["Transaction","Activity","Account","transaction_lines","Item",]

    var typeToFields:any = { }

    for(var t in types){
        var objectType = types[t];
        var fieldsObjects :{key:string,value:string}[] = [];
        var resource = CommonMethods.getAPiResourcesByObjectTypeName(types[t])[0];

        var fields = await CommonMethods.getTypesFields(papiClient,resource);

        fields.forEach(fieldObj => {
            if (checkIfFieldIsValid(fieldObj,objectType)) //GuidReferenceType
            {
                fieldsObjects.push({key:fieldObj.FieldID, value:fieldObj.Label});
            }
        });
        
        //fieldsObjects = CommonMethods.getDistinctFieldsObj(fieldsObjects)

        typeToFields[objectType] = fieldsObjects;
    }

    var typeToDefaultFields = {
        "all_activities": CommonMethods.addDefaultFieldsByType([],"all_activities"),
        "transaction_lines": CommonMethods.addDefaultFieldsByType([],"transaction_lines")
    }

    return { DataIndexTypeDefaultFields: typeToDefaultFields,
            TypesFields: typeToFields
        };

}

function checkIfFieldIsValid(field:ApiFieldObject,objectType:string)
{
    
    var valid = true;
    if(field.FieldID.startsWith("TSA"))
    {
        valid = field.UIType.ID != 48 && field.UIType.ID != 49; // not reference TSA and not buttomn TSA
    }
    else
    {
        valid = !isInIgnoreList(field.FieldID);
    }

    // reference fields doesnt come in meta data fields api call so no if case on it
    return valid;

}

function isInIgnoreList(field:string):boolean{
    //calculated fields that are not supported
    var fieldsToIgnoe = 
        ['BillToAddress',
        'BillToCity',
        'BillToCountry',
        'BillToCountryIso',
        'BillToFax',
        'BillToName',
        'BillToPhone',
        'BillToState',
        'BillToStateIso',
        'BillToStreet',
        'BillToZipCode',
        'Branch',
        'ContactPersonList',
        'ContactPersonName',
        'CreatorExternalID',
        'Currency',
        'CurrencySymbol',
        'ShipToAddress',
        'ShipToCity',
        'ShipToCountry',
        'ShipToCountryIso',
        'ShipToExternalID',
        'ShipToFax',
        'ShipToName',
        'ShipToPhone',
        'ShipToState',
        'ShipToStateIso',
        'ShipToStreet',
        'ShipToZipCode',
        'Signature',
        'TotalsBox',
        'Type', // problematic field - changing ATD name will cause massive update in elastic and also e have problem to get update in it on PNS
        'ModificationDateTime',
        'AccountExternalID',
        'ItemExternalID',
        'ColorImage',
        'Image',
        'ItemInStockQuantity',
        'LastOrderItemDate',
        'LastOrderItemPrice',
        'LastOrderItemQuantity',
        'ParentImage',
        'SetName',
        'SpecialOfferLeadingOrderPortfolioItemUUID',
        'UOM',
        'Archive'
    ]

    return fieldsToIgnoe.includes(field);
}


async function getRebuildProgressData(papiClient: PapiClient, client: Client, ui_data: any) {

    var allActivitiesPolling = await papiClient.addons.api.uuid(client.AddonUUID).file("data_index").func("all_activities_polling").post();
    var allActivitieProgress = {
        Status: allActivitiesPolling["Status"],
        Precentag:  Math.round((parseInt(allActivitiesPolling["Current"]) / parseInt(allActivitiesPolling["Count"])) * 100)
    };

    var transactionLinesProgress = {
        Status: "",
        Precentag: NaN
    };

    if (allActivitiesPolling["Status"] == "Success") {
        var transactionLinesPolling = await papiClient.post(`/bulk/data_index/rebuild/polling/transaction_lines`); // get data from papi adal - (it is the most updates and we dont want to overwrite the DI adal rebuild data)

            if(new Date(transactionLinesPolling["StartDateTime"]) > new Date(allActivitiesPolling["StartDateTime"]))
            {// transaction lines rebuild that run or is running started after all activities finished - poll the transaction lines itself
                transactionLinesPolling = await papiClient.addons.api.sync().uuid(client.AddonUUID).file("data_index").func("transaction_lines_polling").post();
            }
            else
            { // transaction lines rebuild didnt started yet (full data index rebuild - takes time to the code job of the tl to work) 
              //or didnt run at all (in case of just all activities rebuild) dont poll- take data from adal.
              // in case of full rebuild (all activities and then transaction lines) I am puting in adal temp data until the transction lines rebuild begin
              // so we will not show old transaction lines rebuild resuls - the reason is that in this point (when getting progress data) we cant know 
              //if it was full ondex rebuild or partial rebuild (only one type rebuild).
                var tlAdalRecord = await await CommonMethods.getDataIndexTypeAdalRecord(papiClient,client,"transaction_lines");
                transactionLinesPolling = tlAdalRecord["RebuildData"];
            }

            transactionLinesProgress = {
                Status: transactionLinesPolling["Status"],
                Precentag: Math.round((parseInt(transactionLinesPolling["Current"]) / parseInt(transactionLinesPolling["Count"])) * 100)
            };
        
        ui_data.ProgressData["Status"] = transactionLinesPolling["Status"] != "" ? transactionLinesPolling["Status"] : "InProgress";
        ui_data.ProgressData["Message"] = transactionLinesPolling["Message"];

    }

    else {
        ui_data.ProgressData["Status"] = allActivitiesPolling["Status"];
        ui_data.ProgressData["Message"] = allActivitiesPolling["Message"];
    }

    ui_data.ProgressData["all_activities_progress"] = allActivitieProgress;
    ui_data.ProgressData["transaction_lines_progress"] = transactionLinesProgress;
}

/***************************************************************************/


/***************             Delete all Index             *****************/

export async function delete_index(client: Client, request: Request) {

    var papiClient = CommonMethods.getPapiClient(client);

    var result:any={};
    result.success=true;
    result.resultObject={};

    var res = await papiClient.post("/bulk/data_index/rebuild/install");//init papi adal record 

    await initRebuildDataADALRecord(papiClient, client,"all_activities");
    await initRebuildDataADALRecord(papiClient, client,"transaction_lines");

    return await papiClient.post(`/elasticsearch/clear/data_index`);
}

async function initRebuildDataADALRecord(papiClient: PapiClient, client: Client, dataIndexType:string) {

    var adalRecord = await CommonMethods.getDataIndexTypeAdalRecord(papiClient,client,dataIndexType);

    var rebuildData = adalRecord["RebuildData"];

    if (rebuildData) 
    {
        rebuildData["FieldsToExport"] = [];
        rebuildData["Status"] = "";
        rebuildData["Count"] = NaN;
        rebuildData["Current"] = NaN;
        rebuildData["LastInternalID"] = 0;
        adalRecord["RebuildData"] = rebuildData;

        var res = await CommonMethods.saveDataIndexTypeAdalRecord(papiClient,client,adalRecord);
        console.log(`Init rebuild data in adal recored for data index type ${dataIndexType} results: ${JSON.stringify(res)}`)
    }
}


/****************************************************************************/


/***************                    Publish                 *****************/


export async function publish(client: Client, request: Request) {
    var papiClient = CommonMethods.getPapiClient(client);

    var result:any={};
    result.success=true;
    result.resultObject={};

    var UI_adalRecord = await save_ui_data(client,request);

    if(UI_adalRecord["RunDateTime"]) // create job to run
    {
        let date: Date = new Date(UI_adalRecord["RunDateTime"]);  
        var cronExpression = `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth()} *`;
        var codeJob:CodeJob;
        var codeJobs = await papiClient.codeJobs.find({where:"CodeJobName='DataIndex publish job'", include_deleted:false});

        if(codeJobs && codeJobs.length > 0) // update existing code job cron
        {
            codeJob = codeJobs[0];
            codeJob.CronExpression = cronExpression
        }
        else
        {
            codeJob = {
                Type: "AddonJob",
                CodeJobName: "DataIndex publish job",
                IsScheduled: true,
                CronExpression: cronExpression,
                AddonPath: "data_index_ui_api.js",
                AddonUUID: client.AddonUUID,
                FunctionName: "publish_job"
            };
        }
        codeJob = await papiClient.codeJobs.upsert(codeJob);
    }
    else // run now
    {
        result.resultObject = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index_ui_api").func("publish_job").post()
    }

    return result;
}

export async function publish_job(client: Client, request: Request) {
    var papiClient = CommonMethods.getPapiClient(client);
    var result:any={};
    result.success=true;
    result.resultObject={};

    try
    {
        var adal_ui_data = await CommonMethods.getDataIndexUIAdalRecord(papiClient,client);

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

async function checkIfDataIndexNeedRebuild(papiClient: PapiClient, client: Client, dataIndexType: string,uiFields:string[], result: any) 
{
    var di_AdalRecord = await CommonMethods.getDataIndexTypeAdalRecord(papiClient,client,dataIndexType);
    var rebuildData =  di_AdalRecord["RebuildData"];
    if(rebuildData)
    {
        if(rebuildData["Status"] == "Failure")
            return true;
        
        var exportedFields: string[] = rebuildData["FieldsToExport"];

        for (var i = 0; i < uiFields.length; i++) 
        {// if at lease one field from the fields that was saved in the UI is new - this data index type need a rebuild - no need to check the rest
            if (!exportedFields.includes(uiFields[i])) 
            {
                return true;
            }
        }
        var body:any = {DataIndexType:dataIndexType};
      
        // no new fields - no need a rebuild - check if fields was removed - and if so update the subscriprion and the fields in all places;
        var res = await papiClient.addons.api.uuid(client.AddonUUID).async().file("data_index_ui_api").func("handle_remove_fields").post(undefined,body)
    
        result[dataIndexType] = res;
        return false;
    }

    return true;
}

export async function save_ui_data(client: Client, request: Request) { //save the fields and the run time (if given) of the rebuild
    var papiClient = CommonMethods.getPapiClient(client);

    var uiData =  request.body;
    var all_activities_fields = CommonMethods.addDefaultFieldsByType(uiData["all_activities_fields"],"all_activities");
    var transaction_lines_fields = CommonMethods.addDefaultFieldsByType(uiData["transaction_lines_fields"],"transaction_lines");

    var ui_adalRecord: AddonData = {
        Key: "meta_data",
        all_activities_fields: all_activities_fields.filter(CommonMethods.distinct),
        transaction_lines_fields: transaction_lines_fields.filter(CommonMethods.distinct),
        RunDateTime:null
    };

    if (uiData["RunTime"]) { // if not set or null - means run now

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
        ui_adalRecord.RunDateTime = date.toISOString();
    }

    return await CommonMethods.saveDataIndexUIAdalRecord(papiClient,client, ui_adalRecord) ;
}

export async function handle_remove_fields(client: Client, request: Request) {
    var body = request.body;
    var dataIndexType = body["DataIndexType"] 
    return checkAndHandleRemoveOfFieldsCase(client, dataIndexType);
}

async function checkAndHandleRemoveOfFieldsCase(client: Client, dataIndexType: string): Promise<void> 
{
    var papiClient = CommonMethods.getPapiClient(client);
    var UI_AdalRecord = await CommonMethods.getDataIndexUIAdalRecord(papiClient,client);
    var uiFields = UI_AdalRecord[`${dataIndexType}_fields`] ? UI_AdalRecord[`${dataIndexType}_fields`] : [];
    
    var adalRecord = await await CommonMethods.getDataIndexTypeAdalRecord(papiClient,client,dataIndexType)

    var exportedFields :string[] = adalRecord["RebuildData"] ? adalRecord["RebuildData"]["FieldsToExport"] : [];
    
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
        adalRecord["RebuildData"]["FieldsToExport"] = newExportedFields;

        await await CommonMethods.saveDataIndexTypeAdalRecord(papiClient,client,adalRecord);

        const pnsHelper = new PNSSubscribeHelper(client, dataIndexType);
        await pnsHelper.handleUnsubscribeAndSubscribeToPNS(adalRecord, uiFields);
    }
}

function checkIfFieldCanBeRemoved(field: string){

    // fields that ends with '.InternalID' are probably fields that the exporter added to suport reference fields, we cant remove it because we dont jave a way to know in that point if it was field chosen by the user or added by the exporter
    return !field.endsWith(".InternalID") && field != 'InternalID' && field != "UUID";
}


/*********************************************************************************/









