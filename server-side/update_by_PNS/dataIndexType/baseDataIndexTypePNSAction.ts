import { AddonData, AddonDataScheme, PapiClient } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server'
import { CommonMethods } from '../../CommonMethods';
import fetch from "node-fetch";
import { BasePNSAction } from '../BasePNSAction';

export abstract class BaseDataIndexTypePNSAction extends BasePNSAction {

    abstract getUUIDs(pnsObjects: any[],adalRecord: AddonData): string[]


    async internalExecute(){
        var resultObject: {[k: string]: any} = {};
        resultObject.success=true;
        resultObject.resultObject={};
        try{
            
            var start = new Date().getTime();
            //Get the data index ADAL record
            var adalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table("data_index").key(this.dataIndexType).get();
            var rebuildData = adalRecord["RebuildData"];
            if(rebuildData){
                var fieldsToExport : string[] = adalRecord["RebuildData"]["FieldsToExport"];
                if(fieldsToExport)
                {
                    var UUIDs = this.getUUIDs(this.pnsObjects, adalRecord);

                    //Get from the api all the rows objects by the relevant UUIDs
                    var res = await this.getDataFromApi(UUIDs, fieldsToExport,this.dataIndexType);
                    
                    //Loop on the object we got from the api and sort them to two lists
                    //List of objectIDs to delete from elastic (all the rows that the hidden field value is 1)
                    var UUIDsToDelete : string[] = [];
                    //List of object to upload to elastic (all the rows that the hidden field value is 0)
                    var rowsToUpload : any[] = [];

                    var hiddenFieldExported = fieldsToExport.includes("Hidden");

                    res.forEach(apiObject => {
                        if(apiObject["Hidden"] == true)
                        {//objectIDs to delete from elastic
                            UUIDsToDelete.push(apiObject["UUID"]);
                        }
                        else
                        {//object to upload to elastic

                            if(!hiddenFieldExported)
                            {//remove the hidden field if it not needed to be exported
                                delete apiObject["Hidden"];
                            }
                            rowsToUpload.push(apiObject);
                        }
                    });

                    await this.deleteHiddenRowsFromTheDataIndex(UUIDsToDelete);

                    await this.uploadRowsToDataIndex(rowsToUpload);

                    var end = new Date().getTime();


                    resultObject.resultObject = {
                        DeletedRowsCount:UUIDsToDelete.length,
                        UploadedRowsCount:rowsToUpload.length
                    }
                    console.log(`Update data Index ${this.dataIndexType} took in total ${end - start} ms, ${JSON.stringify(resultObject.resultObject)}`);

                }
            }
        }catch(e){
            resultObject.success = false;
            resultObject.erroeMessage = e.message;
        }

        return resultObject;

    }

    

    private async uploadRowsToDataIndex(rowsToUpload: any[]) {
        
        var start = new Date().getTime();

        if (rowsToUpload.length > 0) {
            await this.upload(rowsToUpload);
        }
        var end = new Date().getTime();

        console.log(`Update data Index ${this.dataIndexType} - upload ${rowsToUpload.length} rows to elasticsearch took ${end - start} ms`);


    }

     async upload(rowsToUpload: any[]) {
        var fileStorage = await this.papiClient.fileStorage.tmp();

        //upload to the url
        await fetch(fileStorage.UploadURL, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json',"Cache-Control": "no-cache" },
            body: JSON.stringify(rowsToUpload),
        })

        var chunkSize = 5000;
        var start = 0;
        var totalRowsCount = rowsToUpload.length;

        while (start < totalRowsCount) {

            var rows = rowsToUpload.slice(start, start + chunkSize);

            var res = await this.papiClient.post(`/elasticsearch/bulk/${this.dataIndexType}`, { URL: fileStorage.DownloadURL });

            start += rows.length;

        }
    }


    async deleteHiddenRowsFromTheDataIndex(UUIDsToDelete: string[]) {

        var start = new Date().getTime();

        if (UUIDsToDelete.length > 0) {
            var deleteBody = {
                query: {
                    bool: {
                        must: {
                            terms: {
                                UUID: UUIDsToDelete
                            }
                        }
                    }
                }
            };

            var res = await this.papiClient.post(`/elasticsearch/delete/${this.dataIndexType}`, deleteBody);

            var end = new Date().getTime();
    
            console.log(`Update data Index ${this.dataIndexType} - delete ${UUIDsToDelete.length} rows from elasticsearch took ${end - start} ms`);

        }
    }
}