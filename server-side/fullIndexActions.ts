import { Client } from "@pepperi-addons/debug-server/dist";
import { DataIndexActions } from "./dataIndexActions";


export  class FullIndexActions extends DataIndexActions
{// full index rebuild do all activities data index rebuild and if finished with succes start the transaction lines rebuild

    constructor(inClient: Client) {
        super(inClient,"all_activities")
    }

    async handleRebuildEndStatus(rebuildData: any) {
        if(rebuildData["Status"] == "Success")
        { 
            var tlRebuildData = await this.papiClient.post(`/bulk/data_index/rebuild/polling/${this.dataIndexType}`);
            if(new Date(tlRebuildData["StartDateTime"]) < new Date(rebuildData["StartDateTime"]))
            {
                // all activities rebuild ended with success and the transaction lines rebuild didnt start yet 
                //(the start date of tl last rebuild is older then the start date of the all_activities rebuild
                // in that case we need to start transaction_lines rebuild - I am doing the check for cases the tl rebuild was finished after 
                //the all activites rebuild was finished - so I dont want to start it again - the papi function start new rebuild if the status is not in progress
                await this.papiClient.addons.api.async().uuid(this.client.AddonUUID).file("data_index").func("transaction_lines_rebuild").post();
            }
        }
    }

    getPollingFunctionName()
    {
        return "full_index_rebuild_polling";
    }

    async getPollingResults(rebuildData:any) : Promise<any>
    {

        var result:any = 
        {
            AllActivitiesStatus: rebuildData["Status"],
            TransactionLinesStatus: "InProgress"
        };

        if(rebuildData["Status"] == "Success")
        { 
            var tlRebuildData = await this.papiClient.post(`/bulk/data_index/rebuild/polling/${this.dataIndexType}`);
            result.TransactionLinesStatus = tlRebuildData["Status"];
        }
        else if(rebuildData["Status"] == "Failure")
        {
            result.TransactionLinesStatus = "Failure";
        }

        return result;
    }

}