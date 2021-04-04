
import { DataIndexTypeHiddenUpdate } from './dataIndexTypeHiddenUpdate';

export class TransactionLinesHiddenUpdate extends DataIndexTypeHiddenUpdate {

    async handleHiddenRows(hiddenRows: any[]):Promise<any>
    {
        //delete hidden transaction lines from the data index
        await this.deleteHiddenRowsFromTheDataIndex(hiddenRows.map(r=>r["UUID"]),"transaction_lines");
        return {"deletedRowsCount":hiddenRows.length}

    }

    async handleUnhideRows(HandleUnhiddenRows: any[],fieldsToExport:string[]):Promise<any>
    {
        //upload unhidden transaction lines to the data index
        var rowsToUpload = this.getRowsToUploadFromApiResult(fieldsToExport,HandleUnhiddenRows);
        await this.uploadRowsToDataIndex(rowsToUpload,"transaction_lines");
        return {"InsertedRowsCount":rowsToUpload.length}

    }

}