/**
 * Read-only Neon staging connection check for GitHub Actions.
 * Fails closed when environment secrets point to any other branch.
 * Does not print credentials and never writes to the database.
 */
import pg from "pg";
import {pathToFileURL} from "node:url";
const {Client}=pg;

export async function checkStagingConnection(env=process.env,deps={}){
  const raw=env.LIBRARY_STAGING_DB_URL;
  const branch=env.LIBRARY_STAGING_BRANCH_ID;
  if(!raw||!branch)throw Error("Missing staging-only GitHub environment secrets");
  let parsed;
  try{parsed=new URL(raw);}catch{throw Error("Invalid staging URL");}
  if(!["postgres:","postgresql:"].includes(parsed.protocol) ||
     !/\.neon\.tech$/i.test(parsed.hostname) ||
     !parsed.username || !parsed.pathname || parsed.pathname==="/" ||
     !/^br-[a-z0-9-]+$/.test(branch))throw Error("Invalid Neon staging configuration");
  const db=deps.db??new Client({connectionString:raw,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000});
  await db.connect();
  try{
    const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
    if(guard.rows.length!==1 || guard.rows[0].branchId!==branch ||
       guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
      throw Error("Staging guard failed: connection must NOT target production");
    const summary=await db.query(`
      SELECT count(DISTINCT a."id")::integer AS "authors",
             count(DISTINCT w."id")::integer AS "works",
             count(DISTINCT e."id")::integer AS "editions",
             count(DISTINCT p."id")::integer AS "passages"
      FROM "LibraryAuthor" a
      LEFT JOIN "LibraryWork" w ON w."authorId"=a."id"
      LEFT JOIN "LibraryEdition" e ON e."workId"=w."id"
      LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
    `);
    return {status:"STAGING_CONNECTION_VERIFIED",branchId:branch,
      counts:summary.rows[0],databaseWrites:0};
  }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  checkStagingConnection().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
    .catch(e=>{process.stderr.write("STAGING_CHECK_FAILED: "+e.message+"\n");process.exitCode=1;});
}
