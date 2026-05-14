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

function ensureBackupsDir() {
    const dir = path.resolve(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupOldBackups(backupsDir, days) {
    if (!days || Number.isNaN(days) || days <= 0) return;

    const now = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    for (const file of fs.readdirSync(backupsDir)) {
        const full = path.join(backupsDir, file);
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;

        if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(full);
            console.log(`Removido backup antigo: ${file}`);
        }
    }
}

async function backupSqlite(backupsDir, stamp) {
    const dbPath = getSqlitePath();
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Arquivo SQLite não encontrado: ${dbPath}`);
    }

    const target = path.join(backupsDir, `sqlite-${stamp}.sqlite`);
    fs.copyFileSync(dbPath, target);
    return { dbType: 'sqlite', file: target };
}

async function backupPostgres(backupsDir, stamp) {
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL/DB_URL não definido para backup PostgreSQL.');
    }

    const target = path.join(backupsDir, `postgres-${stamp}.sql`);
    await run('pg_dump', ['--no-owner', '--no-acl', '--clean', '--if-exists', '--file', target, databaseUrl]);
    return { dbType: 'postgres', file: target };
}

async function backupMysql(backupsDir, stamp) {
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL || '';
    const fromUrl = parseConnectionUrl(databaseUrl);

    const host = process.env.DB_HOST || process.env.MYSQL_HOST || (fromUrl && fromUrl.host);
    const port = process.env.DB_PORT || process.env.MYSQL_PORT || (fromUrl && fromUrl.port) || '3306';
    const user = process.env.DB_USER || process.env.MYSQL_USER || (fromUrl && fromUrl.user);
    const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || (fromUrl && fromUrl.password) || '';
    const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || (fromUrl && fromUrl.database);

    if (!host || !user || !database) {
        throw new Error('Configuração MySQL incompleta para backup (host/user/database).');
    }

    const target = path.join(backupsDir, `mysql-${stamp}.sql`);
    await run(
        'mysqldump',
        ['-h', host, '-P', String(port), '-u', user, '--single-transaction', '--routines', '--events', database, '--result-file', target],
        { MYSQL_PWD: password }
    );

    return { dbType: 'mysql', file: target };
}

async function main() {
    const explicitType = getArg('type').toLowerCase();
    const dbType = detectDbType(explicitType);
    const backupsDir = ensureBackupsDir();
    const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    let result;
    if (dbType === 'sqlite') result = await backupSqlite(backupsDir, stamp);
    else if (dbType === 'postgres') result = await backupPostgres(backupsDir, stamp);
    else if (dbType === 'mysql') result = await backupMysql(backupsDir, stamp);
    else throw new Error(`Tipo de banco não suportado: ${dbType}`);

    const meta = {
        createdAt: new Date().toISOString(),
        dbType: result.dbType,
        file: path.basename(result.file),
        retentionDays
    };

    const metaFile = path.join(backupsDir, `backup-meta-${stamp}.json`);
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    cleanupOldBackups(backupsDir, retentionDays);

    console.log('Backup concluído com sucesso!');
    console.log(`Banco: ${result.dbType}`);
    console.log(`Arquivo: ${result.file}`);
    console.log(`Meta: ${metaFile}`);
}

main().catch((err) => {
    console.error('Erro no backup:', err.message);
    process.exit(1);
});
