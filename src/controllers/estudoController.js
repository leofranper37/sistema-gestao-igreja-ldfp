const { pool } = require('../config/db');

function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

// --- Versões ---
exports.getVersoes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, codigo, nome, idioma, licenca_nota FROM estudo_versoes WHERE ativo = 1');
        res.json(rows);
    } catch (err) {
        console.error('[Estudo] Erro getVersoes:', err);
        res.status(500).json({ error: 'Erro ao buscar versões.' });
    }
};

// --- Passagens ---
exports.getPassagens = async (req, res) => {
    const { versao, livro, capitulo } = req.query;
    if (!versao || !livro || !capitulo) {
        return res.status(400).json({ error: 'Parâmetros versao, livro e capitulo são obrigatórios.' });
    }
    
    try {
        const [versoes] = await pool.query('SELECT id FROM estudo_versoes WHERE codigo = ?', [versao]);
        if (!versoes.length) return res.status(404).json({ error: 'Versão não encontrada.' });
        
        const versao_id = versoes[0].id;
        
        const [rows] = await pool.query(
            'SELECT versiculo, texto FROM estudo_passagens WHERE versao_id = ? AND livro = ? AND capitulo = ? ORDER BY versiculo ASC',
            [versao_id, livro, capitulo]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Estudo] Erro getPassagens:', err);
        res.status(500).json({ error: 'Erro ao buscar passagens.' });
    }
};

exports.buscaPassagens = async (req, res) => {
    const { q, versao } = req.query;
    if (!q || !versao) return res.status(400).json({ error: 'Parâmetros q e versao são obrigatórios.' });
    
    try {
        const [versoes] = await pool.query('SELECT id FROM estudo_versoes WHERE codigo = ?', [versao]);
        if (!versoes.length) return res.status(404).json({ error: 'Versão não encontrada.' });
        
        const versao_id = versoes[0].id;
        const searchTerm = `%${q}%`;
        
        const [rows] = await pool.query(
            'SELECT livro, capitulo, versiculo, texto FROM estudo_passagens WHERE versao_id = ? AND texto LIKE ? LIMIT 50',
            [versao_id, searchTerm]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Estudo] Erro buscaPassagens:', err);
        res.status(500).json({ error: 'Erro ao buscar.' });
    }
};

// --- Anotações ---
exports.getAnotacoes = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    try {
        const [rows] = await pool.query(
            'SELECT id, versao_id, livro, capitulo, versiculo_ini, versiculo_fim, texto, cor_realce, updated_at FROM estudo_anotacoes WHERE user_id = ? AND igreja_id = ? ORDER BY updated_at DESC',
            [user_id, igreja_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar anotações.' });
    }
};

exports.saveAnotacao = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    const { id, versao_id, livro, capitulo, versiculo_ini, versiculo_fim, texto, cor_realce } = req.body;
    
    if (!versao_id || !livro || !capitulo || !versiculo_ini) {
        return res.status(400).json({ error: 'Dados da referência incompletos.' });
    }
    
    try {
        if (id) {
            // update
            await pool.query(
                'UPDATE estudo_anotacoes SET texto = ?, cor_realce = ?, versiculo_fim = ? WHERE id = ? AND user_id = ?',
                [texto || null, cor_realce || null, versiculo_fim || null, id, user_id]
            );
            res.json({ id, message: 'Anotação atualizada.' });
        } else {
            // insert
            const [result] = await pool.query(
                `INSERT INTO estudo_anotacoes (user_id, igreja_id, versao_id, livro, capitulo, versiculo_ini, versiculo_fim, texto, cor_realce) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user_id, igreja_id, versao_id, livro, capitulo, versiculo_ini, versiculo_fim || null, texto || null, cor_realce || null]
            );
            res.status(201).json({ id: result.insertId, message: 'Anotação criada.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar anotação.' });
    }
};

exports.deleteAnotacao = async (req, res) => {
    const { id: user_id } = req.auth;
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM estudo_anotacoes WHERE id = ? AND user_id = ?', [id, user_id]);
        res.json({ message: 'Anotação removida.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover anotação.' });
    }
};

// --- Favoritos ---
exports.getFavoritos = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    try {
        const [rows] = await pool.query(
            'SELECT id, versao_id, livro, capitulo, versiculo, created_at FROM estudo_favoritos WHERE user_id = ? AND igreja_id = ? ORDER BY created_at DESC',
            [user_id, igreja_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar favoritos.' });
    }
};

exports.addFavorito = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    const { versao_id, livro, capitulo, versiculo } = req.body;
    
    if (!versao_id || !livro || !capitulo || !versiculo) {
        return res.status(400).json({ error: 'Referência incompleta.' });
    }
    
    try {
        const [result] = await pool.query(
            `INSERT IGNORE INTO estudo_favoritos (user_id, igreja_id, versao_id, livro, capitulo, versiculo) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, igreja_id, versao_id, livro, capitulo, versiculo]
        );
        res.status(201).json({ id: result.insertId, message: 'Favorito adicionado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao adicionar favorito.' });
    }
};

exports.deleteFavorito = async (req, res) => {
    const { id: user_id } = req.auth;
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM estudo_favoritos WHERE id = ? AND user_id = ?', [id, user_id]);
        res.json({ message: 'Favorito removido.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover favorito.' });
    }
};

