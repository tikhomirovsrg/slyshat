import {DatabaseSync,backup} from 'node:sqlite';
import {readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
// Online SQLite backup includes committed WAL data. stdout contains only bytes.
const file=join(tmpdir(),'slyshat-'+randomUUID()+'.sqlite');
const db=new DatabaseSync(process.env.DATABASE_PATH||'/data/slyshat.sqlite',{readOnly:true});
try{await backup(db,file);process.stdout.write(readFileSync(file));}finally{db.close();try{unlinkSync(file);}catch{}}
