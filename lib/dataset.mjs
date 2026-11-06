import fs from 'node:fs/promises';
import path from 'node:path';
import {validDataset} from '../public/dataset.js';
export async function loadDataset(root=process.cwd()){
 for(const name of ['.cache/markets.json','data/markets.json']){
  try{const value=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));if(validDataset(value))return value}catch{}
 }
 throw Error('No valid market snapshot is available');
}
export async function writeJsonAtomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp-'+process.pid;await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n');await fs.rename(temp,file)}