// --- Planos ---
exports.getPlanos = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    try {
        const [rows] = await pool.query(
            'SELECT id, titulo, descricao, tipo, dias_total, igreja_id FROM estudo_planos WHERE (igreja_id IS NULL OR igreja_id = ?) AND ativo = 1',
            [igreja_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar planos.' });
    }
};

exports.getPlanoDetalhe = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    const { id } = req.params;
    try {
        const [planos] = await pool.query(
            'SELECT * FROM estudo_planos WHERE id = ? AND (igreja_id IS NULL OR igreja_id = ?) AND ativo = 1',
            [id, igreja_id]
        );
        if (!planos.length) return res.status(404).json({ error: 'Plano não encontrado.' });
        
        const plano = planos[0];
        
        // Parse seguro da coluna LONGTEXT do MySQL 5.6
        try {
            plano.passos = JSON.parse(plano.passos_json);
        } catch(e) {
            plano.passos = [];
        }
        delete plano.passos_json;
        
        const [progresso] = await pool.query(
            'SELECT passo_atual, concluido FROM estudo_progresso WHERE user_id = ? AND plano_id = ?',
            [user_id, id]
        );
        
        res.json({ plano, progresso: progresso[0] || { passo_atual: 0, concluido: 0 } });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar detalhes do plano.' });
    }
};

exports.updateProgresso = async (req, res) => {
    const { id: user_id, igrejaId: igreja_id } = req.auth;
    const { id } = req.params;
    const { passo_atual, concluido } = req.body;
    
    if (passo_atual === undefined) return res.status(400).json({ error: 'passo_atual é obrigatório.' });
    
    try {
        await pool.query(
            `INSERT INTO estudo_progresso (user_id, igreja_id, plano_id, passo_atual, concluido)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE passo_atual = VALUES(passo_atual), concluido = VALUES(concluido)`,
            [user_id, igreja_id, id, passo_atual, concluido ? 1 : 0]
        );
        res.json({ message: 'Progresso atualizado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar progresso.' });
    }
};

// --- Devocionais ---
exports.getDevocionalHoje = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    try {
        const [rows] = await pool.query(
            `SELECT id, titulo, versiculo_ref, corpo, oracao 
             FROM estudo_devocionais 
             WHERE (igreja_id = ? OR igreja_id IS NULL) 
               AND data_ref = date('now') 
               AND ativo = 1 
             ORDER BY igreja_id DESC 
             LIMIT 1`,
            [igreja_id]
        );
        res.json(rows[0] || null);
    } catch (err) {
        console.error('[Estudo] Erro getDevocionalHoje:', err);
        res.status(500).json({ error: 'Erro ao buscar devocional.' });
    }
};

exports.listDevocionais = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    try {
        const [rows] = await pool.query(
            `SELECT id, data_ref, titulo, versiculo_ref, ativo 
             FROM estudo_devocionais 
             WHERE igreja_id = ? 
             ORDER BY data_ref DESC 
             LIMIT 100`,
            [igreja_id]
        );
        rows.forEach(r => r.data_ref = fmtDate(r.data_ref));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar devocionais.' });
    }
};

exports.getDevocional = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM estudo_devocionais WHERE id=? AND igreja_id=?', [id, igreja_id]);
        if (!rows.length) return res.status(404).json({ error: 'Devocional não encontrado.' });
        const dev = rows[0];
        dev.data_ref = fmtDate(dev.data_ref);
        res.json(dev);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar devocional.' });
    }
};

exports.createDevocional = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    const { data_ref, titulo, versiculo_ref, corpo, oracao, ativo } = req.body;
    if (!data_ref || !titulo || !corpo) return res.status(400).json({ error: 'Data, título e corpo são obrigatórios.' });
    try {
        const [result] = await pool.query(
            `INSERT INTO estudo_devocionais (igreja_id, data_ref, titulo, versiculo_ref, corpo, oracao, ativo) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [igreja_id, data_ref, titulo, versiculo_ref || null, corpo, oracao || null, ativo !== undefined ? ativo : 1]
        );
        res.status(201).json({ id: result.insertId, message: 'Devocional criado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar devocional.' });
    }
};

exports.updateDevocional = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    const { id } = req.params;
    const { data_ref, titulo, versiculo_ref, corpo, oracao, ativo } = req.body;
    if (!data_ref || !titulo || !corpo) return res.status(400).json({ error: 'Data, título e corpo são obrigatórios.' });
    try {
        const [result] = await pool.query(
            `UPDATE estudo_devocionais 
             SET data_ref=?, titulo=?, versiculo_ref=?, corpo=?, oracao=?, ativo=? 
             WHERE id=? AND igreja_id=?`,
            [data_ref, titulo, versiculo_ref || null, corpo, oracao || null, ativo !== undefined ? ativo : 1, id, igreja_id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Devocional não encontrado.' });
        res.json({ message: 'Devocional atualizado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar devocional.' });
    }
};

exports.deleteDevocional = async (req, res) => {
    const { igrejaId: igreja_id } = req.auth;
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM estudo_devocionais WHERE id=? AND igreja_id=?', [id, igreja_id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Devocional não encontrado.' });
        res.json({ message: 'Devocional removido.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover devocional.' });
    }
};