const { pool } = require('../config/db');

async function listPublic(req, res) {
    const [rows] = await pool.query(
        `SELECT id, titulo, slug, resumo, autor, categoria, imagem_url, created_at
         FROM blog_posts WHERE publicado = 1 ORDER BY created_at DESC`
    );
    res.json(rows);
}

async function getBySlug(req, res) {
    const [rows] = await pool.query(
        `SELECT * FROM blog_posts WHERE slug = ? AND publicado = 1 LIMIT 1`,
        [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado.' });
    res.json(rows[0]);
}

async function listAdmin(req, res) {
    const [rows] = await pool.query(
        `SELECT id, titulo, slug, resumo, autor, categoria, imagem_url, publicado, created_at, updated_at
         FROM blog_posts ORDER BY created_at DESC`
    );
    res.json(rows);
}

async function createPost(req, res) {
    const { titulo, slug, resumo, conteudo, autor, categoria, imagem_url, publicado } = req.body || {};
    if (!titulo || !slug) return res.status(400).json({ error: 'titulo e slug são obrigatórios.' });
    const [result] = await pool.query(
        `INSERT INTO blog_posts (titulo, slug, resumo, conteudo, autor, categoria, imagem_url, publicado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [titulo, slug, resumo || '', conteudo || '', autor || 'LDFP', categoria || 'Geral', imagem_url || null, publicado ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId, slug });
}

async function updatePost(req, res) {
    const { titulo, slug, resumo, conteudo, autor, categoria, imagem_url, publicado } = req.body || {};
    const [result] = await pool.query(
        `UPDATE blog_posts SET titulo=?, slug=?, resumo=?, conteudo=?, autor=?, categoria=?, imagem_url=?, publicado=?, updated_at=NOW()
         WHERE id=?`,
        [titulo, slug, resumo || '', conteudo || '', autor || 'LDFP', categoria || 'Geral', imagem_url || null, publicado ? 1 : 0, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Post não encontrado.' });
    res.json({ ok: true });
}

async function deletePost(req, res) {
    const [result] = await pool.query(`DELETE FROM blog_posts WHERE id = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Post não encontrado.' });
    res.json({ ok: true });
}

module.exports = { listPublic, getBySlug, listAdmin, createPost, updatePost, deletePost };
