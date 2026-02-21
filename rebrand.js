import fs from 'fs';
import path from 'path';

const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.storybook'];
const EXTENSIONS = ['.ts', '.tsx', '.html', '.json', '.sql', '.md', '.txt', '.css'];

const ROOT_DIR = process.cwd();

function walkSync(dir, filelist = []) {
    if (!fs.existsSync(dir)) return filelist;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (IGNORE_DIRS.includes(file)) continue;

        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);

        if (stat.isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else {
            const ext = path.extname(filepath).toLowerCase();
            if (EXTENSIONS.includes(ext) || file === '.env.local') {
                filelist.push(filepath);
            }
        }
    }
    return filelist;
}

const files = walkSync(ROOT_DIR);
let modifiedCount = 0;

for (const file of files) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        const originalContent = content;

        // Replacements
        // 1. Exact match replacements (Case sensitive where it matters)
        content = content.replace(/Gurukul OS/g, 'Universepi OS');
        content = content.replace(/GURUKUL OS/g, 'UNIVERSEPI OS');
        content = content.replace(/GURUKUL/g, 'UNIVERSEPI');
        content = content.replace(/Gurukul/g, 'Universepi');
        content = content.replace(/gurukul/g, 'universepi');

        // 2. Email replacements
        content = content.replace(/@gurukul\.internal/g, '@universepi.internal');
        content = content.replace(/@gurukul\.node/g, '@universepi.internal');
        content = content.replace(/admin@gurucool\.com/g, 'admin@universepi.com');
        // Just in case any other gurucool variants exist:
        content = content.replace(/gurucool/g, 'universepi');
        content = content.replace(/Gurucool/g, 'Universepi');
        content = content.replace(/GURUCOOL/g, 'UNIVERSEPI');

        if (content !== originalContent) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Updated: ${path.relative(ROOT_DIR, file)}`);
            modifiedCount++;
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e.message}`);
    }
}

console.log(`\nReplacement complete! Modified ${modifiedCount} files.`);
