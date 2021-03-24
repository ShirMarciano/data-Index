import { Client } from "@pepperi-addons/debug-server/dist"
import { DataIndexTypeInsert } from "./pnsUpdates/dataIndexType/dataIndexTypeInsert"
import { DataIndexTypeUpdate } from "./pnsUpdates/dataIndexType/dataIndexTypeUpdate";
import { baseReferenceTypePNSUpdate } from "./pnsUpdates/referenceType/baseReferenceTypePNSUpdate";

const dataIndexType = "transaction_lines";
export async function insert(client: Client, request: Request): Promise<any> {
     return await new DataIndexTypeInsert(client, dataIndexType, request.body).execute();
}

export async function update(client: Client, request: Request): Promise<any> {
    return await new DataIndexTypeUpdate(client, dataIndexType, request.body).execute();
}

export async function items_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"items").execute();
}

export async function accounts_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"accounts").execute();
}

export async function users_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"users").execute();
}

export async function contacts_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"contacts").execute();
}

export async function profiles_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"profiles").execute();
}

export async function roles_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"roles").execute();
}

export async function catalogs_update(client: Client, request: Request): Promise<any> {
    return await new baseReferenceTypePNSUpdate(client, dataIndexType, request.body,"catalogs").execute();
}