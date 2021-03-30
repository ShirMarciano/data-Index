import { Client } from "@pepperi-addons/debug-server/dist";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import { CommonMethods } from "./CommonMethods";

export class PNSSubscribeHelper{

    client: Client;
    papiClient: PapiClient;
    dataIndexType: string;
    tsaRefToApiResource: any;

    constructor(inClient: Client,inDataIndexType: string) {
        this.client = inClient;
        this.papiClient = CommonMethods.getPapiClient(this.client);
        this.dataIndexType = inDataIndexType;
    }


    async  handleUnsubscribeAndSubscribeToPNS(adalRecord: any, fieldsToExport: string[]) {
        var PNSSubscribeData = adalRecord["PNSSubscribeData"];
    
        await this.unsubscribePreviousSubscriptions(PNSSubscribeData); // from both IndexType and reference type old subscriptions
    
        //create the PNSSubscribeData data tree
        PNSSubscribeData = await this.getTypesSubscribedDataObject(fieldsToExport);
    
        //Save the updated PNSSubscribeData in ADAL
        adalRecord["PNSSubscribeData"] = PNSSubscribeData;
        await this.papiClient.addons.data.uuid(this.client.AddonUUID).table("data_index").upsert(adalRecord);
    
        //subscribe to PNS
        await this.subscribeToPNS(PNSSubscribeData); // subscribe to both IndexType and reference type changes
    }

    /* Subscribe and unsubscibe private methods*/ 

    private async subscribeToPNS(PNSSubscribeData: any) {
        await this.subscribeIndexType(PNSSubscribeData["IndexType"]);

        await this.subscribeReferenceTypes(PNSSubscribeData["ReferenceTypes"]);
    }

    private async subscribeIndexType(indexTypeSubscribeData: any) {
        if(indexTypeSubscribeData){
            var headers = {
                "X-Pepperi-SecretKey": this.client.AddonSecretKey,
                "X-Pepperi-OwnerID": this.client.AddonUUID
            };
            var subscribeDetails = indexTypeSubscribeData["SubscribeDetails"];
            var subscribeURL = "/notifications/subscriptions";

            //subscribe for insert of index type rows
            var body = {
                FilterPolicy: {
                        Resource: this.dataIndexType == "all_activities"? ["actvities","transactions"] : [this.dataIndexType],
                        Type:["data"],
                        UpdatedFields:indexTypeSubscribeData["Fields"],
                        ActionType:["insert"]
                },
                AddonPath:subscribeDetails["Insert"]["AddonPath"],
                FunctionName:subscribeDetails["Insert"]["FunctionName"]

            }
            await this.papiClient.post(subscribeURL, body, headers);

            //subscribe for update of index type data
            body.FilterPolicy.ActionType = ["update"];
            body.AddonPath=subscribeDetails["Update"]["AddonPath"],
            body.FunctionName=subscribeDetails["Update"]["FunctionName"]

            await this.papiClient.post(subscribeURL, body, headers);
        }
    }

    private async subscribeReferenceTypes(referenceTypesSubscribeData: any) {

        var headers = {
            "X-Pepperi-SecretKey": this.client.AddonSecretKey,
            "X-Pepperi-OwnerID": this.client.AddonUUID
        };
        var subscribeURL = "/notifications/subscriptions";

        if(referenceTypesSubscribeData)
        {
            for (var apiResourceType in referenceTypesSubscribeData) 
            {
                var apiTypeData = referenceTypesSubscribeData[apiResourceType];
                var fieldsData = apiTypeData["FieldsData"];
                var subscribeDetails = apiTypeData["SubscribeDetails"];

                //collect all the fields we need to sybscribe to on the api resource type 
                var fieldsToSubscribe = CommonMethods.collectFieldsToSubscribeToOnTheApiResource(fieldsData);

                //subscribe for update of reference type rows
                var body = {
                    FilterPolicy: {
                            Resource: [apiResourceType],
                            Type:["data"],
                            UpdatedFields:fieldsToSubscribe,
                            ActionType:["update"]
                    },
                    AddonPath:subscribeDetails["AddonPath"],
                    FunctionName:subscribeDetails["FunctionName"]
                }
                await this.papiClient.post(subscribeURL, body, headers);
            } 
        }
    }

