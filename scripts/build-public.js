const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'public');
const distDir = path.join(projectRoot, 'dist', 'public');

function removeDir(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirRecursive(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

async function minifyFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, 'utf8');

    if (ext === '.js') {
        const result = await minify(raw, {
            compress: true,
            mangle: true,
            format: { comments: false }
        });
        fs.writeFileSync(filePath, result.code || '', 'utf8');
        return;
    }

    if (ext === '.css') {
        const result = new CleanCSS({ level: 2 }).minify(raw);
        if (result.errors.length > 0) {
            throw new Error(`Falha ao minificar CSS (${filePath}): ${result.errors.join(' | ')}`);
        }
        fs.writeFileSync(filePath, result.styles, 'utf8');
        return;
    }

    if (ext === '.html' || ext === '.htm') {
        const result = await minifyHtml(raw, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            minifyCSS: true,
            minifyJS: true
        });
        fs.writeFileSync(filePath, result, 'utf8');
    }
}

async function minifyTree(targetRoot) {
    const entries = fs.readdirSync(targetRoot, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(targetRoot, entry.name);

        if (entry.isDirectory()) {
            await minifyTree(fullPath);
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.js' || ext === '.css' || ext === '.html' || ext === '.htm') {
            await minifyFile(fullPath);
        }
    }
}

async function run() {
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Pasta public nao encontrada em: ${sourceDir}`);
    }

    removeDir(distDir);
    fs.mkdirSync(distDir, { recursive: true });

    copyDirRecursive(sourceDir, distDir);
    await minifyTree(distDir);

    console.log('Build concluido com sucesso.');
    console.log(`Arquivos otimizados em: ${distDir}`);
}

run().catch((error) => {
    console.error('Erro no build de producao:', error.message);
    process.exit(1);
});
