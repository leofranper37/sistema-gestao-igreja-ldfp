'use strict';

const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const { pool } = require('../config/db');

const router = express.Router();

/**
 * GET /api/audit-logs
 * Query params: page, limit, action, user_email
 * Admin/pastor vê logs da própria igreja; super-admin vê todos.
 */
router.get(
    '/api/audit-logs',
    requireAuth,
    authorize(['admin', 'pastor', 'super-admin', 'super_admin', 'superadmin', 'master']),
    async (req, res) => {
        try {
            const igrejaId  = req.auth?.igrejaId;
            const role      = String(req.auth?.role || '').toLowerCase();
            const superRoles = ['super-admin', 'super_admin', 'superadmin', 'master', 'owner'];
            const isSuperAdmin = superRoles.includes(role);

            const page   = Math.max(1, Number(req.query.page  || 1));
            const limit  = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
            const offset = (page - 1) * limit;

            const where  = [];
            const params = [];

            if (!isSuperAdmin) {
                where.push('igreja_id = ?');
                params.push(igrejaId);
            }
            if (req.query.action) {
                where.push('action LIKE ?');
                params.push(`%${req.query.action}%`);
            }
            if (req.query.user_email) {
                where.push('user_email LIKE ?');
                params.push(`%${req.query.user_email}%`);
            }

            const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

            const [[{ total }]] = await pool.query(
                `SELECT COUNT(*) AS total FROM audit_logs ${whereSQL}`,
                params
            );

            const [rows] = await pool.query(
                `SELECT id, igreja_id, user_id, user_email, user_role, action,
                        method, path, ip, details, created_at
                 FROM audit_logs ${whereSQL}
                 ORDER BY id DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            return res.json({
                items: rows.map(r => ({
                    ...r,
                    details: (() => {
                        try { return r.details ? JSON.parse(r.details) : null; }
                        catch (_) { return r.details; }
                    })()
                })),
                total:   Number(total),
                page,
                limit,
                pages:   Math.ceil(Number(total) / limit)
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