    private async unsubscribePreviousSubscriptions(PNSSubscribeData: any) {
        if (PNSSubscribeData) { 

            await this.unsubscribeIndexType(PNSSubscribeData["IndexType"]);

            await this.unsubscribeReferenceTypes(PNSSubscribeData["ReferenceTypes"]);
        }
    }

    private async unsubscribeIndexType(indexTypeSubscribeData: any) {
        if(indexTypeSubscribeData){
            var headers = {
                "X-Pepperi-SecretKey": this.client.AddonSecretKey,
                "X-Pepperi-OwnerID": this.client.AddonUUID
            };
            var subscribeDetails = indexTypeSubscribeData["SubscribeDetails"];
            var unSubscribeURL = "/notifications/unsubscriptions";
            await this.papiClient.post(unSubscribeURL, subscribeDetails["Insert"], headers);
            await this.papiClient.post(unSubscribeURL, subscribeDetails["Update"], headers);
            
        }
    } 

    private async unsubscribeReferenceTypes(referenceSubscribeData: any) {
        if(referenceSubscribeData){
            var headers = {
                "X-Pepperi-SecretKey": this.client.AddonSecretKey,
                "X-Pepperi-OwnerID": this.client.AddonUUID
            };

            for(var refType in referenceSubscribeData)
            {
                var apiTypeData = referenceSubscribeData[refType];
                var subscribeDetails = apiTypeData["SubscribeDetails"];
                var unSubscribeURL = "/notifications/unsubscriptions";
                await this.papiClient.post(unSubscribeURL, subscribeDetails, headers);
            }
        }
    } 

    /* End subscribe and unsubscibe private methods */ 

    async getTypesSubscribedDataObject(fieldstoExport : string[]) {

        this.tsaRefToApiResource = await this.getRefTSAToApiResourceDictionary();
        var fields:string[] = [];
        var PNSSubscribeData = {
            IndexType:{
                Fields: fields,
                SubscribeDetails:{
                    Insert:{
                        AddonPath:`${this.dataIndexType}_pns`,
                        FunctionName:"insert"
                    },
                    Update:{
                        AddonPath:`${this.dataIndexType}_pns`,
                        FunctionName:"update"
                    }
                
                } 
            },
            ReferenceTypes:{}
        };

        for (var i=0;i < fieldstoExport.length; i++)
        {
            var field = fieldstoExport[i];
            if(field.includes("."))//reference field
            {
                this.handleReferenceField(field, PNSSubscribeData);
            }
            else // field on the index type itself
            {
                PNSSubscribeData.IndexType.Fields.push(field);
            }
        }

        PNSSubscribeData.IndexType.Fields = PNSSubscribeData.IndexType.Fields.filter(CommonMethods.distinct);

        return PNSSubscribeData;
    }

    /* getTypesSubscribedDataObject prinate methodes*/

    private handleReferenceField(field: string, PNSSubscribeData: any) {
        var fieldParts = field.split(".");
        var fieldPrefix = "";
        for (let i = 0; i < fieldParts.length; i++) {

            if(i == 0)  // first level reference type (if the api name was 'Transaction.Account.Name' then we are in the 'Transaction')
            {
                this.handleFirstLevelReferenceField(fieldParts, i, PNSSubscribeData);
            }
            else if (i == fieldParts.length - 1) // End reference field (if the api name was 'Transaction.Account.Name' then we are in the 'Name')
            {
                this.HandleEndReferenceField(fieldParts, i, PNSSubscribeData, fieldPrefix);
            }
            else // next level field  (if the api name was 'Transaction.Account.Name' then we are in the 'Account')
            {
                this.handleNextLevelReferenceField(fieldParts, i, fieldPrefix, PNSSubscribeData);
            }

            fieldPrefix+= fieldPrefix? `.${fieldParts[i]}` : fieldParts[i];
        }
    }

