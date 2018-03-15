import { SyncPipelineProcessor,
         SyncPipelineProcessorConfig,
         SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { SyncPipelineProcessorEntry,
         SyncPipelineProcessorEntryDoc } from '../../../db/models';
import { fromScienceBaseReport } from './FromScienceBase';
import { simplificationReport } from './Simplification';
import { contactsReport } from './Contacts';

import * as moment from 'moment';


/**
 * The output of the report processor.
 *
 * @todo add who mail was sent to, etc.
 */
export class ReportOutput {
    report:string;
}

/**
 * Configuration for the report processor.
 *
 * @todo e-mail configuration
 */
export interface ReportConfig extends SyncPipelineProcessorConfig {
}

const REPORT_GENERATORS = {
    'FromScienceBase': fromScienceBaseReport,
    'Simplification': simplificationReport,
    'Contacts': contactsReport,
}

const TIME_FMT = 'HH:mm:ss';
const FULL_DATE_FMT = `ddd MM.DD.YYYY - ${TIME_FMT}`;

export default class Report extends SyncPipelineProcessor<ReportConfig,ReportOutput> {
    run():Promise<SyncPipelineProcessorResults<ReportOutput>> {
        return new Promise((resolve,reject) => {
            this.results.results = new ReportOutput();
            let report = `Sync pipeline report (${moment().format(FULL_DATE_FMT)})`;
            let criteria:any = {processorClass: {$ne: this.processorClass}};
            if(this.procEntry.lastComplete) {
                criteria = {...criteria,lastComplete:{$gt: this.procEntry.lastComplete}};
            }
            console.log('criteria',criteria);
            SyncPipelineProcessorEntry.find(criteria)
            .sort({lastComplete: 'asc'}) // in the order they were run
            .exec((err,entries:SyncPipelineProcessorEntryDoc[]) => {
                if(err) {
                    return reject(err);
                }
                console.log(entries);
                let indent = (lines:string):string => lines.split("\n").map(l => `  ${l}`).join("\n");
                entries.forEach((entry:SyncPipelineProcessorEntryDoc) => {
                    report += `\n\n[${entry.processorClass}/${entry.processorId}] ${moment(entry.lastStart).format(TIME_FMT)} - ${moment(entry.lastComplete).format(TIME_FMT)}\n\n`
                    if(entry.results) {
                        if(REPORT_GENERATORS[entry.processorClass]) {
                            report += indent(REPORT_GENERATORS[entry.processorClass](entry.results));
                        } else {
                            report += indent(`No report generator for ${entry.processorClass}`);
                        }
                    }
                    if(entry.error) {
                        report += `ERROR "${entry.error.message}"`;
                        report += `${entry.error.stack}`;
                    }
                });
                this.results.results.report = report;
                resolve(this.results);
            });
        });
    }
}
