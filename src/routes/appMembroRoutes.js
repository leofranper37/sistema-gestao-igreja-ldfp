/**
 * Rotas públicas do App do Membro (PWA).
 * Não requerem sessão do painel.
 *
 * Identificação da igreja: parâmetro igrejaTk (query string ou body).
 * É um token público aleatório gerado no cadastro — não é o id numérico.
 * Sem um igrejaTk válido as rotas retornam 400 ou 404. Não há fallback.
 *
 * GET  /api/app/config          → configurações públicas (logo, verso, etc.)
 * GET  /api/app/congregacoes    → lista de congregações
 * GET  /api/app/videos          → vídeos marcados como visíveis no app
 * GET  /api/app/midias          → todas as mídias agrupadas por tipo
 * GET  /api/app/eventos         → eventos do mês (?mes=YYYY-MM)
 * POST /api/app/conexoes        → pedido de conexão / oração / ajuda / decisão
 */

const crypto = require('crypto');
const express = require('express');
const { pool } = require('../config/db');
const agendaService = require('../services/agendaService');
const { requireAuth, authorize } = require('../middlewares/auth');

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeMediaType(type) {
    const raw = String(type || '').trim().toLowerCase();
    if (raw === 'video' || raw === 'videos') return 'videos';
    if (raw === 'audio' || raw === 'audios') return 'audios';
    if (raw === 'image' || raw === 'images' || raw === 'imagens') return 'images';
    if (raw === 'document' || raw === 'documents' || raw === 'docs') return 'documents';
    return '';
}

function mediaTableByType(type) {
    if (type === 'videos') return 'app_videos';
    if (type === 'audios') return 'app_audios';
    if (type === 'images') return 'app_images';
    if (type === 'documents') return 'app_documents';
    return '';
}

/** Executa CREATE TABLE nos três dialetos (pg / mysql / sqlite). */
async function ensureTable(statements) {
    for (const sql of statements) {
        try { await pool.query(sql); return; } catch (_e) { /* tenta o próximo */ }
    }
}

async function ensureOptionalColumn(tableName, columnName, sqlType) {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`;
    try {
        await pool.query(sql);
    } catch (_error) {
        // Coluna já existe ou o dialeto usa sintaxe diferente; seguimos com fallback seguro.
    }
}

// ─── auto-criação de tabelas ─────────────────────────────────────────────────

let _tablesReady = null;

async function ensureAppTables() {
    if (_tablesReady) return _tablesReady;

    _tablesReady = (async () => {
        // app_congregacoes
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_congregacoes (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                nome VARCHAR(255) NOT NULL,
                pastor VARCHAR(255),
                dirigente VARCHAR(255),
                telefone VARCHAR(50),
                endereco TEXT,
                latitude DECIMAL(10,7),
                longitude DECIMAL(10,7),
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_congregacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                nome VARCHAR(255) NOT NULL,
                pastor VARCHAR(255),
                dirigente VARCHAR(255),
                telefone VARCHAR(50),
                endereco TEXT,
                latitude DECIMAL(10,7),
                longitude DECIMAL(10,7),
                ativo TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_congregacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                nome TEXT NOT NULL,
                pastor TEXT,
                dirigente TEXT,
                telefone TEXT,
                endereco TEXT,
                latitude REAL,
                longitude REAL,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_videos
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_videos (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                data DATE,
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_videos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                data DATE,
                ativo TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                data TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_audios
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_audios (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_audios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_audios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_images
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_images (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_documents
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_documents (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name VARCHAR(255),
                ativo TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                descricao TEXT,
                file_name TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_conexoes
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_conexoes (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                tipo VARCHAR(50) NOT NULL,
                nome VARCHAR(255) NOT NULL,
                celular VARCHAR(50),
                mensagem TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'novo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_conexoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                tipo VARCHAR(50) NOT NULL,
                nome VARCHAR(255) NOT NULL,
                celular VARCHAR(50),
                mensagem TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'novo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_conexoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                tipo TEXT NOT NULL,
                nome TEXT NOT NULL,
                celular TEXT,
                mensagem TEXT,
                status TEXT NOT NULL DEFAULT 'novo',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        // app_config
        await ensureTable([
            `CREATE TABLE IF NOT EXISTS app_config (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
                verso_contribuicoes TEXT,
                logo_url TEXT,
                whatsapp VARCHAR(50),
                facebook TEXT,
                instagram TEXT,
                youtube TEXT,
                live_stream_url TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                verso_contribuicoes TEXT,
                logo_url TEXT,
                whatsapp VARCHAR(50),
                facebook TEXT,
                instagram TEXT,
                youtube TEXT,
                live_stream_url TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_app_config_igreja (igreja_id)
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
                verso_contribuicoes TEXT,
                logo_url TEXT,
                whatsapp TEXT,
                facebook TEXT,
                instagram TEXT,
                youtube TEXT,
                live_stream_url TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);

        await ensureOptionalColumn('app_config', 'youtube', 'TEXT');
        await ensureOptionalColumn('app_config', 'live_stream_url', 'TEXT');
        await ensureOptionalColumn('app_config', 'licao_semana', 'VARCHAR(255)');
        await ensureOptionalColumn('app_config', 'licao_url', 'TEXT');

        // Garante a coluna public_token em igrejas (bancos existentes não a têm)
        await ensureOptionalColumn('igrejas', 'public_token', 'VARCHAR(64)');

        // Atribui token a igrejas que ainda não têm (backfill para instalações antigas e SQLite)
        const [unTokened] = await pool.query(
            "SELECT id FROM igrejas WHERE public_token IS NULL OR public_token = ''"
        );
        for (const row of (unTokened || [])) {
            const token = crypto.randomBytes(20).toString('hex');
            await pool.query(
                "UPDATE igrejas SET public_token = ? WHERE id = ? AND (public_token IS NULL OR public_token = '')",
                [token, row.id]
            );
        }
    })();

    return _tablesReady;
}

