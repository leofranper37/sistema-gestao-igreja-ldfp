'use strict';

const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { pool } = require('../config/db');

const BACKUP_ROOT = process.env.BACKUP_DIR
    || path.resolve(__dirname, '../../backups');

// Tabelas restauráveis (mesmas do script de backup)
const TABELAS_RESTAURAR = [
    'membros',
    'visitantes',
    'congregados',
    'criancas',
    'cargos',
    'pedidos_oracao',
    'oracoes_pedidos',
    'banco_contas',
    'banco_lancamentos',
    'contas_pagar',
    'payment_links',
    'contabilidade_plano_contas',
    'contabilidade_balancete_abertura',
    'contabilidade_lancamentos',
    'contabilidade_encerramentos',
    'escalas',
    'dizimos',
    'missionarios',
    'congregacoes',
    'agenda_eventos',
    'batismos',
    'ebd_turmas',
    'ebd_alunos',
    'ebd_grades',
];

// ── Listar datas de backup disponíveis ────────────────────────────────────────
async function listarBackups(req, res, next) {
    try {
        const indiceFile = path.join(BACKUP_ROOT, 'indice.json');
        if (!fs.existsSync(indiceFile)) {
            return res.json({ backups: [], mensagem: 'Nenhum backup encontrado ainda.' });
        }
        const indice = JSON.parse(fs.readFileSync(indiceFile, 'utf8'));
        res.json({ backups: indice });
    } catch (err) {
        next(err);
    }
}

// ── Detalhar backup de uma data específica ───────────────────────────────────
async function detalharBackup(req, res, next) {
    try {
        const { data } = req.params;
        // Validar formato YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
        }
        const manifestFile = path.join(BACKUP_ROOT, data, 'manifest.json');
        if (!fs.existsSync(manifestFile)) {
            return res.status(404).json({ error: `Backup de ${data} não encontrado.` });
        }
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        // Retornar apenas metadados, nunca o conteúdo dos dados
        res.json({
            data: manifest.data,
            gerado_em: manifest.gerado_em,
            igrejas: manifest.igrejas.map(i => ({
                id: i.id,
                nome: i.nome,
                plano: i.plano,
                status: i.status,
                total_membros: i.total_membros,
            }))
        });
    } catch (err) {
        next(err);
    }
}

// ── Executar backup agora ─────────────────────────────────────────────────────
async function executarBackup(req, res, next) {
    try {
        const scriptPath = path.resolve(__dirname, '../../scripts/backup-por-igreja.js');
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({ error: 'Script de backup não encontrado.' });
        }

        const igrejaId = req.body?.igreja_id ? String(req.body.igreja_id) : null;
        const args = igrejaId ? ['--igreja_id=' + igrejaId] : [];

        // Responde imediatamente e roda o backup em background
        res.json({ ok: true, mensagem: 'Backup iniciado em segundo plano. Consulte a lista em alguns segundos.' });

        const child = execFile('node', [scriptPath, ...args], {
            env: { ...process.env },
            cwd: path.resolve(__dirname, '../..')
        }, (err, stdout, stderr) => {
            if (err) console.error('[backup] Erro:', stderr || err.message);
            else console.log('[backup] Concluído:', stdout.trim().slice(-200));
        });
        child.unref();
    } catch (err) {
        next(err);
    }
}

// ── Restaurar dados de uma igreja a partir de um backup ───────────────────────
// O super-admin NUNCA vê o conteúdo — só confirma a restauração.
async function restaurarIgreja(req, res, next) {
    const conn = await pool.getConnection?.() || pool;
    let transactionStarted = false;

    try {
        const { igrejaId } = req.params;
        const { data } = req.body;

        if (!igrejaId || !data) {
            return res.status(400).json({ error: 'Informe igrejaId e data do backup.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
        }

        // Localizar arquivo de backup da igreja
        const dirData = path.join(BACKUP_ROOT, data);
        if (!fs.existsSync(dirData)) {
            return res.status(404).json({ error: `Backup de ${data} não encontrado.` });
        }

        // Procurar a pasta da igreja dentro do diretório do dia
        const pastas = fs.readdirSync(dirData);
        const pastaIgreja = pastas.find(p => p.startsWith(`${igrejaId}_`));
        if (!pastaIgreja) {
            return res.status(404).json({ error: `Backup da igreja ${igrejaId} em ${data} não encontrado.` });
        }

        const arquivoDados = path.join(dirData, pastaIgreja, 'dados.json');
        if (!fs.existsSync(arquivoDados)) {
            return res.status(404).json({ error: 'Arquivo de dados do backup não encontrado.' });
        }

        const backup = JSON.parse(fs.readFileSync(arquivoDados, 'utf8'));
        const id = Number(igrejaId);

        // Verificar que a igreja existe no banco atual
        const [igrejaRows] = await pool.query('SELECT id, nome FROM igrejas WHERE id = ? LIMIT 1', [id]);
        if (!igrejaRows.length) {
            return res.status(404).json({ error: `Igreja id=${id} não encontrada no sistema.` });
        }

        // Iniciar transação
        if (typeof conn.beginTransaction === 'function') {
            await conn.beginTransaction();
            transactionStarted = true;
        }

        const resumo = {};

        for (const tabela of TABELAS_RESTAURAR) {
            const linhas = backup.tabelas?.[tabela];
            if (!Array.isArray(linhas) || linhas.length === 0) continue;

            // Deletar dados atuais da igreja nessa tabela
            try {
                await pool.query(`DELETE FROM \`${tabela}\` WHERE igreja_id = ?`, [id]);
            } catch (_) { continue; }

            // Re-inserir os dados do backup (excluindo o campo `id` para evitar conflitos de PK)
            let inseridos = 0;
            for (const linha of linhas) {
                const { id: _pk, ...campos } = linha;
                campos.igreja_id = id; // garantir referência correta
                const colunas = Object.keys(campos);
                if (!colunas.length) continue;
                const placeholders = colunas.map(() => '?').join(', ');
                const valores = colunas.map(c => campos[c]);
                try {
                    await pool.query(
                        `INSERT INTO \`${tabela}\` (${colunas.join(', ')}) VALUES (${placeholders})`,
                        valores
                    );
                    inseridos++;
                } catch (_) {}
            }
            resumo[tabela] = inseridos;
        }

        if (transactionStarted) await conn.commit();

        // Registrar no log do servidor
        console.log(`[restore] Igreja ${igrejaRows[0].nome} (id=${id}) restaurada pelo super-admin ${req.auth?.email} a partir de ${data}`);

        // Responder com resumo (sem expor dados)
        res.json({
            ok: true,
            mensagem: `Igreja "${igrejaRows[0].nome}" restaurada com sucesso a partir do backup de ${data}.`,
            resumo
        });
    } catch (err) {
        if (transactionStarted) {
            try { await conn.rollback(); } catch (_) {}
        }
        next(err);
    }
}

module.exports = { listarBackups, detalharBackup, executarBackup, restaurarIgreja };
