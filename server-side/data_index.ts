import { Client, Request } from '@pepperi-addons/debug-server'
import { DataIndexsActions } from './dataIndexActions';

export async function all_activities_rebuild(client: Client, request: Request): Promise<any> {
    return  new DataIndexsActions(client,"all_activities").rebuild();
}

export async function transaction_lines_rebuild(client: Client, request: Request): Promise<any> {
    return  new DataIndexsActions(client,"transaction_lines").rebuild();
}

export async function all_activities_polling(client: Client, request: Request): Promise<any> {
    return new DataIndexsActions(client,"all_activities").polling();
}

export async function transaction_lines_polling(client: Client, request: Request): Promise<any> {
    return new DataIndexsActions(client,"transaction_lines").polling();
}

export async function all_activities_retry(client: Client, request: Request): Promise<any> {
    return new DataIndexsActions(client,"all_activities").retry();
}

export async function transaction_lines_retry(client: Client, request: Request): Promise<any> {
    return new DataIndexsActions(client,"transaction_lines").retry();
}