    private handleFirstLevelReferenceField(fieldParts: string[], i: number, PNSSubscribeData: any) {
        //fields on the data index itself
        if (fieldParts[i].startsWith("TSA")) //e.g TSARefActivity.ActionDateTime, we are on 'TSARefActivity'
        {// TSA reference is GUID value, so we need to subscribe for the change of the TSA itself and not InternalID as in regular reference

            PNSSubscribeData["IndexType"]["Fields"].push(fieldParts[i]);
        }
        else 
        { //ReferenceOnTheIndexType - e.g Transaction.InternalID/Item.InternalID on transaction_lines, Account.InternalID on all_activities
            PNSSubscribeData["IndexType"]["Fields"].push(`${fieldParts[0]}WrntyID`);
        }
    }

    private HandleEndReferenceField(fieldParts: string[], i: number, PNSSubscribeData: any, fieldPrefix: string) 
    {//End reference field is the last part of the reference ful field - e.g Transaction.Account.Name we are on Name part
        var referenceObjectTypeName;
        var apiResources:string[] = [];
        var fieldData
        
        if (fieldParts[i] == "InternalID" && !fieldParts[i - 1].startsWith("TSA")) 
        {
            if (i == 1)
            {//Reference on the dataIndexType - e.g Transaction.InternalID/Item.InternalID on transaction_lines, Account.InternalID on all_activities
                PNSSubscribeData["IndexType"]["Fields"].push(`${fieldParts[0]}WrntyID`);
            }
            else 
            { //Reference on reference: e.g Transaction.Account.InternalID on transaction_lines, Agent.Profile.InternalID on all_activities
                var referenceType = fieldParts[i - 1]; // if the field is Transaction.Account.InternalID - so it will be 'Account'
                referenceObjectTypeName = fieldParts[i - 2]; // if the field is Transaction.Account.InternalID - so it will be 'Transaction' 
                apiResources = CommonMethods.getAPiResourcesByObjectTypeName(referenceObjectTypeName);
                fieldData = { FieldName: `${referenceType}WrntyID`, RefPrefix: fieldPrefix };
            }
        }
        else 
        {
            referenceObjectTypeName = fieldParts[i - 1];
            fieldData = { FieldName: fieldParts[i] };

            if (referenceObjectTypeName == "Parent") 
            { 
                if (i > 1) 
                { 
                    if (fieldParts[i - 2].startsWith("TSA")) 
                    { 
                        //e.g TSARefAccount.Parent.Name o fieldParts[i - 2] will be 'TSARefAccount'
                        apiResources = [this.tsaRefToApiResource[fieldParts[i - 2]]]; 
                    }
                    else 
                    { 
                        //e.g Account.Parent.Name so fieldParts[i - 2] will be 'Account'
                        referenceObjectTypeName = `${fieldParts[i - 2]}.Parent`; 
                        apiResources = CommonMethods.getAPiResourcesByObjectTypeName(referenceObjectTypeName);
                    }
                }
                else 
                { ////e.g parent.Name
                    apiResources = [this.dataIndexType];
                }
            }
            else if (referenceObjectTypeName.startsWith("TSA")) 
            {//TSARefAccount.Name we ore on Name and referenceObjectTypeName (fieldParts[i - 1]) is 'TSARefAccount'
                apiResources = [this.tsaRefToApiResource[referenceObjectTypeName]];
            }
            else
            {//Transaction.Account.Name we ore on Name and referenceObjectTypeName (fieldParts[i - 1]) is 'Account'
                apiResources = CommonMethods.getAPiResourcesByObjectTypeName(referenceObjectTypeName);
            }
        }
        this.insertReferenceFieldToSubscribeDataObj(apiResources, PNSSubscribeData, fieldPrefix, fieldData);
    }

