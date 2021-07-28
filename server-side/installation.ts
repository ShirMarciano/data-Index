
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, erroeMessage:{the reason why it is false}}
The error Message is importent! it will be written in the audit log and help the user to understand what happen
*/

import { Client, Request } from '@pepperi-addons/debug-server'
import { AddonDataScheme, PapiClient } from '@pepperi-addons/papi-sdk'
import jwtDecode from 'jwt-decode';
import MyService from './my.service';

export async function install(client: Client, request: Request): Promise<any> {

    var resultObject: { [k: string]: any } = {};
    resultObject.success = true;
    resultObject.resultObject = {};
    try {
        var papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });;
        //Create the relevant meta data in the papi-adal
        var res = await papiClient.post("/bulk/data_index/rebuild/install");

        //Create the relevant initial meta data in the data_index addon adal
        await createInitialDataIndexTableAdalSchemaAndData(papiClient, client);
        await createInitialDataIndexUISchema(papiClient, client);
        await createIndex(papiClient, client);


    }
    catch (e) {
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    return resultObject
}

async function createInitialDataIndexTableAdalSchemaAndData(papiClient: PapiClient, client: Client) {
    var body: AddonDataScheme = {
        Name: "data_index",
        Type: "meta_data"
    };

    //create data_index-adal schema
    await papiClient.addons.data.schemes.post(body);
    papiClient.addons.data.uuid(client.AddonUUID).table("data_index").upsert({ Key: 'all_activities' });
    papiClient.addons.data.uuid(client.AddonUUID).table("data_index").upsert({ Key: 'transaction_lines' });
}

async function createInitialDataIndexUISchema(papiClient: PapiClient, client: Client) {
    var body: AddonDataScheme = {
        Name: "data_index_ui",
        Type: "meta_data"
    };

    //create data_index-adal schema
    await papiClient.addons.data.schemes.post(body);
    papiClient.addons.data.uuid(client.AddonUUID).table("data_index_ui").upsert({ Key: 'meta_data' });
}

async function createIndex(papiClient: PapiClient, client: Client) {
    const service = new MyService(client);
    var headers = {
        "X-Pepperi-OwnerID": client.AddonUUID,
        "X-Pepperi-SecretKey": client.AddonSecretKey
    }
    const distributorUuid = jwtDecode(client.OAuthAccessToken)['pepperi.distributoruuid'];
    const numberOfShardsFlag = await papiClient.metaData.flags.name('NumberOfShards').get();
    let numberOfShards = numberOfShardsFlag;

    // the flag doesnt exist, the API returns "false".so im putting the default of number of shards (1)
    if (numberOfShardsFlag === false) {
        numberOfShards = 1;
    }
    const body = {
        "Settings": {
            "number_of_shards": numberOfShards,
        },
        "Mapping": {
            "dynamic_templates": [{
                "strings": {
                    "match_mapping_type": "string",
                    "mapping": { "type": "keyword" }
                }
            },
            {
                "decimals": {
                    "match_mapping_type": "double",
                    "mapping": { "type": "double" }
                }
            }
            ],
            "properties": {
                "ElasticSearchType": { "type": "keyword" },
                "ElasticSearchSubType": { "type": "keyword" },
                "UUID": { "type": "keyword" }
            }
        }
    };
    await service.papiClient.post(`/addons/api/00000000-0000-0000-0000-00000e1a571c/internal/create_index?index_name=${distributorUuid}`, body, headers);
}

export async function uninstall(client: Client, request: Request): Promise<any> {

    const service = new MyService(client);

    var resultObject: { [k: string]: any } = {};
    resultObject.success = true;
    resultObject.resultObject = {};
    try {
        var papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });;
        //delete the relevant meta data in the papi-adal
        await papiClient.post("/bulk/data_index/rebuild/uninstall");

        // delete the index
        const distributorUuid = jwtDecode(client.OAuthAccessToken)['pepperi.distributoruuid'];
        var headers = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        }
        await service.papiClient.post(`/addons/api/00000000-0000-0000-0000-00000e1a571c/internal/delete_index?index_name=${distributorUuid}`, null, headers);

    }
    catch (e) {
        resultObject.success = false;
        resultObject.erroeMessage = e.message;
    }
    return resultObject
}

export async function upgrade(client: Client, request: Request): Promise<any> {
    return { success: true, resultObject: {} }
}

export async function downgrade(client: Client, request: Request): Promise<any> {
    return { success: true, resultObject: {} }
}


