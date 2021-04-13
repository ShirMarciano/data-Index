import {
    Component,
    EventEmitter,
    Input,
    Output,
    OnInit,
    ViewEncapsulation,
    Compiler,
    ViewChild,
    OnDestroy,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Router, ActivatedRoute } from "@angular/router";
import { PepLayoutService, PepScreenSizeType } from '@pepperi-addons/ngx-lib';
import { DataIndexService } from './data-index.service';
import { identifierModuleUrl } from "@angular/compiler";
import { of } from "rxjs";




@Component({
  selector: 'data-index',
  templateUrl: './data-index.component.html',
  styleUrls: ['./data-index.component.scss'],
  providers: [DataIndexService]
})
export class DataIndexComponent implements OnInit {
    screenSize: PepScreenSizeType;
    defaultFields: any;
    typesFields: any;
    uiData:any;
    disablePublish:boolean;
    progressIndicator:string;
    progressFaild:string;
    indexingFaild:boolean;
    indexingError:string;

    menuOptions = [];


    constructor(
        public dataIndexService: DataIndexService,
        private translate: TranslateService,
        public routeParams: ActivatedRoute,
        public router: Router,
        public compiler: Compiler,
        public layoutService: PepLayoutService,
    ) {

        // Parameters sent from url
        this.dataIndexService.pluginUUID = this.routeParams.snapshot.params['addon_uuid'];
        let userLang = "en";
        translate.setDefaultLang(userLang);
        userLang = translate.getBrowserLang().split("-")[0]; // use navigator lang if available
        translate.use(userLang);
        this.layoutService.onResize$.subscribe(size => {
            this.screenSize = size;
        });

        

    }

  ngOnInit(): void {

    this.menuOptions = [{ key: 'delete_index', text: this.translate.instant('Data_index_delete_index')}];

    this.uiData = this.dataIndexService.getUIData((result: any) => {

        this.uiData = result;
        var fields = this.uiData['Fields'];
        this.defaultFields = fields['DataIndexTypeDefaultFields'];
        this.typesFields = fields['TypesFields'];


        var progressData = this.uiData['ProgressData'];
        var progressStatus = progressData['Status'];

        this.disablePublish = progressStatus && progressStatus == 'InProgress'

        this.setProgressIndicator(progressData, progressStatus);

        

       });

       
  }

    private setProgressIndicator(progressData: any, progressStatus: any) {
        this.progressIndicator = "";
        if (progressData["RunTime"]) {
            this.progressIndicator = `The process is scheduled to run at: ${progressData["RunTime"]}`;
        }
        else if (progressStatus) {

            if (progressStatus == "Failure") {
                this.progressFaild = `Failed to publish the data`;
                this.indexingFaild = true;
                this.indexingError = progressData["Message"];
            }else{
                var alPrecentage = progressData["all_activities_progress"]["Precentage"];
                alPrecentage = alPrecentage != "" ? alPrecentage : 0;
                var tlPrecentage = progressData["transaction_lines_progress"]["Precentage"];
                tlPrecentage = tlPrecentage != "" ? tlPrecentage : 0;

                this.progressIndicator = `Activities & Transactions indexing ${alPrecentage}% completed, Transaction lines indexing ${tlPrecentage}% completed `;

            }
        }
    }

    publishClicked(){
        //get the fields to save
        //open dialog
    }

    onMenuItemClicked(event) {
        switch (event.apiName) {
            case 'delete_index': {
                this.dataIndexService.openDialog(
                    this.translate.instant(
                        "Data_index_delete_index"
                    ),
                    this.translate.instant(
                        "Data_index_delete_body"
                    ),
                    () =>{ 
                        var res = this.dataIndexService.deleteIndex(()=>{});
                        if(res["success"] == true){
                            this.progressIndicator="";
                        }
                    }
                );
                
                break;
            }
            default: {
                alert(event.apiName + " is not supported");
            }
        }
    }
    
}
