const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
require('dotenv').config();

function run(command, args, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { env: { ...process.env, ...extraEnv } }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${command} falhou: ${stderr || error.message}`));
                return;
            }
            resolve(stdout || '');
        });
    });
}

function getArg(name) {
    const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
    return found ? found.split('=').slice(1).join('=') : '';
}

function parseConnectionUrl(url) {
    try {
        const parsed = new URL(url);
        return {
            protocol: parsed.protocol.replace(':', ''),
            host: parsed.hostname,
            port: parsed.port,
            user: decodeURIComponent(parsed.username || ''),
            password: decodeURIComponent(parsed.password || ''),
            database: decodeURIComponent((parsed.pathname || '').replace(/^\//, ''))
        };
    } catch {
        return null;
    }
}

function detectDbType(explicitType) {
    if (explicitType) return explicitType;

    const envType = (process.env.BACKUP_DB_TYPE || '').trim().toLowerCase();
    if (envType) return envType;

    const sqlitePath = getSqlitePath();
    if (fs.existsSync(sqlitePath)) return 'sqlite';

    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL || '';
    if (/^postgres(ql)?:\/\//i.test(databaseUrl)) return 'postgres';
    if (/^mysql:\/\//i.test(databaseUrl)) return 'mysql';

    if (process.env.DB_HOST || process.env.MYSQL_HOST) return 'mysql';

    return 'sqlite';
}

function getSqlitePath() {
    if (process.env.SQLITE_DB_PATH) return process.env.SQLITE_DB_PATH;

    const isProdLike = Boolean(process.env.NODE_ENV === 'production');
    if (isProdLike) return '/tmp/ldfp_db.sqlite';

    return path.resolve(__dirname, '..', 'ldfp_db.sqlite');
}

function resolveBackupFile() {
    const argFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
    const envFile = process.env.BACKUP_FILE || '';
    const file = argFile || envFile;

    if (!file) {
        throw new Error('Informe o arquivo de backup: node scripts/restore-db.js backups/arquivo.sql');
    }

    const full = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) {
        throw new Error(`Arquivo de backup não encontrado: ${full}`);
    }

    return full;
}

async function restoreSqlite(backupFile) {
    const dbPath = getSqlitePath();
    fs.copyFileSync(backupFile, dbPath);
    return { dbType: 'sqlite', target: dbPath };
}

async function restorePostgres(backupFile) {
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL/DB_URL não definido para restore PostgreSQL.');
    }

    await run('psql', [databaseUrl, '-f', backupFile]);
    return { dbType: 'postgres', target: databaseUrl };
}

async function restoreMysql(backupFile) {
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL || '';
    const fromUrl = parseConnectionUrl(databaseUrl);

    const host = process.env.DB_HOST || process.env.MYSQL_HOST || (fromUrl && fromUrl.host);
    const port = process.env.DB_PORT || process.env.MYSQL_PORT || (fromUrl && fromUrl.port) || '3306';
    const user = process.env.DB_USER || process.env.MYSQL_USER || (fromUrl && fromUrl.user);
    const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || (fromUrl && fromUrl.password) || '';
    const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || (fromUrl && fromUrl.database);

    if (!host || !user || !database) {
        throw new Error('Configuração MySQL incompleta para restore (host/user/database).');
    }

    await run('mysql', ['-h', host, '-P', String(port), '-u', user, database, '-e', `source ${backupFile.replace(/\\/g, '/')}`], { MYSQL_PWD: password });
    return { dbType: 'mysql', target: `${host}:${port}/${database}` };
}

async function main() {
    const backupFile = resolveBackupFile();
    const explicitType = getArg('type').toLowerCase();
    const dbType = detectDbType(explicitType);

    let result;
    if (dbType === 'sqlite') result = await restoreSqlite(backupFile);
    else if (dbType === 'postgres') result = await restorePostgres(backupFile);
    else if (dbType === 'mysql') result = await restoreMysql(backupFile);
    else throw new Error(`Tipo de banco não suportado: ${dbType}`);

    console.log('Restore concluído com sucesso!');
    console.log(`Banco: ${result.dbType}`);
    console.log(`Origem: ${backupFile}`);
    console.log(`Destino: ${result.target}`);
}

main().catch((err) => {
    console.error('Erro no restore:', err.message);
    process.exit(1);
});
