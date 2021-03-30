import { AddonData, AddonDataScheme, PapiClient } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server'
import { CommonMethods } from '../CommonMethods';
import fetch from "node-fetch";

export abstract class BasePNSAction {

    client: Client;
    papiClient: PapiClient;
    dataIndexType: string;
    pnsObjects : any[];

    abstract internalExecute(): any;

    constructor(inClient: Client,inDataIndexType: string, inPnsObject : any) {
        this.client = inClient;
        this.papiClient = CommonMethods.getPapiClient(this.client);
        this.dataIndexType = inDataIndexType;
        this.pnsObjects = inPnsObject["Message"]["Document"]["ObjectList"];
    }

    async execute(){   
        return await this.internalExecute();
    }

    public collectUUIDsOfPNSObjects(subscribedFields: string[]):string[] {
        var UUIDs: string[] = [];
        this.pnsObjects.forEach(pnsObject => {

            var updatedFields = pnsObject["UpdatedFields"];

            for (var i = 0; i < updatedFields.length; i++) 
            { 
                //check the fields in pnsObject – if at least one is field we subscribed to (on the SubscribedFields) – save the row UUID on a side list
                if (subscribedFields.includes(updatedFields[i]["FieldID"])) 
                {
                    UUIDs.push(pnsObject["UUID"]);
                    break;
                }
            }
        });

        return UUIDs;
    }

    public async getDataFromApi(UUIDs: string[], fields: string[], apiResuorce : string) {

        var start = new Date().getTime();

        var body = {
            fields: fields.join(',') + ",Hidden",
            UUIDList: UUIDs,
            include_deleted: 1
        };

        var res = await this.papiClient.post(`/${apiResuorce}/search`, body);

        var end = new Date().getTime();
         console.log(`Update data Index - get data from ${apiResuorce} api rows took ${end - start} ms`);

        return res;
    }
    
}