import path from 'node:path';
import fs from 'node:fs/promises';
import {loadDataset,writeJsonAtomic} from '../lib/dataset.mjs';
import {updateMarkets} from '../lib/update-markets.mjs';
const root=process.cwd(),reportPath=path.join(root,'.cache/refresh-report.json');
let report;
try{
 const previous=await loadDataset(root),data=await updateMarkets(previous);
 await writeJsonAtomic(path.join(root,'.cache/markets.json'),data);
 report={status:data.kind,at:data.checkedAt,updated:data.refreshed,reused:data.reused,deferred:data.deferred,total:data.markets.length,failed:data.failed,summary:`${data.refreshed} detail pages updated; ${data.reused} recent cached details reused; ${data.deferred} queued for a later run. ${data.failed} listings have saved or pending details.`};
 console.log(report.summary);
}catch(error){
 report={status:'failed',at:new Date().toISOString(),summary:'Berlin.de could not be refreshed. The last successful data or bundled snapshot will be published.',reason:error instanceof Error?error.message:'Source unavailable'};
 console.error(report.summary);console.error(report.reason);process.exitCode=1;
}
await writeJsonAtomic(reportPath,report);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`### Market data update\n\n${report.summary}\n\nCheck time (UTC): ${report.at}\n`);
