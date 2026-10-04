import {spawnSync} from 'node:child_process';
// Real PostgreSQL semantics in ephemeral local PGlite databases; no provider calls.
// Includes empty-only retirement, preserved account data and verified signup proof.
const result=spawnSync(process.execPath,['--test','tests/static-legal.test.mjs'],{stdio:'inherit'});
process.exitCode=result.status ?? 1;
