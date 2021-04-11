import { Client } from "@pepperi-addons/debug-server/dist";
import { DataIndexActions } from "./dataIndexActions";


export  class FullIndexActions extends DataIndexActions
{// full index rebuild do all activities data index rebuild and if finished with succes start the transaction lines rebuild

    constructor(inClient: Client) {
        super(inClient,"all_activities")
    }

    async handleRebuildStatus(adalRecord: any) 
    {
        var rebuildData = adalRecord["RebuildData"];
        var status = rebuildData["Status"] ;
        if(status != "InProgress")
        {
            if(status == "Success")
            { 
                console.log(`full index rebuild - all activities rebuild ended with success`);

                var tlRebuildData = await this.papiClient.post(`/bulk/data_index/rebuild/polling/transaction_lines`);
                if(new Date(tlRebuildData["StartDateTime"]) < new Date(rebuildData["StartDateTime"]))
                {
                    await this.setTrsanactionLinesTempInProgressData();

                    // all activities rebuild ended with success and the transaction lines rebuild didnt start yet 
                    //(the start date of tl last rebuild is older then the start date of the all_activities rebuild
                    // in that case we need to start transaction_lines rebuild - I am doing the check for cases the tl rebuild was finished after 
                    //the all activites rebuild was finished - so I dont want to start it again - the papi function start new rebuild if the status is not in progress
                    var res = await this.papiClient.addons.api.async().uuid(this.client.AddonUUID).file("data_index").func("transaction_lines_rebuild").post();
                    console.log(`full index rebuild - transaction_lines async rebuild result: ${JSON.stringify(res)}`);
                }
            }
            await this.unscheduledPollingCodeJob(adalRecord);
        }
        else //all activities status == "InProgress"
        {
            await this.setTrsanactionLinesTempInProgressData();
        }
    }

    private async setTrsanactionLinesTempInProgressData() {
        var tlAdalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table("data_index").key("transaction_lines").get();
        if(!tlAdalRecord["RebuildData"])
        {
            tlAdalRecord["RebuildData"] = {}
        }
        tlAdalRecord["RebuildData"]["Status"] = "";
        tlAdalRecord["RebuildData"]["Count"] = 0;
        tlAdalRecord["RebuildData"]["Current"] = 0;
        tlAdalRecord["RebuildData"]["Message"] = "";
        await this.papiClient.addons.data.uuid(this.client.AddonUUID).table("data_index").upsert(tlAdalRecord);
    }

    getPollingFunctionName()
    {
        return "full_index_rebuild_polling";
    }

    async getPollingResults(rebuildData:any) : Promise<any>
    {

        var result:any = 
        {
            AllActivities: rebuildData,
            TransactionLines: {Status: "InProgress", Count:1, Current:0}
        };

        if(rebuildData["Status"] == "Success")
        { 
            var rebuldData = {};
            var tlRebuildData = await this.papiClient.post(`/bulk/data_index/rebuild/polling/transaction_lines`);
            if(new Date(tlRebuildData["StartDateTime"]) > new Date(rebuildData["StartDateTime"]))
            {// transaction lines rebuild that run or is runnong started after all activities finished - poll the transaction lines itself
                tlRebuildData = await this.papiClient.addons.api.sync().uuid(this.client.AddonUUID).file("data_index").func("transaction_lines_polling").post();
            }
            else
            { // transaction lines rebuild didnt starte yet, need the temp data we inserted
                var tlAdalRecord = await this.papiClient.addons.data.uuid(this.client.AddonUUID).table("data_index").key("transaction_lines").get();
                tlRebuildData = tlAdalRecord["RebuildData"];
            }
            result.TransactionLines = tlRebuildData;
        }
        else if(rebuildData["Status"] == "Failure")
        {
            result.TransactionLines= { Status: "Failure", Count:1, Current:0};
        }

        return result;
    }

}