    private handleNextLevelReferenceField(fieldParts: string[], i: number, fieldPrefix: string, PNSSubscribeData: any) {
        //Next level it means that we are in second (or above) reference level that it is not the end fiels, e.g Transaction.Account.Name we are on Account part
        var apiResources: string[] = [];
        var fieldData;
        var prevType = fieldParts[i-1];

        apiResources = CommonMethods.getAPiResourcesByObjectTypeName(prevType);

        if (fieldParts[i].startsWith("TSA")) 
        {//e.g Transaction.TSARefAccount.Name - we are on the TSARefAccount part 
        // in case of TSA referencee we need to subscribe to the TSA itself and not the InternalID 
        //because the TSA ref value is Guid and we will get update event on the Guid
            fieldData = {FieldName: fieldParts[i], RefPrefix: `${fieldPrefix}.${fieldParts[i]}`};
        }
        else //need to subscribe to the change of the reference io the prev object - to the InternalID of the reference on the prev reference level obj
        {
            var referenceTypeName = fieldParts[i];

            if (referenceTypeName == "Parent") 
            { 
                if (prevType.startsWith("TSA")) 
                {//e.g TSARefAccount.Parent.Name - we are on Parent part
                    apiResources = [this.tsaRefToApiResource[prevType]];
                }
                else //e.g Transaction.Account.Parent.Name - we are on Parent part
                {
                    apiResources = CommonMethods.getAPiResourcesByObjectTypeName(`${prevType}.Parent`);
                }
            }

            fieldData = { FieldName: `${referenceTypeName}WrntyID`, RefPrefix: `${fieldPrefix}.${referenceTypeName}` };
        }
        this.insertReferenceFieldToSubscribeDataObj(apiResources, PNSSubscribeData, fieldPrefix, fieldData);
    }

    private insertReferenceFieldToSubscribeDataObj(apiResources: string[], PNSSubscribeData: any, fieldPrefix: string, fieldData: any) {

        if(apiResources.length > 0){
            apiResources.forEach(apiResource => {

                if (PNSSubscribeData["ReferenceTypes"][apiResource]) 
                {
                    if (PNSSubscribeData["ReferenceTypes"][apiResource]["FieldsData"][fieldPrefix]) 
                    {
                        PNSSubscribeData["ReferenceTypes"][apiResource]["FieldsData"][fieldPrefix].push(fieldData);
                    } 
                    else 
                    {
                        PNSSubscribeData["ReferenceTypes"][apiResource]["FieldsData"][fieldPrefix] = [fieldData];
                    }
                }
                else 
                {
                    var fieldsData={};
                    fieldsData[fieldPrefix]=[fieldData];

                    PNSSubscribeData["ReferenceTypes"][apiResource] = {
                        "FieldsData": fieldsData,
                        "SubscribeDetails" : {AddonPath:`${this.dataIndexType}_pns`, FunctionName:`${apiResource}_update`}
                    };
                }
                
            });
        }
        
    }

    private async getRefTSAToApiResourceDictionary() {
        //returns dictionary mapping the TSA reference Name to its reference api resource
            var tsaRefToApiResource = {};
            try
            {
                var res  = await this.getTypesFields();
                res.forEach(fieldObj => {
                    if (fieldObj.FieldID.startsWith("TSA") && fieldObj.UIType.ID == 48) //GuidReferenceType
                    {
                        tsaRefToApiResource[fieldObj.FieldID] = fieldObj.TypeSpecificFields["ReferenceToResourceType"]["Name"];
                    }
                });
            }
            catch (e)
            {
                var x = e;
            }
            
            return tsaRefToApiResource;
        
    }

    private async getTypesFields() {
        if(this.dataIndexType == "all_activities")
        {
            var transactionsFields = await this.papiClient.metaData.type("transactions").fields.get();
            var activitiesFields = await this.papiClient.metaData.type("activities").fields.get();
            return transactionsFields.concat(activitiesFields);

        }
        else
        {
            return await this.papiClient.metaData.type(this.dataIndexType).fields.get();

        }
    }


    /* end getTypesSubscribedDataObject prinate methodes*/

}
