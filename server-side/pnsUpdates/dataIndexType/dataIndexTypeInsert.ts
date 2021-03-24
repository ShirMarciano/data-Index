import { AddonData } from '@pepperi-addons/papi-sdk';
import { BaseDataIndexTypePNSAction } from './baseDataIndexTypePNSAction';

export class DataIndexTypeInsert extends BaseDataIndexTypePNSAction{

    getUUIDs(pnsObjects: any[],adalRecord: AddonData): string[] {
        var UUIDs : string[] = [];
        pnsObjects.forEach(pnsObject => {
            UUIDs.push(pnsObject["UUID"]);
        });    

        return UUIDs;
    }
}