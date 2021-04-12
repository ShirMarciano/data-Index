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
    var ui_adalRecord = await CommonMethods.getDataIndexUIAdalRecord(papiClient,client);
    
    var fields = [];
    if (ui_adalRecord[`${dataIndexType}_fields`]) {
        fields = ui_adalRecord[`${dataIndexType}_fields`];
    }

    return { Fields: fields };
}
