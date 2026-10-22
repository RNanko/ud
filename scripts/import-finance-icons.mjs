import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {styleFinanceIcon} from './finance-icon-style.mjs';
// Extract only known SVG filenames. README/HTML and archive paths are not executed.
const root=resolve(import.meta.dirname,'..');
const packs=[['spending','C:/Users/romas/Downloads/manforth_100_neon_spending_icons_svg.zip'],['revenue','C:/Users/romas/Downloads/manforth_revenue_neon_svg_icons.zip']];
const catalog=[];
for(const [kind,path] of packs){
 const command=`Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead('${path.replaceAll("'","''")}'); try { $values=@(); foreach($entry in $zip.Entries){ if($entry.FullName.EndsWith('.svg')){ $reader=[IO.StreamReader]::new($entry.Open()); try { $values+=@{name=$entry.FullName;svg=$reader.ReadToEnd()} } finally {$reader.Dispose()} } }; ConvertTo-Json -InputObject $values -Compress } finally {$zip.Dispose()}`;
 const entries=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',maxBuffer:4*1024*1024}));
 mkdirSync(resolve(root,'public/finance-icons',kind),{recursive:true});
 for(const entry of entries){
  const name=entry.name.split('/').at(-1);
  if(!/^[a-z0-9_-]+\.svg$/.test(name)||entry.svg.length>100000||!/^\s*<svg\b/.test(entry.svg)||/<(?:script|foreignObject|iframe|image)\b|\bon\w+\s*=|(?:href|src)\s*=|<!DOCTYPE|<!ENTITY/i.test(entry.svg))throw Error('Unexpected SVG content');
  const slug=name.slice(0,-4),label=slug.replace(/^\d+_\d+_/,'').replaceAll('_',' ').replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
  writeFileSync(resolve(root,'public/finance-icons',kind,name),styleFinanceIcon(entry.svg,kind));
  catalog.push({id:`${kind}:${slug}`,label,kind,src:`/finance-icons/${kind}/${name}`});
 }
}
writeFileSync(resolve(root,'lib/finance-category-icons.json'),JSON.stringify(catalog,null,2)+'\n');
const predecessor=readFileSync(resolve(root,'lib/db/0038_finance_currency_edit.sql'),'utf8');
const func=predecessor.slice(predecessor.indexOf('CREATE OR REPLACE FUNCTION')).replace('id,user_id,name,normalized_name,type,hidden)','id,user_id,name,normalized_name,type,hidden,icon)').replace("command->>'type',(command->>'hidden')::boolean)","command->>'type',(command->>'hidden')::boolean,command->>'icon')").replace('DO UPDATE SET hidden=EXCLUDED.hidden;','DO UPDATE SET hidden=EXCLUDED.hidden,icon=CASE WHEN command ? \'icon\' THEN EXCLUDED.icon ELSE finance_categories.icon END;');
if(!func.includes('icon=CASE'))throw Error('Finance category branch changed.');
const allowed=catalog.map(icon=>`'${icon.id}'`).join(',');
const migrationPath=resolve(root,'lib/db/0052_finance_category_icons.sql');
const migration=`-- Account-owned category appearance; previous clients preserve saved icons.\nALTER TABLE finance_categories ADD COLUMN icon text;\nALTER TABLE finance_categories ADD CONSTRAINT finance_categories_icon_known CHECK(icon IS NULL OR icon IN (${allowed}));\n${func}`;
if(existsSync(migrationPath)&&readFileSync(migrationPath,'utf8').replaceAll('\r\n','\n')!==migration)throw Error('Existing migration differs. Add a new migration instead of rewriting history.');
if(!existsSync(migrationPath))writeFileSync(migrationPath,migration);
console.log(`Imported ${catalog.length} SVG icons and prepared category icon migration.`);
