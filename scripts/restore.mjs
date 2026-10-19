import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
if(!process.argv.includes('--confirm-app-stopped'))throw new Error('Stop the app first, then pass --confirm-app-stopped.');
const target=process.env.DATABASE_PATH||'/data/slyshat.sqlite';
mkdirSync(dirname(target),{recursive:true});const temp=target+'.restore';
writeFileSync(temp,readFileSync(0),{mode:0o600});
try{
 const db=new DatabaseSync(temp);const integrity=db.prepare('PRAGMA integrity_check').get();
 if(!integrity||Object.values(integrity)[0]!=='ok')throw new Error('Invalid SQLite backup.');
 const version=Number(db.prepare('PRAGMA user_version').get().user_version);if(![1,2,3].includes(version))throw new Error('Unsupported backup version.');
 for(const name of ['users','sessions','oauth_flows','progress','runs',...(version>=2?['study_profiles']:[]),...(version>=3?['content_stories','project_documents','content_seed_versions']:[])])if(!db.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table',name))throw new Error('Backup is missing tables.');
 db.exec('DELETE FROM sessions; DELETE FROM oauth_flows; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');db.close();
 const existing=['','-wal','-shm'].filter(suffix=>existsSync(target+suffix));
 if(existing.length&&!process.argv.includes('--archive-existing'))throw new Error('Existing database found. Use --archive-existing to preserve it before restore.');
 const stamp='.before-restore-'+new Date().toISOString().replaceAll(':','-');
 for(const suffix of existing)renameSync(target+suffix,target+stamp+suffix);
 renameSync(temp,target);console.error('Restored. Sessions were revoked; sign in again.');
}catch(e){try{unlinkSync(temp);}catch{}throw e;}