// ─── middleware: identifica a igreja pelo token público ──────────────────────

const jwt = require('jsonwebtoken');
const config = require('../config');

async function resolveIgreja(req, res, next) {
    await ensureAppTables();

    const tkParam = String(req.query.igrejaTk || req.body?.igrejaTk || '').trim();

    if (tkParam) {
        try {
            const [rows] = await pool.query(
                'SELECT id FROM igrejas WHERE public_token = ? LIMIT 1',
                [tkParam]
            );
            if (!rows || !rows.length) {
                return res.status(404).json({ error: 'Igreja não encontrada.' });
            }
            req.igrejaId = rows[0].id;
            return next();
        } catch (err) {
            return res.status(500).json({ error: 'Erro interno ao identificar a igreja.' });
        }
    }

    // Fallback: aceita token JWT de membro autenticado para identificar a igreja
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        try {
            const payload = jwt.verify(authHeader.slice(7).trim(), config.security.jwtSecret);
            if (payload.igrejaId) {
                req.igrejaId = payload.igrejaId;
                return next();
            }
        } catch (_) {}
    }

    return res.status(400).json({ error: 'Identificador de igreja ausente (igrejaTk).' });
}

// Permite acesso a admin/secretaria OU membro com gerenciar_midias=true
function authorizeMediaWrite(req, res, next) {
    if (!req.auth) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (['admin', 'secretaria', 'super-admin'].includes(req.auth.role)) {
        return next();
    }
    if (req.auth.app_mode && req.auth.gerenciar_midias) {
        return next();
    }
    return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para gerenciar mídias.' });
}

// ─── GET /api/app/config ─────────────────────────────────────────────────────

