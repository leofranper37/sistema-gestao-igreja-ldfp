'use strict';

/**
 * Lote 6 — schema do Mural e da Inscrição em Eventos.
 *
 * O SQL oficial está em INOVACOES_LOTE6_MURAL_EVENTOS_CARTEIRINHA.sql (rodar no
 * phpMyAdmin antes do deploy). Este arquivo é uma REDE DE SEGURANÇA: cria
 * tabelas/colunas se o SQL ainda não tiver sido rodado.
 * DDL MySQL primeiro (o INDEX inline faz falhar no SQLite) → depois SQLite.
 */

const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

const RE_DUPLICADA = /duplicate column|already exists|duplicate/i;

const TABELAS = {
    mural_posts: [
        `CREATE TABLE IF NOT EXISTS mural_posts (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL,
            autor_tipo VARCHAR(10) NOT NULL, autor_id INT NULL, autor_nome VARCHAR(150) NULL,
            texto TEXT NOT NULL, fixado TINYINT(1) NOT NULL DEFAULT 0,
            status VARCHAR(15) NOT NULL DEFAULT 'publicado',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NULL,
            INDEX idx_mural_posts_igreja (igreja_id, status, created_at)
        )`,
        `CREATE TABLE IF NOT EXISTS mural_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL,
            autor_tipo TEXT NOT NULL, autor_id INTEGER, autor_nome TEXT,
            texto TEXT NOT NULL, fixado INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'publicado',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT
        )`
    ],
    mural_comentarios: [
        `CREATE TABLE IF NOT EXISTS mural_comentarios (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL, post_id INT NOT NULL,
            autor_tipo VARCHAR(10) NOT NULL, autor_id INT NULL, autor_nome VARCHAR(150) NULL,
            texto TEXT NOT NULL, status VARCHAR(15) NOT NULL DEFAULT 'publicado',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mural_coment_post (igreja_id, post_id)
        )`,
        `CREATE TABLE IF NOT EXISTS mural_comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
            autor_tipo TEXT NOT NULL, autor_id INTEGER, autor_nome TEXT,
            texto TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'publicado',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
    ],
    mural_reacoes: [
        `CREATE TABLE IF NOT EXISTS mural_reacoes (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL, post_id INT NOT NULL,
            autor_tipo VARCHAR(10) NOT NULL, autor_id INT NOT NULL, tipo VARCHAR(15) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mural_reacao (post_id, autor_tipo, autor_id),
            INDEX idx_mural_reacoes_igreja (igreja_id, post_id)
        )`,
        `CREATE TABLE IF NOT EXISTS mural_reacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
            autor_tipo TEXT NOT NULL, autor_id INTEGER NOT NULL, tipo TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (post_id, autor_tipo, autor_id)
        )`
    ],
    mural_denuncias: [
        `CREATE TABLE IF NOT EXISTS mural_denuncias (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL,
            alvo_tipo VARCHAR(12) NOT NULL, alvo_id INT NOT NULL,
            autor_tipo VARCHAR(10) NOT NULL, autor_id INT NOT NULL, motivo VARCHAR(255) NULL,
            resolvida TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mural_denuncia (alvo_tipo, alvo_id, autor_tipo, autor_id),
            INDEX idx_mural_denuncias_igreja (igreja_id, resolvida)
        )`,
        `CREATE TABLE IF NOT EXISTS mural_denuncias (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL,
            alvo_tipo TEXT NOT NULL, alvo_id INTEGER NOT NULL,
            autor_tipo TEXT NOT NULL, autor_id INTEGER NOT NULL, motivo TEXT,
            resolvida INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (alvo_tipo, alvo_id, autor_tipo, autor_id)
        )`
    ],
    mural_config: [
        `CREATE TABLE IF NOT EXISTS mural_config (
            igreja_id INT NOT NULL PRIMARY KEY,
            membros_publicam TINYINT(1) NOT NULL DEFAULT 1,
            exige_aprovacao TINYINT(1) NOT NULL DEFAULT 1,
            comentarios TINYINT(1) NOT NULL DEFAULT 1,
            updated_at DATETIME NULL
        )`,
        `CREATE TABLE IF NOT EXISTS mural_config (
            igreja_id INTEGER NOT NULL PRIMARY KEY,
            membros_publicam INTEGER NOT NULL DEFAULT 1,
            exige_aprovacao INTEGER NOT NULL DEFAULT 1,
            comentarios INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT
        )`
    ],
    evento_inscricoes: [
        `CREATE TABLE IF NOT EXISTS evento_inscricoes (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL,
            evento_id INT NOT NULL, membro_id INT NOT NULL,
            nome VARCHAR(150) NULL, celular VARCHAR(30) NULL,
            status VARCHAR(15) NOT NULL DEFAULT 'inscrito',
            presente TINYINT(1) NOT NULL DEFAULT 0, presente_em DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_evento_membro (evento_id, membro_id),
            INDEX idx_evento_inscricoes_igreja (igreja_id, evento_id)
        )`,
        `CREATE TABLE IF NOT EXISTS evento_inscricoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL,
            evento_id INTEGER NOT NULL, membro_id INTEGER NOT NULL,
            nome TEXT, celular TEXT,
            status TEXT NOT NULL DEFAULT 'inscrito',
            presente INTEGER NOT NULL DEFAULT 0, presente_em TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (evento_id, membro_id)
        )`
    ]
};

const COLUNAS_AGENDA = [
    ['inscricao_aberta', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['vagas', 'INT NULL'],
    ['inscricao_ate', 'DATETIME NULL']
];

let muralPronto = null;
let eventosPronto = null;
const colunasProntas = new Set();

async function ensureMural() {
    if (!muralPronto) {
        muralPronto = (async () => {
            for (const nome of ['mural_posts', 'mural_comentarios', 'mural_reacoes', 'mural_denuncias', 'mural_config']) {
                await ensureTable(nome, TABELAS[nome]);
            }
        })().catch((e) => { muralPronto = null; throw e; });
    }
    return muralPronto;
}

async function ensureEventos() {
    if (!eventosPronto) {
        eventosPronto = (async () => {
            // garante agenda_eventos antes de mexer nas colunas
            const agendaModel = require('./agendaModel');
            if (typeof agendaModel.ensureAgendaTable === 'function') await agendaModel.ensureAgendaTable();
            await ensureTable('evento_inscricoes', TABELAS.evento_inscricoes);
        })().catch((e) => { eventosPronto = null; throw e; });
    }
    await eventosPronto;
    for (const [col, tipo] of COLUNAS_AGENDA) {
        if (colunasProntas.has(col)) continue;
        try {
            await pool.query(`ALTER TABLE agenda_eventos ADD COLUMN ${col} ${tipo}`);
            colunasProntas.add(col);
        } catch (e) {
            if (RE_DUPLICADA.test(String(e && e.message))) colunasProntas.add(col);
        }
    }
}

module.exports = { ensureMural, ensureEventos };
