import { PapiClient } from '@pepperi-addons/papi-sdk'
import { Client} from '@pepperi-addons/debug-server'
export  class CommonMethods{

    public static getPapiClient(client: Client) {
            return new PapiClient({
                baseURL:client.BaseURL,
                token: client.OAuthAccessToken,
                addonUUID: client.AddonUUID,
                addonSecretKey: client.AddonSecretKey
            });
        }

    public static distinct(value, index, self) {
            return self.indexOf(value) === index;
        }

    public static collectFieldsToSubscribeToOnTheApiResource(fieldsData: any) {
        var fieldsToSubscribe: string[] = [];
        for (var prefix in fieldsData) {
            var fieldsObjects = fieldsData[prefix];
            var fields: string[] = fieldsObjects.map(a => a.FieldName);

            if (fieldsToSubscribe.length > 0) {
                fieldsToSubscribe = fieldsToSubscribe.concat(fields);
            }
            else 
            {
                fieldsToSubscribe = fields;
            }
        }
        fieldsToSubscribe = fieldsToSubscribe.filter(CommonMethods.distinct);
            
        return fieldsToSubscribe;
    }
}