router.get('/api/app/config', resolveIgreja, async (req, res) => {
    try {
        await ensureAppTables();
        const id = req.igrejaId;
        const [rows] = await pool.query(
            'SELECT verso_contribuicoes, logo_url, whatsapp, facebook, instagram, youtube, live_stream_url, licao_semana, licao_url FROM app_config WHERE igreja_id = ? LIMIT 1',
            [id]
        );
        const row = rows[0] || {};
        return res.json({
            versiculoContribuicoes: row.verso_contribuicoes || '"Trazei todos os dízimos e ofertas à casa do tesouro." (Ml 3:10)',
            logoUrl: row.logo_url || null,
            whatsapp: row.whatsapp || null,
            facebook: row.facebook || null,
            instagram: row.instagram || null,
            youtube: row.youtube || null,
            liveStreamUrl: row.live_stream_url || null,
            licaoSemana: row.licao_semana || null,
            licaoUrl: row.licao_url || null
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/api/app/config', requireAuth, async (req, res) => {
    try {
        await ensureAppTables();

        const id = req.auth.igrejaId;
        const versiculoContribuicoes = String(req.body?.versiculoContribuicoes || '').trim() || null;
        const logoUrl = String(req.body?.logoUrl || '').trim() || null;
        const whatsapp = String(req.body?.whatsapp || '').trim() || null;
        const facebook = String(req.body?.facebook || '').trim() || null;
        const instagram = String(req.body?.instagram || '').trim() || null;
        const youtube = String(req.body?.youtube || '').trim() || null;
        const liveStreamUrl = String(req.body?.liveStreamUrl || '').trim() || null;
        const licaoSemana = String(req.body?.licaoSemana || '').trim() || null;
        const licaoUrl = String(req.body?.licaoUrl || '').trim() || null;

        const [updateResult] = await pool.query(
            `UPDATE app_config
             SET verso_contribuicoes = ?,
                 logo_url = ?,
                 whatsapp = ?,
                 facebook = ?,
                 instagram = ?,
                 youtube = ?,
                 live_stream_url = ?,
                 licao_semana = ?,
                 licao_url = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE igreja_id = ?`,
            [versiculoContribuicoes, logoUrl, whatsapp, facebook, instagram, youtube, liveStreamUrl, licaoSemana, licaoUrl, id]
        );

        const affected = Number(updateResult?.affectedRows || updateResult?.rowCount || 0);

        if (!affected) {
            await pool.query(
                `INSERT INTO app_config (
                    igreja_id, verso_contribuicoes, logo_url, whatsapp, facebook,
                    instagram, youtube, live_stream_url, licao_semana, licao_url, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, versiculoContribuicoes, logoUrl, whatsapp, facebook, instagram, youtube, liveStreamUrl, licaoSemana, licaoUrl]
            );
        }

        return res.json({
            ok: true,
            versiculoContribuicoes, logoUrl, whatsapp, facebook,
            instagram, youtube, liveStreamUrl, licaoSemana, licaoUrl
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/app/congregacoes ───────────────────────────────────────────────

router.get('/api/app/congregacoes', resolveIgreja, async (req, res) => {
    try {
        await ensureAppTables();
        const id = req.igrejaId;
        const [rows] = await pool.query(
            `SELECT id, nome, pastor, dirigente, telefone, endereco, latitude, longitude
             FROM app_congregacoes
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY nome ASC`,
            [id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/app/videos ─────────────────────────────────────────────────────

router.get('/api/app/videos', resolveIgreja, async (req, res) => {
    try {
        await ensureAppTables();
        const id = req.igrejaId;
        const [rows] = await pool.query(
            `SELECT id, titulo, url, data
             FROM app_videos
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY data DESC, id DESC`,
            [id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/app/midias ────────────────────────────────────────────────────

router.get('/api/app/midias', resolveIgreja, async (req, res) => {
    try {
        await ensureAppTables();
        const id = req.igrejaId;

        const [videos] = await pool.query(
            `SELECT id, titulo, url, '' AS descricao, '' AS file_name, created_at
             FROM app_videos
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY id DESC`,
            [id]
        );

        const [audios] = await pool.query(
            `SELECT id, titulo, url, descricao, file_name, created_at
             FROM app_audios
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY id DESC`,
            [id]
        );

        const [images] = await pool.query(
            `SELECT id, titulo, url, descricao, file_name, created_at
             FROM app_images
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY id DESC`,
            [id]
        );

        const [documents] = await pool.query(
            `SELECT id, titulo, url, descricao, file_name, created_at
             FROM app_documents
             WHERE igreja_id = ? AND ativo = 1
             ORDER BY id DESC`,
            [id]
        );

        return res.json({
            videos: (videos || []).map((item) => ({
                id: item.id,
                title: item.titulo,
                url: item.url,
                description: item.descricao || '',
                fileName: item.file_name || '',
                createdAt: item.created_at || null
            })),
            audios: (audios || []).map((item) => ({
                id: item.id,
                title: item.titulo,
                url: item.url,
                description: item.descricao || '',
                fileName: item.file_name || '',
                createdAt: item.created_at || null
            })),
            images: (images || []).map((item) => ({
                id: item.id,
                title: item.titulo,
                url: item.url,
                description: item.descricao || '',
                fileName: item.file_name || '',
                createdAt: item.created_at || null
            })),
            documents: (documents || []).map((item) => ({
                id: item.id,
                title: item.titulo,
                url: item.url,
                description: item.descricao || '',
                fileName: item.file_name || '',
                createdAt: item.created_at || null
            }))
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/app/midias/:type ─────────────────────────────────────────────

router.post('/api/app/midias/:type', requireAuth, authorizeMediaWrite, async (req, res) => {
    try {
        await ensureAppTables();
        const type = normalizeMediaType(req.params.type);
        const table = mediaTableByType(type);
        if (!table) {
            return res.status(400).json({ error: 'Tipo de mídia inválido.' });
        }

        const id = req.auth.igrejaId;
        const title = String(req.body?.title || '').trim();
        const url = String(req.body?.url || '').trim();
        const description = String(req.body?.description || '').trim();
        const fileName = String(req.body?.fileName || '').trim();

        if (!title || !url) {
            return res.status(400).json({ error: 'Título e URL são obrigatórios.' });
        }

        if (table === 'app_videos') {
            const [result] = await pool.query(
                `INSERT INTO app_videos (igreja_id, titulo, url, data, ativo)
                 VALUES (?, ?, ?, CURRENT_DATE, 1)`,
                [id, title, url]
            );
            return res.status(201).json({ ok: true, id: result?.insertId || null });
        }

        const [result] = await pool.query(
            `INSERT INTO ${table} (igreja_id, titulo, url, descricao, file_name, ativo)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [id, title, url, description || null, fileName || null]
        );

        return res.status(201).json({ ok: true, id: result?.insertId || null });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/app/midias/:type/:id ───────────────────────────────────────

router.delete('/api/app/midias/:type/:id', requireAuth, authorizeMediaWrite, async (req, res) => {
    try {
        await ensureAppTables();
        const type = normalizeMediaType(req.params.type);
        const table = mediaTableByType(type);
        const mediaId = Number(req.params.id || 0);
        const id = req.auth.igrejaId;

        if (!table || !mediaId) {
            return res.status(400).json({ error: 'Parâmetros inválidos para exclusão.' });
        }

        const [result] = await pool.query(
            `DELETE FROM ${table} WHERE id = ? AND igreja_id = ?`,
            [mediaId, id]
        );

        const affected = Number(result?.affectedRows || result?.rowCount || 0);
        if (!affected) {
            return res.status(404).json({ error: 'Mídia não encontrada para esta igreja.' });
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/app/eventos ────────────────────────────────────────────────────
// ?mes=YYYY-MM   (padrão: mês corrente)

router.get('/api/app/eventos', resolveIgreja, async (req, res) => {
    try {
        const id = req.igrejaId;

        // Determina o intervalo do mês
        let mesParam = req.query.mes;
        if (!mesParam || !/^\d{4}-\d{2}$/.test(mesParam)) {
            const now = new Date();
            mesParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const startDate = `${mesParam}-01`;
        const [year, month] = mesParam.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${mesParam}-${String(lastDay).padStart(2, '0')} 23:59:59`;

        const rows = await agendaService.listEventos({
            igrejaId: id,
            start: `${startDate} 00:00:00`,
            end: endDate
        });

        return res.json(rows.map((r) => ({
            id: r.id,
            titulo: r.titulo,
            descricao: r.descricao,
            data: r.inicio,
            fim: r.fim
        })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/app/conexoes ──────────────────────────────────────────────────

const TIPOS_VALIDOS = ['conexao', 'oracao', 'ajuda', 'decisao'];

router.post('/api/app/conexoes', resolveIgreja, async (req, res) => {
    try {
        await ensureAppTables();
        const id = req.igrejaId;

        const { tipo, nome, celular, mensagem } = req.body || {};

        if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido. Use: conexao, oracao, ajuda, decisao.' });
        }
        if (!nome || String(nome).trim().length < 2) {
            return res.status(400).json({ error: 'Nome obrigatório (mínimo 2 caracteres).' });
        }

        await pool.query(
            `INSERT INTO app_conexoes (igreja_id, tipo, nome, celular, mensagem) VALUES (?, ?, ?, ?, ?)`,
            [id, tipo, String(nome).trim(), celular ? String(celular).trim() : null, mensagem ? String(mensagem).trim() : null]
        );

        return res.status(201).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
