import { Client, Request } from '@pepperi-addons/debug-server'
import { CommonMethods } from './CommonMethods';

export async function all_activities_fields(client: Client, request: Request): Promise<any> {
    return await getDataIndexFields(client, "all_activities");
}

export async function transaction_lines_fields(client: Client, request: Request): Promise<any> {
    return await getDataIndexFields(client, "transaction_lines");
}


async function getDataIndexFields(client: Client, dataIndexType: string) {
    var papiClient = CommonMethods.getPapiClient(client);
    // need to take the fields we saved from the UI and the exported field because 
    //it can be a case where the build is now immidialty and a code job will do it
    // so we want to get the fields we save in the last time 
    var adalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table("data_index_ui").key(dataIndexType).get(); 

    var fields = [];
    if (adalRecord["Fields"]) {
        fields = adalRecord["Fields"];
    }

    return { Fields: fields };
}

async function saveDataIndexFields(client: Client, dataIndexType: string, fields:string[]) {
    var papiClient = CommonMethods.getPapiClient(client);

    var adalRecord = await papiClient.addons.data.uuid(client.AddonUUID).table("data_index_ui").key(dataIndexType).get(); 

    adalRecord["Fields"] = fields;

    return await papiClient.addons.data.uuid(client.AddonUUID).table("data_index_ui").upsert(adalRecord);
}

