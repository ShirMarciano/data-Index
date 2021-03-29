
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, erroeMessage:{the reason why it is false}}
The error Message is importent! it will be written in the audit log and help the user to understand what happen
*/

import { Client, Request } from '@pepperi-addons/debug-server'
import { AddonDataScheme, PapiClient } from '@pepperi-addons/papi-sdk'

export async function install(client: Client, request: Request): Promise<any> {

    var resultObject: {[k: string]: any} = {};
    resultObject.success=true;
    resultObject.resultObject={};
    try
    {
        var papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });;
        //Create the relevant meta data in the papi-adal
        var res = await papiClient.post("/bulk/data_index/rebuild/install");
        
        //Create the relevant initial meta data in the data_index addon adal
        await createInitialDataIndexTableAdalSchemaAndData("data_index", papiClient, client);
        await createInitialDataIndexTableAdalSchemaAndData("data_index_ui", papiClient, client);
    }
    catch(e)
    {
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    return resultObject
}

async function createInitialDataIndexTableAdalSchemaAndData(tableName: string, papiClient: PapiClient, client: Client) {
    var body: AddonDataScheme = {
        Name: tableName,
        Type: "meta_data"
    };

    //create data_index-adal schema
    await papiClient.addons.data.schemes.post(body);
    papiClient.addons.data.uuid(client.AddonUUID).table(tableName).upsert({ Key: 'all_activities' });
    papiClient.addons.data.uuid(client.AddonUUID).table(tableName).upsert({ Key: 'transaction_lines' });
}

export async function uninstall(client: Client, request: Request): Promise<any> {
    return {success:true,resultObject:{}}
}

export async function upgrade(client: Client, request: Request): Promise<any> {
    return {success:true,resultObject:{}}
}

export async function downgrade(client: Client, request: Request): Promise<any> {
    return {success:true,resultObject:{}}
}


