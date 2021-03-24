import { AddonData } from '@pepperi-addons/papi-sdk'
import { BaseDataIndexTypePNSAction } from './baseDataIndexTypePNSAction';

export class DataIndexTypeUpdate extends BaseDataIndexTypePNSAction{

    getUUIDs(pnsObjects: any[],adalRecord: AddonData): string[] {

        var subscribedFields :string[] = adalRecord["PNSSubscribeData"]["IndexType"]["Fields"];
        
        var UUIDs = this.collectUUIDsOfPNSObjects(subscribedFields);  

        return UUIDs;
    }
}